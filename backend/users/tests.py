import pytest
from django.contrib.gis.geos import Point
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User, UserProfile
from users.verification import MockVerificationProvider, NominatimProvider
import hashlib
from unittest.mock import patch, MagicMock


class UserModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='test@example.com',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
        )
        self.profile = UserProfile.objects.create(user=self.user)

    def test_hash_national_id(self):
        national_id = '12-345678A90'
        hashed = self.profile.hash_national_id(national_id)
        expected = hashlib.sha256(national_id.encode()).hexdigest()
        self.assertEqual(hashed, expected)

    def test_verify_national_id_success(self):
        national_id = '12-345678A90'
        result = self.profile.verify_national_id(national_id)
        self.assertTrue(result)
        self.assertTrue(self.profile.national_id_verified)
        self.assertEqual(self.profile.trust_score, 50)
        self.assertEqual(self.profile.registration_step, 3)

    def test_verify_national_id_duplicate_fails(self):
        national_id = '12-345678A90'
        self.profile.verify_national_id(national_id)

        user2 = User.objects.create_user(
            username='test2@example.com',
            email='test2@example.com',
            password='testpass123',
        )
        profile2 = UserProfile.objects.create(user=user2)
        result = profile2.verify_national_id(national_id)
        self.assertFalse(result)

    def test_update_trust_score(self):
        self.profile.update_trust_score(75.5)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.trust_score, 75.5)


class VerificationProviderTests(TestCase):
    def test_mock_provider_verify(self):
        provider = MockVerificationProvider()
        result = provider.verify('12-345678A90')
        self.assertTrue(result)

    @patch('users.verification.requests.get')
    def test_nominatim_provider_geocode_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = [{
            'lat': '-17.7833',
            'lon': '31.05',
            'display_name': '123 Main St, Belvedere, Harare, Zimbabwe',
        }]
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        provider = NominatimProvider()
        result = provider.geocode('123 Main St, Belvedere, Harare, Zimbabwe')
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result['lat'], -17.7833, places=4)
        self.assertAlmostEqual(result['lon'], 31.05, places=4)

    @patch('users.verification.requests.get')
    def test_nominatim_provider_geocode_failure(self, mock_get):
        mock_get.side_effect = Exception("Network error")
        provider = NominatimProvider()
        result = provider.geocode('Invalid Address')
        self.assertIsNone(result)


class RegistrationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_step1_valid_registration(self):
        data = {
            'full_name': 'John Doe',
            'email': 'john@example.com',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }
        response = self.client.post('/api/auth/register', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user_id', response.data)
        self.assertIn('verification code', response.data['message'].lower())

    def test_step1_sends_verification_email(self):
        from django.core import mail
        data = {
            'full_name': 'John Doe',
            'email': 'john@example.com',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }
        self.client.post('/api/auth/register', data, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['john@example.com'])
        self.assertIn('verification code', mail.outbox[0].body.lower())

    def test_verify_email_success(self):
        user = User.objects.create_user(
            username='v@example.com',
            email='v@example.com',
            password='testpass123',
            is_active=False,
        )
        profile = UserProfile.objects.create(user=user, registration_step=1)

        from users.email_verify import store_verification_code
        store_verification_code(user.id, '123456')

        response = self.client.post('/api/auth/verify-email', {
            'user_id': str(user.id),
            'code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertTrue(profile.email_verified)
        self.assertEqual(profile.registration_step, 2)

    def test_verify_email_wrong_code(self):
        user = User.objects.create_user(
            username='w@example.com',
            email='w@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=1)

        from users.email_verify import store_verification_code
        store_verification_code(user.id, '123456')

        response = self.client.post('/api/auth/verify-email', {
            'user_id': str(user.id),
            'code': '999999',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.profile.refresh_from_db()
        self.assertFalse(user.profile.email_verified)

    def test_resend_verification_sends_new_email(self):
        from django.core import mail
        user = User.objects.create_user(
            username='r@example.com',
            email='r@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=1)

        response = self.client.post('/api/auth/resend-verification', {
            'user_id': str(user.id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_step2_blocked_without_email_verification(self):
        user = User.objects.create_user(
            username='blocked@example.com',
            email='blocked@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=1)

        data = {
            'user_id': user.id,
            'national_id': '12-345678A90',
        }
        response = self.client.post('/api/auth/verify-id', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_step1_invalid_email(self):
        data = {
            'full_name': 'John Doe',
            'email': 'invalid-email',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }
        response = self.client.post('/api/auth/register', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_step1_password_mismatch(self):
        data = {
            'full_name': 'John Doe',
            'email': 'john@example.com',
            'password': 'securepass123',
            'confirm_password': 'differentpass',
        }
        response = self.client.post('/api/auth/register', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_step1_duplicate_email(self):
        User.objects.create_user(
            username='existing@example.com',
            email='existing@example.com',
            password='testpass123',
        )
        data = {
            'full_name': 'John Doe',
            'email': 'existing@example.com',
            'password': 'securepass123',
            'confirm_password': 'securepass123',
        }
        response = self.client.post('/api/auth/register', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_step2_valid_national_id(self):
        user = User.objects.create_user(
            username='step2@example.com',
            email='step2@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=2, email_verified=True)

        data = {
            'user_id': user.id,
            'national_id': '12-345678A90',
        }
        response = self.client.post('/api/auth/verify-id', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['trust_score'], 50)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.registration_step, 3)

    def test_step2_invalid_national_id_format(self):
        user = User.objects.create_user(
            username='step2b@example.com',
            email='step2b@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=2, email_verified=True)

        data = {
            'user_id': user.id,
            'national_id': 'invalid-format',
        }
        response = self.client.post('/api/auth/verify-id', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_step2_duplicate_national_id(self):
        user1 = User.objects.create_user(
            username='dup1@example.com',
            email='dup1@example.com',
            password='testpass123',
            is_active=False,
        )
        profile1 = UserProfile.objects.create(user=user1, registration_step=2, email_verified=True)
        profile1.verify_national_id('12-345678A90')

        user2 = User.objects.create_user(
            username='dup2@example.com',
            email='dup2@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user2, registration_step=2, email_verified=True)

        data = {
            'user_id': user2.id,
            'national_id': '12-345678A90',
        }
        response = self.client.post('/api/auth/verify-id', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views.NominatimProvider.geocode')
    def test_step3_valid_address(self, mock_geocode):
        mock_geocode.return_value = {
            'lat': -17.7833,
            'lon': 31.05,
            'display_name': '123 Main St, Belvedere, Harare, Zimbabwe',
        }

        user = User.objects.create_user(
            username='step3@example.com',
            email='step3@example.com',
            password='testpass123',
            is_active=False,
        )
        profile = UserProfile.objects.create(user=user, registration_step=3, national_id_verified=True, email_verified=True)

        data = {
            'user_id': user.id,
            'street_address': '123 Main Street, Belvedere',
        }
        response = self.client.post('/api/auth/verify-address', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('user', response.data)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        profile.refresh_from_db()
        self.assertIsNotNone(profile.home_location)

    @patch('users.views.NominatimProvider.geocode')
    def test_step3_invalid_address(self, mock_geocode):
        mock_geocode.return_value = None

        user = User.objects.create_user(
            username='step3b@example.com',
            email='step3b@example.com',
            password='testpass123',
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=3, national_id_verified=True, email_verified=True)

        data = {
            'user_id': user.id,
            'street_address': 'Invalid Address That Does Not Exist',
        }
        response = self.client.post('/api/auth/verify-address', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='login@example.com',
            email='login@example.com',
            password='testpass123',
            is_active=True,
        )
        UserProfile.objects.create(user=self.user, national_id_verified=True, is_active=True)

    def test_login_success(self):
        data = {'email': 'login@example.com', 'password': 'testpass123'}
        response = self.client.post('/api/auth/login', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_wrong_password(self):
        data = {'email': 'login@example.com', 'password': 'wrongpass'}
        response = self.client.post('/api/auth/login', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        data = {'email': 'login@example.com', 'password': 'testpass123'}
        response = self.client.post('/api/auth/login', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_token_refresh(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user)
        data = {'refresh': str(refresh)}
        response = self.client.post('/api/auth/refresh', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)


class ProfileAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='profile@example.com',
            email='profile@example.com',
            password='testpass123',
            first_name='Profile',
            last_name='User',
            is_active=True,
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            national_id_verified=True,
            is_active=True,
            trust_score=75,
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_get_my_profile(self):
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'profile@example.com')
        self.assertEqual(response.data['trust_score'], 75)

    def test_get_public_profile_hides_location(self):
        other_user = User.objects.create_user(
            username='other@example.com',
            email='other@example.com',
            password='testpass123',
            is_active=True,
        )
        other_profile = UserProfile.objects.create(
            user=other_user,
            national_id_verified=True,
            is_active=True,
            home_address='123 Secret St',
            home_location=Point(31.05, -17.7833, srid=4326),
        )
        response = self.client.get(f'/api/users/{other_user.id}/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('home_location', response.data)
        self.assertNotIn('home_address', response.data)