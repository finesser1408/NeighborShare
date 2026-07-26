from celery import shared_task
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from django.db import transaction
from transactions.models import Transaction, TransactionState, TransactionEvent, Rating
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def award_time_credits(self, transaction_id: str):
    """
    Award Community Time Credits to both parties upon successful transaction completion.
    This replaces the monetary deposit release mechanism.
    """
    try:
        txn = Transaction.objects.select_for_update().get(id=transaction_id)
    except Transaction.DoesNotExist:
        logger.error(f"Transaction {transaction_id} not found for time credit award")
        return

    if txn.state != TransactionState.CLOSED:
        logger.warning(f"Transaction {transaction_id} not in CLOSED state, skipping time credit award")
        return

    try:
        with transaction.atomic():
            # Award time credits to lender (for sharing)
            lender = txn.item.owner
            lender.trust_score += txn.total_time_credits * 0.5
            lender.save(update_fields=['trust_score'])

            # Award time credits to borrower (for responsible borrowing)
            borrower = txn.borrower
            borrower.trust_score += txn.total_time_credits * 0.3
            borrower.save(update_fields=['trust_score'])

            TransactionEvent.objects.create(
                transaction=txn,
                event_type='TIME_CREDIT',
                detail={
                    'action': 'awarded',
                    'lender_credits': txn.total_time_credits * 0.5,
                    'borrower_credits': txn.total_time_credits * 0.3,
                    'total_credits': txn.total_time_credits,
                },
            )
            logger.info(f"Time credits awarded for transaction {transaction_id}")
    except Exception as e:
        logger.error(f"Failed to award time credits for {transaction_id}: {e}")
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
