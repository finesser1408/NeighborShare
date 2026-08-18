"""
Email verification using Django's built-in mail system.

A 6-digit one-time code is generated per user, stored (hashed) in the cache
with a short TTL, and delivered via ``django.core.mail.send_mail``. The code
is verified against the hash with a constant-time comparison.
"""
import hashlib
import hmac
import logging
import secrets

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

_CACHE_KEY = 'email_verify:{user_id}'
_CODE_LENGTH = 6


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_verification_code() -> str:
    """Return a random 6-digit code (zero-padded)."""
    return f"{secrets.randbelow(10 ** _CODE_LENGTH):0{_CODE_LENGTH}d}"


def store_verification_code(user_id, code: str) -> None:
    """Store the hashed code for a user with the configured TTL."""
    cache.set(
        _CACHE_KEY.format(user_id=user_id),
        _hash_code(code),
        timeout=getattr(settings, 'EMAIL_VERIFICATION_TIMEOUT', 30 * 60),
    )


def get_verification_code(user_id) -> str:
    """Return the stored code hash (or None when missing/expired)."""
    return cache.get(_CACHE_KEY.format(user_id=user_id))


def clear_verification_code(user_id) -> None:
    cache.delete(_CACHE_KEY.format(user_id=user_id))


def send_verification_email(user) -> str:
    """
    Generate, store and email a verification code for ``user``.

    Returns the plaintext code (used only for logging in development).
    """
    code = generate_verification_code()
    store_verification_code(user.id, code)

    site_url = getattr(settings, 'SITE_URL', 'http://localhost:8000')
    subject = 'NeighbourShare — Verify your email address'
    message = (
        f"Hi {user.first_name or 'there'},\n\n"
        f"Welcome to NeighbourShare! Your email verification code is:\n\n"
        f"    {code}\n\n"
        f"Enter this code to confirm your email address. It expires in 30 minutes.\n\n"
        f"If you did not create an account, you can safely ignore this email.\n\n"
        f"— The NeighbourShare Team"
    )
    try:
        send_mail(
            subject,
            message,
            getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            [user.email],
            fail_silently=False,
        )
        logger.info(f"Verification email sent to {user.email} (code {code})")
    except Exception as e:  # pragma: no cover - SMTP failures shouldn't break registration silently
        logger.error(f"Failed to send verification email to {user.email}: {e}")
        raise

    return code


def verify_verification_code(user_id, code: str) -> bool:
    """Verify a submitted code against the stored hash (constant-time)."""
    if not code:
        return False
    stored = get_verification_code(user_id)
    if stored is None:
        return False
    if not hmac.compare_digest(stored, _hash_code(str(code).strip())):
        return False
    clear_verification_code(user_id)
    return True
