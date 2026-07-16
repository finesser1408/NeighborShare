from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.gis.db import models as gis_models
from django.conf import settings
import uuid

User = get_user_model()


class TransactionState(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    DEPOSIT_HELD = 'DEPOSIT_HELD', 'Deposit Held'
    ITEM_OUT = 'ITEM_OUT', 'Item Out'
    ITEM_RETURNED = 'ITEM_RETURNED', 'Item Returned'
    CLOSED = 'CLOSED', 'Closed'
    DISPUTED = 'DISPUTED', 'Disputed'


class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='borrowed_transactions')
    item = models.ForeignKey('items.Item', on_delete=models.CASCADE, related_name='transactions')
    state = models.CharField(max_length=20, choices=TransactionState.choices, default=TransactionState.PENDING)
    requested_from = models.DateField()
    requested_to = models.DateField()
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2)
    escrow_reference = models.CharField(max_length=100, blank=True)
    lender_scanned_handoff = models.BooleanField(default=False)
    borrower_scanned_handoff = models.BooleanField(default=False)
    lender_scanned_return = models.BooleanField(default=False)
    borrower_scanned_return = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transactions'
        indexes = [
            models.Index(fields=['borrower', 'state']),
            models.Index(fields=['item', 'state']),
            models.Index(fields=['state', 'updated_at']),
        ]

    def __str__(self):
        return f"{self.borrower.email} - {self.item.title} ({self.state})"

    @property
    def total_days(self):
        return (self.requested_to - self.requested_from).days + 1

    @property
    def total_cost(self):
        return self.daily_rate * self.total_days

    def can_transition_to(self, new_state: str) -> bool:
        from transactions.state import TransactionStateMachine
        return TransactionStateMachine.can_transition(self.state, new_state)

    def transition_to(self, new_state: str, user=None, detail=None):
        from transactions.state import TransactionStateMachine, InvalidTransitionError
        TransactionStateMachine.transition(self, new_state, user, detail)


class TransactionEvent(models.Model):
    EVENT_TYPES = [
        ('STATE_CHANGE', 'State Change'),
        ('QR_SCAN', 'QR Scan'),
        ('PAYMENT', 'Payment'),
        ('DISPUTE', 'Dispute'),
        ('RATING', 'Rating'),
        ('MESSAGE', 'Message'),
    ]

    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    detail = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transaction_events'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.transaction.id} - {self.event_type}"


class Rating(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='ratings')
    rater = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_given')
    ratee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ratings_received')
    item_condition = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    communication = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    punctuality = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_visible = models.BooleanField(default=False)

    class Meta:
        db_table = 'ratings'
        unique_together = ['transaction', 'rater']

    def __str__(self):
        return f"{self.rater.email} rated {self.ratee.email} for {self.transaction.item.title}"

    @property
    def average_score(self):
        return (self.item_condition + self.communication + self.punctuality) / 3