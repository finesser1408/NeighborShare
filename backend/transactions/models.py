from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.gis.db import models as gis_models
from django.conf import settings
import uuid

User = get_user_model()


class TransactionState(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    AGREED = 'AGREED', 'Agreed'
    ACTIVE = 'ACTIVE', 'Active'
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
    time_credits_per_day = models.PositiveIntegerField(default=1)
    total_time_credits = models.PositiveIntegerField(default=0)
    lender_scanned_handoff = models.BooleanField(default=False)
    borrower_scanned_handoff = models.BooleanField(default=False)
    lender_scanned_return = models.BooleanField(default=False)
    borrower_scanned_return = models.BooleanField(default=False)
    
    # Condition capture at hand-off and return (Digital Handshake protocol)
    handoff_condition = models.TextField(blank=True, help_text='Item condition recorded at hand-off')
    return_condition = models.TextField(blank=True, help_text='Item condition recorded at return')
    
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

    def calculate_total_time_credits(self):
        return self.time_credits_per_day * self.total_days

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
        ('TIME_CREDIT', 'Time Credit'),
        ('DISPUTE', 'Dispute'),
        ('RATING', 'Rating'),
        ('MESSAGE', 'Message'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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


class DisputeResolution(models.Model):
    """Tracks structured dispute resolution workflow"""
    DISPUTE_STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('UNDER_REVIEW', 'Under Review'),
        ('PENDING_EVIDENCE', 'Pending Evidence'),
        ('RESOLVED', 'Resolved'),
        ('ESCALATED', 'Escalated'),
    ]
    
    RESOLUTION_OUTCOME_CHOICES = [
        ('LENDER_FAVOR', 'Lender Favor'),
        ('BORROWER_FAVOR', 'Borrower Favor'),
        ('SPLIT_CREDITS', 'Split Credits'),
        ('CANCELLED', 'Cancelled'),
        ('ESCALATED_EXTERNAL', 'Escalated to External'),
    ]
    
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name='dispute_resolution')
    status = models.CharField(max_length=20, choices=DISPUTE_STATUS_CHOICES, default='OPEN')
    outcome = models.CharField(max_length=30, choices=RESOLUTION_OUTCOME_CHOICES, null=True, blank=True)
    
    # Reviewer assignment
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_disputes')
    assigned_at = models.DateTimeField(null=True, blank=True)
    
    # Resolution details
    resolution_notes = models.TextField(blank=True)
    evidence_summary = models.TextField(blank=True)
    
    # Timestamps
    opened_at = models.DateTimeField(auto_now_add=True)
    first_reviewed_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    # Audit trail
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_disputes')
    
    class Meta:
        db_table = 'dispute_resolutions'
        ordering = ['-opened_at']
    
    def __str__(self):
        return f"Dispute for {self.transaction.id} - {self.status}"