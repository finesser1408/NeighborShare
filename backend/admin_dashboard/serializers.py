from rest_framework import serializers
from users.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    profile_photo = serializers.ImageField(source='user.profile_photo', read_only=True)
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'full_name', 'email', 'phone_number', 'profile_photo',
            'home_address', 'trust_score', 'national_id_verified', 'is_active',
            'is_staff', 'created_at',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()