from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from django.db import models
from django.utils import timezone
import uuid

from .models import Transaction, TransactionState, TransactionEvent, Rating
from .serializers import (
    TransactionSerializer, BorrowRequestSerializer, QRGenerateSerializer,
    QRScanSerializer, DisputeSerializer, RatingSerializer, AdminDisputeResolveSerializer,
    TransactionEventSerializer,
)
from .state import TransactionStateMachine, InvalidTransitionError
from .qr import generate_handshake_token, verify_handshake_token, parse_token
from .tasks import award_time_credits, flag_for_admin_review
from items.models import Item
from users.models import UserProfile
from django.conf import settings


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Transaction.objects.filter(
            models.Q(borrower=user) | models.Q(item__owner=user)
        ).select_related('borrower', 'item', 'item__owner').prefetch_related('events', 'ratings').order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='borrow-request')
    def borrow_request(self, request):
        serializer = BorrowRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item = serializer.validated_data['item']
        if item.owner == request.user:
            return Response({'error': 'Cannot borrow your own item'}, status=status.HTTP_400_BAD_REQUEST)

        if Transaction.objects.filter(
            item=item,
            state__in=[TransactionState.PENDING, TransactionState.AGREED, TransactionState.ACTIVE, TransactionState.ITEM_OUT]
        ).exists():
            return Response({'error': 'Item already has an active transaction'}, status=status.HTTP_400_BAD_REQUEST)

        txn = Transaction.objects.create(
            borrower=request.user,
            item=item,
            state=TransactionState.PENDING,
            requested_from=serializer.validated_data['requested_from'],
            requested_to=serializer.validated_data['requested_to'],
            time_credits_per_day=item.time_credits_per_day,
        )

        TransactionEvent.objects.create(
            transaction=txn,
            event_type='STATE_CHANGE',
            detail={'action': 'created', 'by': 'borrower'},
        )

        return Response(TransactionSerializer(txn, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        txn = self.get_object()
        if txn.item.owner != request.user:
            return Response({'error': 'Only the lender can accept'}, status=status.HTTP_403_FORBIDDEN)

        machine = TransactionStateMachine(txn)
        try:
            machine.accept(request.user)
        except InvalidTransitionError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate_transaction(self, request, pk=None):
        txn = self.get_object()
        if txn.borrower != request.user:
            return Response({'error': 'Only the borrower can confirm terms and activate'}, status=status.HTTP_403_FORBIDDEN)

        machine = TransactionStateMachine(txn)
        try:
            machine.activate(request.user)
        except InvalidTransitionError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='decline')
    def decline(self, request, pk=None):
        txn = self.get_object()
        if txn.item.owner != request.user:
            return Response({'error': 'Only the lender can decline'}, status=status.HTTP_403_FORBIDDEN)

        if txn.state != TransactionState.PENDING:
            return Response({'error': 'Can only decline pending requests'}, status=status.HTTP_400_BAD_REQUEST)

        txn.state = TransactionState.DISPUTED
        txn.save(update_fields=['state', 'updated_at'])
        TransactionEvent.objects.create(
            transaction=txn,
            event_type='STATE_CHANGE',
            detail={'action': 'declined', 'by': str(request.user.id)},
        )
        return Response(TransactionSerializer(txn, context={'request': request}).data)


    @action(detail=True, methods=['post'], url_path='close')
    def close_transaction(self, request, pk=None):
        """
        Lender closes the transaction after item is returned and deposit released.
        Transitions ITEM_RETURNED → CLOSED.
        """
        txn = self.get_object()
        if txn.item.owner != request.user:
            return Response({'error': 'Only the lender can close the transaction'}, status=status.HTTP_403_FORBIDDEN)

        machine = TransactionStateMachine(txn)
        try:
            TransactionStateMachine.transition(txn, TransactionState.CLOSED, request.user, {
                'action': 'closed_by_lender',
            })
        except InvalidTransitionError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='generate-qr')
    def generate_qr(self, request, pk=None):
        txn = self.get_object()
        if txn.item.owner != request.user and txn.borrower != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        if txn.state not in [TransactionState.ACTIVE, TransactionState.ITEM_OUT]:
            return Response({'error': 'QR can only be generated for handoff or return'}, status=status.HTTP_400_BAD_REQUEST)

        token = generate_handshake_token(str(txn.id))
        return Response({'token': token, 'qr_url': f'{request.build_absolute_uri("/scan/")}{token}'})

    @action(detail=True, methods=['post'], url_path='scan-qr')
    def scan_qr(self, request, pk=None):
        txn = self.get_object()
        serializer = QRScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']

        # Validate token/txn/party BEFORE consuming the token, so a wrong-txn
        # scan or a non-party scan cannot burn one of the two token slots.
        try:
            parsed = parse_token(token)
        except ValueError:
            return Response({'error': 'Invalid QR token'}, status=status.HTTP_400_BAD_REQUEST)

        if parsed['txn_id'] != str(txn.id):
            return Response({'error': 'Token does not match this transaction'}, status=status.HTTP_400_BAD_REQUEST)

        is_lender = txn.item.owner == request.user
        is_borrower = txn.borrower == request.user

        if not is_lender and not is_borrower:
            return Response({'error': 'Not a party to this transaction'}, status=status.HTTP_403_FORBIDDEN)

        if not verify_handshake_token(token, user_id=request.user.id):
            return Response({'error': 'Invalid or expired QR token'}, status=status.HTTP_400_BAD_REQUEST)

        if txn.state == TransactionState.ACTIVE:
            if is_lender:
                txn.lender_scanned_handoff = True
            else:
                txn.borrower_scanned_handoff = True

            if txn.lender_scanned_handoff and txn.borrower_scanned_handoff:
                machine = TransactionStateMachine(txn)
                try:
                    machine.handoff(request.user)
                except InvalidTransitionError as e:
                    return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        elif txn.state == TransactionState.ITEM_OUT:
            if is_lender:
                txn.lender_scanned_return = True
            else:
                txn.borrower_scanned_return = True

            if txn.lender_scanned_return and txn.borrower_scanned_return:
                machine = TransactionStateMachine(txn)
                try:
                    machine.return_item(request.user)
                except InvalidTransitionError as e:
                    return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        txn.save(update_fields=[
            'lender_scanned_handoff', 'borrower_scanned_handoff',
            'lender_scanned_return', 'borrower_scanned_return', 'updated_at'
        ])

        TransactionEvent.objects.create(
            transaction=txn,
            event_type='QR_SCAN',
            detail={'by': 'lender' if is_lender else 'borrower', 'state': txn.state},
        )

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='dispute')
    def dispute(self, request, pk=None):
        txn = self.get_object()
        if txn.item.owner != request.user and txn.borrower != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = DisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        machine = TransactionStateMachine(txn)
        try:
            machine.dispute(request.user, serializer.validated_data['reason'])
        except InvalidTransitionError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(txn, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='rating')
    def rating(self, request, pk=None):
        txn = self.get_object()
        if txn.state != TransactionState.CLOSED:
            return Response({'error': 'Can only rate closed transactions'}, status=status.HTTP_400_BAD_REQUEST)

        if txn.item.owner != request.user and txn.borrower != request.user:
            return Response({'error': 'Not a party to this transaction'}, status=status.HTTP_403_FORBIDDEN)

        if Rating.objects.filter(transaction=txn, rater=request.user).exists():
            return Response({'error': 'Already rated'}, status=status.HTTP_400_BAD_REQUEST)

        ratee = txn.borrower if txn.item.owner == request.user else txn.item.owner
        serializer = RatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rating = serializer.save(transaction=txn, rater=request.user, ratee=ratee)

        other_rating = Rating.objects.filter(transaction=txn).exclude(rater=request.user).first()
        if other_rating:
            rating.is_visible = True
            other_rating.is_visible = True
            rating.save(update_fields=['is_visible'])
            other_rating.save(update_fields=['is_visible'])
        else:
            from transactions.tasks import reveal_rating_after_delay
            reveal_rating_after_delay.apply_async((str(rating.id),), countdown=72 * 3600)

        TransactionEvent.objects.create(
            transaction=txn,
            event_type='RATING',
            detail={'rater': str(request.user.id), 'score': rating.average_score},
        )

        return Response(RatingSerializer(rating).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        txn = self.get_object()
        events = TransactionEventSerializer(txn.events.all(), many=True)
        return Response(events.data)


class AdminTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_staff:
            return Transaction.objects.none()
        return Transaction.objects.filter(state=TransactionState.DISPUTED).select_related('borrower', 'item', 'item__owner')

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        txn = self.get_object()
        serializer = AdminDisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resolution = serializer.validated_data['resolution']

        try:
            machine = TransactionStateMachine(txn)
            machine.resolve_dispute(request.user, resolution)

            return Response(TransactionSerializer(txn, context={'request': request}).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)