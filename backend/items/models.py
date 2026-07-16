from django.contrib.gis.db import models as gis_models
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class Category(models.TextChoices):
    TOOLS = 'tools', 'Tools'
    GARDEN_EQUIPMENT = 'garden_equipment', 'Garden Equipment'
    KITCHEN_APPLIANCES = 'kitchen_appliances', 'Kitchen Appliances'
    ELECTRONICS = 'electronics', 'Electronics'
    SPORTS_EQUIPMENT = 'sports_equipment', 'Sports Equipment'
    MUSICAL_INSTRUMENTS = 'musical_instruments', 'Musical Instruments'
    CAMERAS_PHOTOGRAPHY = 'cameras_photography', 'Cameras and Photography'
    BABY_CHILDREN = 'baby_children', 'Baby and Children'
    BOOKS_STATIONERY = 'books_stationery', 'Books and Stationery'
    CLOTHING_ACCESSORIES = 'clothing_accessories', 'Clothing and Accessories'
    FURNITURE = 'furniture', 'Furniture'
    VEHICLES_TRANSPORT = 'vehicles_transport', 'Vehicles and Transport'
    PARTY_EVENTS = 'party_events', 'Party and Events'
    CLEANING_EQUIPMENT = 'cleaning_equipment', 'Cleaning Equipment'
    MEDICAL_HEALTH = 'medical_health', 'Medical and Health'
    OFFICE_EQUIPMENT = 'office_equipment', 'Office Equipment'
    OUTDOOR_CAMPING = 'outdoor_camping', 'Outdoor and Camping'
    OTHER = 'other', 'Other'


class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='items')
    title = models.CharField(max_length=120)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=Category.choices)
    daily_rate_usd = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    deposit_amount_usd = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    is_available = models.BooleanField(default=True)
    location = gis_models.PointField(geography=True, srid=4326)
    availability_calendar = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'items'
        indexes = [
            gis_models.Index(fields=['location'], name='item_location_gist'),
            models.Index(fields=['category', 'is_available']),
            models.Index(fields=['owner', 'is_available']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.location and self.owner.profile.home_location:
            self.location = self.owner.profile.home_location
        super().save(*args, **kwargs)


class ItemImage(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='items/%Y/%m/')
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'item_images'
        ordering = ['order']

    def __str__(self):
        return f"{self.item.title} - Image {self.order}"