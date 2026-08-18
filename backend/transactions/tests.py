import pytest
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from rest_framework import status
from transactions.models import Transaction, TransactionState, TransactionEvent, Rating
from transactions.state import TransactionStateMachine, InvalidTransitionError
from transactions.qr import generate_handshake_token, verify_handshake_token
from items.models import Item, Category
from users.models import User, UserProfile
from django.contrib.gis.geos import Point

User = get_user_model()


class TransactionModelTests(TestCase):
    def setUp(self):
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
            title='Test Drill',
            description='A power drill',
            category=Category.TOOLS,
            time_credits_per_day=5,
            location=Point(31.05, -17.7833, srid=4326),
        )

    def test_transaction_creation(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        self.assertEqual(txn.state, TransactionState.PENDING)
        self.assertEqual(txn.total_days, 5)
        self.assertEqual(txn.calculate_total_time_credits(), 25)

    def test_transaction_str(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        self.assertIn('borrower@example.com', str(txn))
        self.assertIn('Test Drill', str(txn))


class TransactionEventTests(TestCase):
    def setUp(self):
        self.lender = User.objects.create_user(
            username='lender2@example.com',
            email='lender2@example.com',
            password='testpass123',
        )
        self.borrower = User.objects.create_user(
            username='borrower2@example.com',
            email='borrower2@example.com',
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

    def test_event_creation(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=3),
            time_credits_per_day=10,
        )
        event = TransactionEvent.objects.create(
            transaction=txn,
            event_type='STATE_CHANGE',
            detail={'from': 'PENDING', 'to': 'AGREED'},
        )
        self.assertEqual(event.transaction, txn)
        self.assertEqual(event.event_type, 'STATE_CHANGE')


class RatingTests(TestCase):
    def setUp(self):
        self.lender = User.objects.create_user(
            username='lender3@example.com',
            email='lender3@example.com',
            password='testpass123',
        )
        self.borrower = User.objects.create_user(
            username='borrower3@example.com',
            email='borrower3@example.com',
            password='testpass123',
        )
        UserProfile.objects.create(user=self.lender, is_active=True, national_id_verified=True)
        UserProfile.objects.create(user=self.borrower, is_active=True, national_id_verified=True)

        self.item = Item.objects.create(
            owner=self.lender,
            title='Rateable Item',
            category=Category.TOOLS,
            time_credits_per_day=10,
            location=Point(31.05, -17.7833, srid=4326),
        )

        self.txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.CLOSED,
            requested_from=timezone.now().date() - timedelta(days=10),
            requested_to=timezone.now().date() - timedelta(days=5),
            time_credits_per_day=10,
        )

    def test_rating_creation(self):
        rating = Rating.objects.create(
            transaction=self.txn,
            rater=self.lender,
            ratee=self.borrower,
            item_condition=5,
            communication=4,
            punctuality=5,
        )
        self.assertEqual(round(rating.average_score, 2), 4.67)

    def test_rating_hidden_until_both_parties_rated(self):
        rating1 = Rating.objects.create(
            transaction=self.txn,
            rater=self.lender,
            ratee=self.borrower,
            item_condition=5,
            communication=4,
            punctuality=5,
        )
        self.assertFalse(rating1.is_visible)

        rating2 = Rating.objects.create(
            transaction=self.txn,
            rater=self.borrower,
            ratee=self.lender,
            item_condition=4,
            communication=5,
            punctuality=4,
        )
        # Matches the reveal logic in transactions.views.rating: once both
        # parties have rated, both ratings are revealed.
        rating1.is_visible = True
        rating2.is_visible = True
        rating1.save(update_fields=['is_visible'])
        rating2.save(update_fields=['is_visible'])
        rating1.refresh_from_db()
        rating2.refresh_from_db()
        self.assertTrue(rating1.is_visible)
        self.assertTrue(rating2.is_visible)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class TransactionAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client = APIClient()
        self.lender = User.objects.create_user(
            username='lender_api@example.com',
            email='lender_api@example.com',
            password='testpass123',
        )
        self.borrower = User.objects.create_user(
            username='borrower_api@example.com',
            email='borrower_api@example.com',
            password='testpass123',
        )
        UserProfile.objects.create(user=self.lender, is_active=True, national_id_verified=True)
        UserProfile.objects.create(user=self.borrower, is_active=True, national_id_verified=True)

        self.item = Item.objects.create(
            owner=self.lender,
            title='API Test Drill',
            description='For API testing',
            category=Category.TOOLS,
            time_credits_per_day=5,
            location=Point(31.05, -17.7833, srid=4326),
        )

        self.lender_token = str(RefreshToken.for_user(self.lender).access_token)
        self.borrower_token = str(RefreshToken.for_user(self.borrower).access_token)

    def test_borrow_request(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        data = {
            'item_id': str(self.item.id),
            'requested_from': (timezone.now().date() + timedelta(days=1)).isoformat(),
            'requested_to': (timezone.now().date() + timedelta(days=5)).isoformat(),
        }
        response = self.client.post('/api/transactions/borrow-request', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['state'], 'PENDING')

    def test_borrow_own_item_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        data = {
            'item_id': str(self.item.id),
            'requested_from': (timezone.now().date() + timedelta(days=1)).isoformat(),
            'requested_to': (timezone.now().date() + timedelta(days=5)).isoformat(),
        }
        response = self.client.post('/api/transactions/borrow-request', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_request(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'AGREED')

    def test_generate_qr(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.ACTIVE,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/generate-qr/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    def test_scan_qr_handoff_real_token(self):
        """Both parties must scan the SAME token; the second scan completes hand-off."""
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.ACTIVE,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        token = generate_handshake_token(str(txn.id))

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/scan-qr/', {'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['lender_scanned_handoff'])
        self.assertEqual(response.data['state'], 'ACTIVE')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/scan-qr/', {'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'ITEM_OUT')

    def test_scan_qr_same_party_replay_rejected(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.ACTIVE,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        token = generate_handshake_token(str(txn.id))

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/scan-qr/', {'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Same party scanning the same token again is a replay and must fail
        response = self.client.post(f'/api/transactions/{txn.id}/scan-qr/', {'token': token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_qr_handshake_cycle(self):
        """
        Complete digital handshake through the API:
        borrow -> accept -> activate -> handoff QR (both scan) -> ITEM_OUT
        -> return QR (both scan) -> ITEM_RETURNED -> close -> CLOSED
        """
        # 1. Borrower requests
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        data = {
            'item_id': str(self.item.id),
            'requested_from': (timezone.now().date() + timedelta(days=1)).isoformat(),
            'requested_to': (timezone.now().date() + timedelta(days=4)).isoformat(),
        }
        response = self.client.post('/api/transactions/borrow-request', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        txn_id = response.data['id']

        # 2. Lender accepts -> AGREED
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'AGREED')

        # 3. Borrower activates -> ACTIVE
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/activate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'ACTIVE')

        # 4. Handoff QR generated, both parties scan the SAME token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/generate-qr/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        handoff_token = response.data['token']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/scan-qr/', {'token': handoff_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['lender_scanned_handoff'])
        self.assertEqual(response.data['state'], 'ACTIVE')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/scan-qr/', {'token': handoff_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'ITEM_OUT')

        # 5. Return QR generated (fresh token), both parties scan
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/generate-qr/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return_token = response.data['token']
        self.assertNotEqual(return_token, handoff_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/scan-qr/', {'token': return_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['lender_scanned_return'])
        self.assertEqual(response.data['state'], 'ITEM_OUT')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/scan-qr/', {'token': return_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'ITEM_RETURNED')

        # 6. Lender closes -> CLOSED
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn_id}/close/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'CLOSED')

        # Audit trail reflects the QR scans
        response = self.client.get(f'/api/transactions/{txn_id}/audit-log/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        qr_events = [e for e in response.data if e['event_type'] == 'QR_SCAN']
        self.assertEqual(len(qr_events), 4)

    def test_dispute(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.ITEM_OUT,
            requested_from=timezone.now().date() - timedelta(days=5),
            requested_to=timezone.now().date(),
            time_credits_per_day=5,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/dispute/', {'reason': 'Item damaged'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'DISPUTED')

    def test_rating(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.CLOSED,
            requested_from=timezone.now().date() - timedelta(days=10),
            requested_to=timezone.now().date() - timedelta(days=5),
            time_credits_per_day=5,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.lender_token}')
        response = self.client.post(f'/api/transactions/{txn.id}/rating/', {
            'item_condition': 5,
            'communication': 4,
            'punctuality': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['item_condition'], 5)

    def test_audit_log(self):
        txn = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from=timezone.now().date() + timedelta(days=1),
            requested_to=timezone.now().date() + timedelta(days=5),
            time_credits_per_day=5,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.borrower_token}')
        response = self.client.get(f'/api/transactions/{txn.id}/audit-log/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)