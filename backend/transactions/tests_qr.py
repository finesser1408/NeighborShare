import pytest
from django.test import TestCase
from django.core.cache import cache
from transactions.qr import generate_handshake_token, verify_handshake_token, parse_token
from transactions.models import Transaction, TransactionState
from users.models import User, UserProfile
from items.models import Item, Category
from django.contrib.gis.geos import Point
import time


class QRTokenTests(TestCase):
    def setUp(self):
        cache.clear()
        self.lender = User.objects.create_user(
            username='lender@example.com',
            email='lender@example.com',
            password='testpass123',
        )
        self.borrower = User.objects.create_user(
            username='borrower@example.com',
            email='borrower@example.com',
            password='testpass123',
        )
        UserProfile.objects.create(user=self.lender, is_active=True, national_id_verified=True)
        UserProfile.objects.create(user=self.borrower, is_active=True, national_id_verified=True)

        self.item = Item.objects.create(
            owner=self.lender,
            title='Test Item',
            category=Category.TOOLS,
            time_credits_per_day=10,
            location=Point(31.05, -17.7833, srid=4326),
        )

        self.transaction = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.ACTIVE,
            requested_from='2024-01-10',
            requested_to='2024-01-15',
            time_credits_per_day=10,
            total_time_credits=60,
        )

    def test_generate_token_format(self):
        token = generate_handshake_token(str(self.transaction.id))
        parts = token.split(':')
        self.assertEqual(len(parts), 4)
        self.assertEqual(parts[0], str(self.transaction.id))
        self.assertTrue(len(parts[1]) > 0)
        self.assertEqual(len(parts[2]), 16)
        self.assertEqual(len(parts[3]), 64)

    def test_verify_valid_token(self):
        token = generate_handshake_token(str(self.transaction.id))
        result = verify_handshake_token(token, user_id=self.lender.id)
        self.assertTrue(result)

    def test_same_token_usable_by_both_parties(self):
        token = generate_handshake_token(str(self.transaction.id))
        self.assertTrue(verify_handshake_token(token, user_id=self.lender.id))
        self.assertTrue(verify_handshake_token(token, user_id=self.borrower.id))

    def test_replay_by_same_party_rejected(self):
        token = generate_handshake_token(str(self.transaction.id))
        verify_handshake_token(token, user_id=self.lender.id)
        result = verify_handshake_token(token, user_id=self.lender.id)
        self.assertFalse(result)

    def test_third_party_rejected_after_both_parties(self):
        token = generate_handshake_token(str(self.transaction.id))
        verify_handshake_token(token, user_id=self.lender.id)
        verify_handshake_token(token, user_id=self.borrower.id)
        third = User.objects.create_user(
            username='third@example.com',
            email='third@example.com',
            password='testpass123',
        )
        result = verify_handshake_token(token, user_id=third.id)
        self.assertFalse(result)

    def test_single_use_without_user_id(self):
        token = generate_handshake_token(str(self.transaction.id))
        self.assertTrue(verify_handshake_token(token))
        self.assertFalse(verify_handshake_token(token))

    def test_verify_tampered_signature(self):
        token = generate_handshake_token(str(self.transaction.id))
        parts = token.split(':')
        tampered = f"{parts[0]}:{parts[1]}:{parts[2]}:invalid_signature"
        result = verify_handshake_token(tampered, user_id=self.lender.id)
        self.assertFalse(result)

    def test_verify_wrong_transaction_id(self):
        token = generate_handshake_token(str(self.transaction.id))
        parts = token.split(':')
        wrong_txn = f"wrong-id:{parts[1]}:{parts[2]}:{parts[3]}"
        result = verify_handshake_token(wrong_txn, user_id=self.lender.id)
        self.assertFalse(result)

    def test_verify_expired_token(self):
        token = generate_handshake_token(str(self.transaction.id))
        cache.delete(f'qr:{token}')
        result = verify_handshake_token(token, user_id=self.lender.id)
        self.assertFalse(result)

    def test_verify_malformed_token(self):
        result = verify_handshake_token('invalid:token:format', user_id=self.lender.id)
        self.assertFalse(result)

    def test_verify_empty_token(self):
        result = verify_handshake_token('', user_id=self.lender.id)
        self.assertFalse(result)

    def test_token_uses_hmac_sha256(self):
        token = generate_handshake_token(str(self.transaction.id))
        parts = token.split(':')
        self.assertEqual(len(parts[3]), 64)

    def test_token_includes_timestamp(self):
        before = int(time.time())
        token = generate_handshake_token(str(self.transaction.id))
        after = int(time.time())
        parts = token.split(':')
        timestamp = int(parts[1])
        self.assertGreaterEqual(timestamp, before)
        self.assertLessEqual(timestamp, after)

    def test_token_includes_nonce(self):
        token = generate_handshake_token(str(self.transaction.id))
        parts = token.split(':')
        nonce = parts[2]
        self.assertEqual(len(nonce), 16)
        self.assertTrue(all(c in '0123456789abcdef' for c in nonce))

    def test_different_tokens_for_same_transaction(self):
        token1 = generate_handshake_token(str(self.transaction.id))
        token2 = generate_handshake_token(str(self.transaction.id))
        self.assertNotEqual(token1, token2)
        self.assertTrue(verify_handshake_token(token1, user_id=self.lender.id))
        self.assertTrue(verify_handshake_token(token2, user_id=self.lender.id))

    def test_custom_secret_key(self):
        token = generate_handshake_token(str(self.transaction.id), 'custom-secret')
        result = verify_handshake_token(token, 'custom-secret', user_id=self.lender.id)
        self.assertTrue(result)
        result = verify_handshake_token(token, 'wrong-secret', user_id=self.lender.id)
        self.assertFalse(result)

    def test_parse_token_roundtrip(self):
        token = generate_handshake_token(str(self.transaction.id))
        parsed = parse_token(token)
        self.assertEqual(parsed['txn_id'], str(self.transaction.id))
        self.assertEqual(len(parsed['signature']), 64)

    def test_parse_token_invalid(self):
        with self.assertRaises(ValueError):
            parse_token('bad:token')
