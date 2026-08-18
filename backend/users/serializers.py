from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from users.models import User, UserProfile
import re

User = get_user_model()


class Step1Serializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def save(self):
        full_name = self.validated_data['full_name'].strip()
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(
            username=self.validated_data['email'],
            email=self.validated_data['email'],
            password=self.validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            is_active=False,
        )
        UserProfile.objects.create(user=user, registration_step=1)
        return user


class Step2Serializer(serializers.Serializer):
    national_id = serializers.CharField(max_length=20)
    selfie = serializers.ImageField(required=False)

    def validate_national_id(self, value):
        pattern = r'^\d{2}-\d{6,7}[A-Z]\d{2}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "Invalid Zimbabwean National ID format. Expected format: XX-XXXXXXXA00"
            )
        return value


class Step3Serializer(serializers.Serializer):
    street_address = serializers.CharField(max_length=500)

    def validate_street_address(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Please provide a complete street address.")
        return value.strip()


class VerifyEmailSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    code = serializers.CharField(max_length=10)


class ResendVerificationSerializer(serializers.Serializer):
    user_id = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    phone_number = serializers.CharField(source='user.phone_number', required=False)
    profile_photo = serializers.ImageField(source='user.profile_photo', required=False)
    home_location = serializers.SerializerMethodField()
    trust_score_display = serializers.SerializerMethodField()
    vouching_components = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'full_name', 'email', 'first_name', 'last_name', 'phone_number', 'profile_photo',
            'home_address', 'home_location', 'trust_score', 'trust_score_display', 'vouching_components',
            'national_id_verified', 'email_verified', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'email', 'home_location', 'trust_score', 'trust_score_display', 'vouching_components',
                           'national_id_verified', 'email_verified', 'is_active', 'created_at']

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() if obj.user else ""

    def update(self, instance, validated_data):
        # Handle User model fields
        user_fields = ['first_name', 'last_name', 'phone_number', 'profile_photo']
        user_data = {}
        for field in user_fields:
            if field in validated_data:
                user_data[field] = validated_data.pop(field)
        
        if user_data:
            for attr, value in user_data.items():
                setattr(instance.user, attr, value)
            instance.user.save()
        
        # Handle UserProfile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance

    def get_home_location(self, obj):
        if obj.home_location:
            return {
                'lat': obj.home_location.y,
                'lng': obj.home_location.x,
            }
        return None

    def get_vouching_components(self, obj):
        """Break down trust score into component averages for transparency"""
        from transactions.models import Rating
        
        ratings_received = Rating.objects.filter(
            ratee=obj.user,
            is_visible=True
        )
        
        if not ratings_received.exists():
            return None
        
        # Calculate averages for each component
        item_condition_avg = ratings_received.aggregate(
            avg=models.Avg('item_condition')
        )['avg'] or 0
        
        communication_avg = ratings_received.aggregate(
            avg=models.Avg('communication')
        )['avg'] or 0
        
        punctuality_avg = ratings_received.aggregate(
            avg=models.Avg('punctuality')
        )['avg'] or 0
        
        return {
            'item_condition': round(item_condition_avg, 1),
            'communication': round(communication_avg, 1),
            'punctuality': round(punctuality_avg, 1),
            'total_ratings': ratings_received.count(),
        }

    def get_trust_score_display(self, obj):
        if obj.trust_score == 0 and not obj.national_id_verified:
            return "Not Verified"
        if obj.trust_score > 0 and obj.user.ratings_received.count() < 3:
            return "New Member"
        return f"{obj.trust_score:.0f}/100"


class UserRegistrationResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserProfileSerializer()