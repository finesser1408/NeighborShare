from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.conf import settings

from transactions.models import Transaction, TransactionState, TransactionEvent
from transactions.serializers import TransactionSerializer, AdminDisputeResolveSerializer
from transactions.state import TransactionStateMachine
from users.models import UserProfile
from users.serializers import UserProfileSerializer


class AdminDisputeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_staff:
            return Transaction.objects.none()
        return Transaction.objects.filter(
            state=TransactionState.DISPUTED
        ).select_related('borrower', 'item', 'item__owner').prefetch_related('events', 'ratings')

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        txn = self.get_object()
        serializer = AdminDisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resolution = serializer.validated_data['resolution']

        try:
            if resolution == 'lender':
                detail = {'resolution': 'lender', 'action': 'resolved_in_favor_of_lender'}
            elif resolution == 'borrower':
                detail = {'resolution': 'borrower', 'action': 'resolved_in_favor_of_borrower'}
            else:
                detail = {'resolution': 'split', 'action': 'resolved_split'}

            machine = TransactionStateMachine(txn)
            machine.resolve_dispute(request.user, resolution)

            TransactionEvent.objects.create(
                transaction=txn,
                event_type='RESOLUTION',
                detail=detail,
            )

            return Response(TransactionSerializer(txn, context={'request': request}).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        txn = self.get_object()
        events = txn.events.all().order_by('created_at')
        ratings = txn.ratings.all()

        timeline = []
        for event in events:
            timeline.append({
                'type': 'event',
                'event_type': event.event_type,
                'detail': event.detail,
                'created_at': event.created_at,
            })
        for rating in ratings:
            timeline.append({
                'type': 'rating',
                'rater': str(rating.rater.id),
                'ratee': str(rating.ratee.id),
                'scores': {
                    'item_condition': rating.item_condition,
                    'communication': rating.communication,
                    'punctuality': rating.punctuality,
                },
                'average': rating.average_score,
                'is_visible': rating.is_visible,
                'created_at': rating.submitted_at,
            })

        timeline.sort(key=lambda x: x['created_at'])
        return Response({'transaction_id': str(txn.id), 'timeline': timeline})


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_staff:
            return UserProfile.objects.none()
        return UserProfile.objects.select_related('user').all()

    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        profile = self.get_object()
        profile.user.is_active = False
        profile.user.save(update_fields=['is_active'])
        profile.is_active = False
        profile.save(update_fields=['is_active'])
        return Response({'status': 'suspended'})

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        profile = self.get_object()
        profile.user.is_active = True
        profile.user.save(update_fields=['is_active'])
        profile.is_active = True
        profile.save(update_fields=['is_active'])
        return Response({'status': 'activated'})


class AdminStatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Count, Avg
        from items.models import Item

        stats = {
            'total_users': UserProfile.objects.count(),
            'verified_users': UserProfile.objects.filter(national_id_verified=True).count(),
            'active_users': UserProfile.objects.filter(is_active=True).count(),
            'total_items': Item.objects.count(),
            'available_items': Item.objects.filter(is_available=True).count(),
            'total_transactions': Transaction.objects.count(),
            'pending_transactions': Transaction.objects.filter(state=TransactionState.PENDING).count(),
            'active_transactions': Transaction.objects.filter(
                state__in=[TransactionState.AGREED, TransactionState.ACTIVE, TransactionState.ITEM_OUT]
            ).count(),
            'disputed_transactions': Transaction.objects.filter(state=TransactionState.DISPUTED).count(),
            'closed_transactions': Transaction.objects.filter(state=TransactionState.CLOSED).count(),
            'avg_trust_score': UserProfile.objects.filter(trust_score__gt=0).aggregate(Avg('trust_score'))['trust_score__avg'],
        }
        return Response(stats)