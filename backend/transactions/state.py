from django.core.exceptions import ValidationError
from transactions.models import Transaction, TransactionState, TransactionEvent


class InvalidTransitionError(Exception):
    pass


class TransactionStateMachine:
    ALLOWED_TRANSITIONS = {
        TransactionState.PENDING: [TransactionState.ACCEPTED, TransactionState.DISPUTED],
        TransactionState.ACCEPTED: [TransactionState.DEPOSIT_HELD, TransactionState.DISPUTED],
        TransactionState.DEPOSIT_HELD: [TransactionState.ITEM_OUT, TransactionState.DISPUTED],
        TransactionState.ITEM_OUT: [TransactionState.ITEM_RETURNED, TransactionState.DISPUTED],
        TransactionState.ITEM_RETURNED: [TransactionState.CLOSED, TransactionState.DISPUTED],
        TransactionState.CLOSED: [],
        TransactionState.DISPUTED: [TransactionState.CLOSED],
    }

    def __init__(self, transaction: Transaction):
        self.transaction = transaction

    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        return to_state in cls.ALLOWED_TRANSITIONS.get(from_state, [])

    @classmethod
    def transition(cls, transaction: Transaction, new_state: str, user=None, detail=None):
        if not cls.can_transition(transaction.state, new_state):
            raise InvalidTransitionError(
                f"Invalid transition from {transaction.state} to {new_state}"
            )

        old_state = transaction.state
        transaction.state = new_state
        transaction.save(update_fields=['state', 'updated_at'])

        TransactionEvent.objects.create(
            transaction=transaction,
            event_type='STATE_CHANGE',
            detail={
                'from_state': old_state,
                'to_state': new_state,
                'user_id': str(user.id) if user else None,
                'detail': detail,
            },
        )

        if new_state == TransactionState.CLOSED:
            from transactions.tasks import release_deposit
            release_deposit.delay(str(transaction.id))
        elif new_state == TransactionState.DISPUTED:
            from transactions.tasks import flag_for_admin_review
            flag_for_admin_review.delay(str(transaction.id))

        return transaction

    # Convenience instance methods used by views
    def accept(self, user):
        return self.transition(self.transaction, TransactionState.ACCEPTED, user, {'action': 'accepted'})

    def handoff(self, user):
        return self.transition(self.transaction, TransactionState.ITEM_OUT, user, {'action': 'handoff_confirmed'})

    def return_item(self, user):
        return self.transition(self.transaction, TransactionState.ITEM_RETURNED, user, {'action': 'return_confirmed'})

    def dispute(self, user, reason=None):
        return self.transition(self.transaction, TransactionState.DISPUTED, user, {'action': 'disputed', 'reason': reason})

    def resolve_dispute(self, user, resolution):
        return self.transition(self.transaction, TransactionState.CLOSED, user, {'action': 'dispute_resolved', 'resolution': resolution})
