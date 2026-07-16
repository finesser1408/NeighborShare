from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.gis.geos import Point
from django.contrib.auth import get_user_model
from django.utils import timezone
import requests
import logging

from users.models import User, UserProfile
from users.serializers import (
    Step1Serializer, Step2Serializer, Step3Serializer,
    UserProfileSerializer, UserRegistrationResponseSerializer
)
from users.verification import MockVerificationProvider, NominatimProvider

logger = logging.getLogger(__name__)

User = get_user_model()


class RegistrationViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='register')
    def register_step1(self, request):
        serializer = Step1Serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Registration validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response({
            'user_id': user.id,
            'message': 'Account created. Proceed to ID verification.',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='verify-id')
    def verify_id_step2(self, request):
        serializer = Step2Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        profile = user.profile
        if profile.registration_step < 1:
            return Response({'error': 'Complete step 1 first'}, status=status.HTTP_400_BAD_REQUEST)

        national_id = serializer.validated_data['national_id']
        provider = MockVerificationProvider()
        if not provider.verify(national_id):
            return Response({'error': 'National ID verification failed'}, status=status.HTTP_400_BAD_REQUEST)

        hashed = profile.hash_national_id(national_id)
        if UserProfile.objects.filter(national_id_hash=hashed).exclude(pk=profile.pk).exists():
            return Response({'error': 'This National ID is already registered'}, status=status.HTTP_400_BAD_REQUEST)

        profile.national_id_hash = hashed
        profile.national_id_verified = True
        profile.trust_score = 50
        profile.registration_step = 2
        if 'selfie' in request.FILES:
            profile.selfie = request.FILES['selfie']
        profile.save()

        return Response({
            'message': 'ID verified. Proceed to address verification.',
            'trust_score': profile.trust_score,
        })

    @action(detail=False, methods=['post'], url_path='verify-address')
    def verify_address_step3(self, request):
        serializer = Step3Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        profile = user.profile
        if profile.registration_step < 2:
            return Response({'error': 'Complete step 2 first'}, status=status.HTTP_400_BAD_REQUEST)

        address = serializer.validated_data['street_address']
        nominatim = NominatimProvider()
        result = nominatim.geocode(f"{address}, Belvedere, Harare, Zimbabwe")

        if not result:
            return Response({'error': 'Could not geocode address. Please check and try again.'}, status=status.HTTP_400_BAD_REQUEST)

        lat, lng = result['lat'], result['lon']
        point = Point(lng, lat, srid=4326)

        profile.home_address = address
        profile.home_location = point
        profile.geocoded_at = timezone.now()
        profile.registration_step = 3
        profile.is_active = True
        profile.save()

        user.is_active = True
        user.is_verified = True
        user.verified_at = timezone.now()
        user.home_location = point
        user.trust_score = 50
        user.save()

        refresh = RefreshToken.for_user(user)
        return Response(UserRegistrationResponseSerializer({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': profile,
        }).data)


class LoginViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'error': 'Account not activated. Complete registration.'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user.profile).data,
        })

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh(self, request):
        from rest_framework_simplejwt.views import TokenRefreshView
        view = TokenRefreshView.as_view()
        return view(request._request)


class UserProfileViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.select_related('user').filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        serializer = self.get_serializer(request.user.profile)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='public')
    def public_profile(self, request, pk=None):
        profile = self.get_object()
        data = UserProfileSerializer(profile).data
        data.pop('home_location', None)
        data.pop('home_address', None)
        return Response(data)


class PublicProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for public user profiles.
    Strips private fields (home address, home location) from responses.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return UserProfile.objects.select_related('user').all()

    def retrieve(self, request, *args, **kwargs):
        # Support lookup by user__id (from profile_urls.py) or profile pk
        user_id = kwargs.get('user__id') or kwargs.get('pk')
        try:
            profile = UserProfile.objects.select_related('user').get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        data = UserProfileSerializer(profile).data
        # Remove private fields for public view
        data.pop('home_location', None)
        data.pop('home_address', None)
        return Response(data)