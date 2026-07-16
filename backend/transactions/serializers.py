from rest_framework import serializers
from .models import Transaction, TransactionEvent, Rating, TransactionState
from items.serializers import ItemSerializer
from users.serializers import UserProfileSerializer


class TransactionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionEvent
        fields = ['id', 'event_type', 'detail', 'created_at']
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)
    borrower = UserProfileSerializer(read_only=True)
    lender = UserProfileSerializer(source='item.owner.profile', read_only=True)
    events = TransactionEventSerializer(many=True, read_only=True)
    total_days = serializers.IntegerField(read_only=True)
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'borrower', 'item', 'lender', 'state', 'requested_from',
            'requested_to', 'deposit_amount', 'daily_rate', 'escrow_reference',
            'lender_scanned_handoff', 'borrower_scanned_handoff',
            'lender_scanned_return', 'borrower_scanned_return',
            'total_days', 'total_cost', 'events', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class BorrowRequestSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    requested_from = serializers.DateField()
    requested_to = serializers.DateField()

    def validate(self, attrs):
        from items.models import Item
        from django.utils import timezone

        try:
            item = Item.objects.get(id=attrs['item_id'])
        except Item.DoesNotExist:
            raise serializers.ValidationError('Item not found')

        if not item.is_available:
            raise serializers.ValidationError('Item is not available')

        if attrs['requested_from'] < timezone.now().date():
            raise serializers.ValidationError('Start date cannot be in the past')

        if attrs['requested_to'] <= attrs['requested_from']:
            raise serializers.ValidationError('End date must be after start date')

        attrs['item'] = item
        return attrs


class QRGenerateSerializer(serializers.Serializer):
    pass


class QRScanSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)


class DisputeSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = [
            'id', 'transaction', 'rater', 'ratee',
            'item_condition', 'communication', 'punctuality',
            'submitted_at', 'is_visible',
        ]
        read_only_fields = ['rater', 'ratee', 'submitted_at', 'is_visible']

    def validate(self, attrs):
        for field in ['item_condition', 'communication', 'punctuality']:
            value = attrs.get(field)
            if value is not None and (value < 1 or value > 5):
                raise serializers.ValidationError({field: 'Must be between 1 and 5'})
        return attrs


class AdminDisputeResolveSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=['lender', 'borrower', 'split'])