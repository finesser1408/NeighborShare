import hmac
import hashlib
import secrets
import time
import logging
from typing import Optional
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def generate_handshake_token(txn_id: str, secret_key: str = None) -> str:
    if secret_key is None:
        secret_key = settings.SECRET_KEY

    nonce = secrets.token_hex(8)
    timestamp = int(time.time())
    payload = f'{txn_id}:{timestamp}:{nonce}'

    signature = hmac.new(
        secret_key.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    token = f'{payload}:{signature}'

    # Store the list of user ids that have consumed this token (empty = fresh).
    # Using the cache abstraction (not raw Redis) so the handshake works with
    # LocMemCache in local development and RedisCache in production alike.
    cache_key = f'qr:{token}'
    cache.set(cache_key, [], timeout=1800)

    logger.info(f"Generated QR token for transaction {txn_id}")
    return token


def verify_handshake_token(token: str, secret_key: str = None, user_id=None) -> bool:
    """
    Verify a handshake token.

    Each party (identified by ``user_id``) may consume the token exactly once,
    so the same QR code can be scanned by both the lender and the borrower —
    but a replay by the same party (or a third party) is rejected.

    When ``user_id`` is omitted, the token is single-use as a fallback.
    """
    if secret_key is None:
        secret_key = settings.SECRET_KEY

    try:
        parts = token.split(':')
        if len(parts) != 4:
            logger.warning(f"Invalid token format: {token[:20]}...")
            return False

        txn_id, timestamp_str, nonce, signature = parts
        timestamp = int(timestamp_str)

        payload = f'{txn_id}:{timestamp}:{nonce}'
        expected_signature = hmac.new(
            secret_key.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            logger.warning(f"Invalid signature for token: {token[:20]}...")
            return False

        # Check expiry (30 minutes = 1800 seconds)
        if time.time() - timestamp > 1800:
            logger.warning(f"Token expired: {token[:20]}...")
            return False

        # One-use-per-party check via the cache
        cache_key = f'qr:{token}'
        users = cache.get(cache_key)

        if users is None:
            logger.warning(f"Token not found or expired: {token[:20]}...")
            return False

        if user_id is not None:
            if str(user_id) in users:
                logger.warning(f"Token replay by user {user_id}: {token[:20]}...")
                return False
            # At most two distinct parties may scan the same QR (lender + borrower)
            if len(users) >= 2:
                logger.warning(f"Token exhausted: {token[:20]}...")
                return False
            cache.set(cache_key, list(users) + [str(user_id)], timeout=1800)
        else:
            if users:
                logger.warning(f"Token replay attempt: {token[:20]}...")
                return False
            cache.set(cache_key, ['__used__'], timeout=1800)

        logger.info(f"Verified QR token for transaction {txn_id}")
        return True

    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return False


def parse_token(token: str) -> dict:
    """
    Parse a handshake token and return its components.
    Returns a dict with 'txn_id', 'timestamp', 'nonce', 'signature'.
    Raises ValueError if the token format is invalid.
    """
    parts = token.split(':')
    if len(parts) != 4:
        raise ValueError(f"Invalid token format")
    txn_id, timestamp_str, nonce, signature = parts
    return {
        'txn_id': txn_id,
        'timestamp': int(timestamp_str),
        'nonce': nonce,
        'signature': signature,
    }
