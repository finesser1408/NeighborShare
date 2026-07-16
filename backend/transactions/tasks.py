from celery import shared_task
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from transactions.models import Transaction, TransactionState, TransactionEvent, Rating
from transactions.escrow import EcoCashProvider, MockEcoCashProvider
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def release_deposit(self, transaction_id: str):
    try:
        transaction = Transaction.objects.get(id=transaction_id)
    except Transaction.DoesNotExist:
        logger.error(f"Transaction {transaction_id} not found for deposit release")
        return

    if transaction.state != TransactionState.CLOSED:
        logger.warning(f"Transaction {transaction_id} not in CLOSED state, skipping release")
        return

    provider = MockEcoCashProvider() if settings.DEBUG else EcoCashProvider()

    try:
        result = provider.release_deposit(transaction.escrow_reference)
        TransactionEvent.objects.create(
            transaction=transaction,
            event_type='PAYMENT',
            detail={'action': 'release', 'result': result},
        )
        logger.info(f"Deposit released for transaction {transaction_id}")
    except Exception as e:
        logger.error(f"Failed to release deposit for {transaction_id}: {e}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def flag_for_admin_review(self, transaction_id: str):
    try:
        transaction = Transaction.objects.get(id=transaction_id)
    except Transaction.DoesNotExist:
        logger.error(f"Transaction {transaction_id} not found for dispute flagging")
        return

    TransactionEvent.objects.create(
        transaction=transaction,
        event_type='DISPUTE',
        detail={'action': 'flagged_for_review', 'timestamp': timezone.now().isoformat()},
    )
    logger.info(f"Transaction {transaction_id} flagged for admin review")


@shared_task
def cleanup_expired_qr_tokens():
    from django.core.cache import cache
    logger.info("Cleaning up expired QR tokens (handled by Redis TTL)")


@shared_task
def check_expired_transactions():
    timeout = timezone.now() - timedelta(hours=24)
    pending = Transaction.objects.filter(
        state=TransactionState.PENDING,
        updated_at__lt=timeout,
    )
    for txn in pending:
        txn.state = TransactionState.DISPUTED
        txn.save(update_fields=['state', 'updated_at'])
        TransactionEvent.objects.create(
            transaction=txn,
            event_type='DISPUTE',
            detail={'reason': 'auto_expired', 'timeout_hours': 24},
        )
        flag_for_admin_review.delay(str(txn.id))
    logger.info(f"Expired {pending.count()} pending transactions")


@shared_task
def check_pending_ecocash_transactions():
    pending = Transaction.objects.filter(
        state=TransactionState.ACCEPTED,
        escrow_reference__isnull=False,
    )
    for txn in pending:
        logger.info(f"Checking EcoCash status for {txn.id}")


@shared_task(bind=True, max_retries=3)
def retry_ecocash_operation(self, transaction_id: str, operation: str):
    try:
        transaction = Transaction.objects.get(id=transaction_id)
    except Transaction.DoesNotExist:
        return

    provider = MockEcoCashProvider() if settings.DEBUG else EcoCashProvider()

    try:
        if operation == 'hold':
            provider.hold_deposit(
                float(transaction.deposit_amount),
                transaction.borrower.profile.phone_number,
                transaction.escrow_reference,
            )
        elif operation == 'release':
            provider.release_deposit(transaction.escrow_reference)
        elif operation == 'refund':
            provider.refund_deposit(transaction.escrow_reference)
    except Exception as e:
        logger.error(f"EcoCash {operation} retry failed for {transaction_id}: {e}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task
def reveal_rating_after_delay(rating_id: str):
    """
    Task triggered if only one party has submitted a rating.
    Automatically reveals it after the 72-hour delay.
    """
    try:
        rating = Rating.objects.get(id=rating_id)
        if not rating.is_visible:
            rating.is_visible = True
            rating.save(update_fields=['is_visible'])
            
            # If the other rating exists, reveal it too
            other = Rating.objects.filter(transaction=rating.transaction).exclude(id=rating_id).first()
            if other and not other.is_visible:
                other.is_visible = True
                other.save(update_fields=['is_visible'])
            logger.info(f"Revealed rating {rating_id} after delay.")
    except Rating.DoesNotExist:
        logger.error(f"Rating {rating_id} not found for delay reveal")