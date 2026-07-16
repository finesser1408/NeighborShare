import logging
import requests
import time
from django.conf import settings
from django.core.cache import cache
from celery import shared_task
from transactions.models import Transaction, TransactionState

logger = logging.getLogger(__name__)


class EcoCashProvider:
    def __init__(self):
        self.base_url = getattr(settings, 'ECOCASH_API_URL', 'https://sandbox.ecocash.co.zw/api/v2')
        self.merchant_id = getattr(settings, 'ECOCASH_MERCHANT_ID', '')
        self.api_key = getattr(settings, 'ECOCASH_API_KEY', '')
        self.wallet_limit = getattr(settings, 'ECOCASH_WALLET_LIMIT', 50000)

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'X-Merchant-ID': self.merchant_id,
        }

    def split_deposit(self, reference: str, lender_amount: float, borrower_amount: float) -> dict:
        raise NotImplementedError("This method should be implemented in subclasses.")

    def hold_deposit(self, amount: float, phone: str, reference: str) -> dict:
        if amount > self.wallet_limit:
            raise ValueError(f"Amount {amount} exceeds EcoCash wallet limit of {self.wallet_limit}")

        payload = {
            'amount': amount,
            'phone': phone,
            'reference': reference,
            'merchant_id': self.merchant_id,
            'callback_url': f'{settings.SITE_URL}/api/transactions/ecocash/callback',
        }

        for attempt in range(3):
            try:
                response = requests.post(
                    f'{self.base_url}/payments/hold',
                    json=payload,
                    headers=self._headers(),
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()
                logger.info(f"EcoCash hold successful: {reference}")
                return data
            except requests.RequestException as e:
                logger.warning(f"EcoCash hold attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    logger.error(f"EcoCash hold failed after 3 attempts: {reference}")
                    raise
                time.sleep(2 ** attempt)

    def release_deposit(self, reference: str) -> dict:
        payload = {
            'reference': reference,
            'merchant_id': self.merchant_id,
        }

        for attempt in range(3):
            try:
                response = requests.post(
                    f'{self.base_url}/payments/release',
                    json=payload,
                    headers=self._headers(),
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()
                logger.info(f"EcoCash release successful: {reference}")
                return data
            except requests.RequestException as e:
                logger.warning(f"EcoCash release attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    logger.error(f"EcoCash release failed after 3 attempts: {reference}")
                    raise
                time.sleep(2 ** attempt)

    def refund_deposit(self, reference: str) -> dict:
        payload = {
            'reference': reference,
            'merchant_id': self.merchant_id,
        }

        for attempt in range(3):
            try:
                response = requests.post(
                    f'{self.base_url}/payments/refund',
                    json=payload,
                    headers=self._headers(),
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()
                logger.info(f"EcoCash refund successful: {reference}")
                return data
            except requests.RequestException as e:
                logger.warning(f"EcoCash refund attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    logger.error(f"EcoCash refund failed after 3 attempts: {reference}")
                    raise
                time.sleep(2 ** attempt)


class MockEcoCashProvider(EcoCashProvider):
    def hold_deposit(self, amount: float, phone: str, reference: str) -> dict:
        logger.info(f"Mock EcoCash hold: {amount} ZWL for {phone} (ref: {reference})")
        return {'status': 'held', 'reference': reference, 'transaction_id': f'MOCK_{reference}'}

    def release_deposit(self, reference: str) -> dict:
        logger.info(f"Mock EcoCash release: {reference}")
        return {'status': 'released', 'reference': reference}

    def refund_deposit(self, reference: str) -> dict:
        logger.info(f"Mock EcoCash refund: {reference}")
        return {'status': 'refunded', 'reference': reference}

    def split_deposit(self, reference: str, lender_amount: float, borrower_amount: float) -> dict:
        logger.info(f"Mock EcoCash split: {lender_amount} to lender, {borrower_amount} to borrower (ref: {reference})")
        return {'status': 'split', 'reference': reference, 'lender_amount': lender_amount, 'borrower_amount': borrower_amount}