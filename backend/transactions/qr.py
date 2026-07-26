import hmac
import hashlib
import secrets
import time
import logging
from typing import Optional
from django.conf import settings
from django.core.cache import cache
from django_redis import get_redis_connection

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

    cache_key = f'qr:{token}'
    cache.set(cache_key, 'unused', timeout=1800)

    logger.info(f"Generated QR token for transaction {txn_id}")
    return token


def verify_handshake_token(token: str, secret_key: str = None) -> bool:
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

        # Atomic single-use check using Redis GETSET
        cache_key = f'qr:{token}'
        redis_conn = get_redis_connection("default")
        previous = redis_conn.getset(cache_key, 'used')
        
        if previous is None:
            logger.warning(f"Token not found or expired: {token[:20]}...")
            return False
        
        if previous != b'unused':
            logger.warning(f"Token replay attempt: {token[:20]}...")
            return False

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