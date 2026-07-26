from django.contrib.gis.db import models as gis_models
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class ListingType(models.TextChoices):
    ITEM = 'item', 'Physical Item'
    SERVICE = 'service', 'Skill/Service'


class ItemTier(models.TextChoices):
    TIER_1 = 'tier_1', 'Tier 1 (Small Exchanges)'
    TIER_2 = 'tier_2', 'Tier 2 (Medium Exchanges)'
    TIER_3 = 'tier_3', 'Tier 3 (Large Exchanges)'


class TradeType(models.TextChoices):
    SPECIFIC_TRADE = 'specific_trade', 'Specific Trade Request'
    OPEN_OFFER = 'open_offer', 'Open to Offers'
    COMMUNITY_CREDIT = 'community_credit', 'Community Credit Only'


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
    listing_type = models.CharField(max_length=10, choices=ListingType.choices, default=ListingType.ITEM)
    tier = models.CharField(max_length=10, choices=ItemTier.choices, default=ItemTier.TIER_1)
    trade_type = models.CharField(max_length=20, choices=TradeType.choices, default=TradeType.OPEN_OFFER)
    trade_request_details = models.TextField(blank=True, help_text='Description of what you want in return for specific trades')
    time_credits_per_day = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
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
            models.Index(fields=['tier', 'is_available']),
            models.Index(fields=['trade_type', 'is_available']),
        ]

    def __str__(self):
        return f"{self.title} ({self.owner.email})"

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