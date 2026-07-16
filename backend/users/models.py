from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
import hashlib


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True)
    is_verified = models.BooleanField(default=False)
    national_id_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    home_location = models.PointField(geography=True, srid=4326, null=True, blank=True)
    trust_score = models.FloatField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    profile_photo = models.ImageField(upload_to='profiles/', null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    REGISTRATION_STEPS = [
        (0, 'Not Started'),
        (1, 'Account Created'),
        (2, 'ID Verified'),
        (3, 'Address Verified'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    registration_step = models.IntegerField(choices=REGISTRATION_STEPS, default=0)
    national_id_verified = models.BooleanField(default=False)
    national_id_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    selfie = models.ImageField(upload_to='verification/', null=True, blank=True)
    home_address = models.TextField(blank=True)
    home_location = models.PointField(geography=True, srid=4326, null=True, blank=True)
    geocoded_at = models.DateTimeField(null=True, blank=True)
    trust_score = models.FloatField(default=0)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"{self.user.email} - Step {self.registration_step}"

    def hash_national_id(self, national_id: str) -> str:
        return hashlib.sha256(national_id.encode()).hexdigest()

    def verify_national_id(self, national_id: str) -> bool:
        hashed = self.hash_national_id(national_id)
        if UserProfile.objects.filter(national_id_hash=hashed).exists():
            return False
        self.national_id_hash = hashed
        self.national_id_verified = True
        self.trust_score = 50
        self.registration_step = 2
        self.save(update_fields=['national_id_hash', 'national_id_verified', 'trust_score', 'registration_step'])
        return True

    def update_trust_score(self, new_score: float):
        self.trust_score = round(new_score, 2)
        self.save(update_fields=['trust_score'])