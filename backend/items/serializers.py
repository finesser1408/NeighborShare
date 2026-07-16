from rest_framework import serializers
from django.contrib.gis.geos import Point
from .models import Item, ItemImage, Category
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile


class ItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemImage
        fields = ['id', 'image', 'order']
        read_only_fields = ['id']


class ItemSerializer(serializers.ModelSerializer):
    images = ItemImageSerializer(many=True, read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_trust_score = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    location_display = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id', 'title', 'description', 'category', 'daily_rate_usd',
            'deposit_amount_usd', 'is_available', 'location', 'location_display',
            'availability_calendar', 'images', 'owner_name', 'owner_trust_score',
            'distance_km', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'location', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        return f"{obj.owner.first_name} {obj.owner.last_name}".strip()

    def get_owner_trust_score(self, obj):
        profile = obj.owner.profile
        if profile.trust_score == 0 and profile.national_id_verified:
            return "New Member"
        return profile.trust_score if profile.trust_score > 0 else "New Member"

    def get_distance_km(self, obj):
        if hasattr(obj, 'distance'):
            return round(obj.distance.km, 2)
        return None

    def get_location_display(self, obj):
        if obj.location:
            return f"Near {obj.owner.profile.home_address.split(',')[0] if obj.owner.profile.home_address else 'Belvedere'}"
        return "Belvedere, Harare"


class ItemCreateSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False),
        write_only=True,
        required=False,
        max_length=6,
    )

    class Meta:
        model = Item
        fields = [
            'title', 'description', 'category', 'daily_rate_usd',
            'deposit_amount_usd', 'is_available', 'availability_calendar', 'images',
        ]

    def validate_deposit_amount_usd(self, value):
        from django.conf import settings
        limit = getattr(settings, 'ECOCASH_WALLET_LIMIT', 50000)
        if value > limit:
            raise serializers.ValidationError(
                f'Deposit amount exceeds EcoCash wallet limit of ZWL {limit:,}. '
                'This listing will be flagged for admin review.'
            )
        return value

    def validate_images(self, images):
        if len(images) > 6:
            raise serializers.ValidationError('Maximum 6 images allowed.')
        for img in images:
            if img.size > 5 * 1024 * 1024:
                raise serializers.ValidationError('Each image must be under 5MB.')
        return images

    def create(self, validated_data):
        images = validated_data.pop('images', [])
        validated_data['owner'] = self.context['request'].user
        validated_data['location'] = self.context['request'].user.profile.home_location
        item = Item.objects.create(**validated_data)

        for idx, img in enumerate(images):
            processed = self.process_image(img)
            ItemImage.objects.create(item=item, image=processed, order=idx)

        return item

    def process_image(self, image_file):
        img = Image.open(image_file)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        max_size = 1200
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)

        name = f"{image_file.name.rsplit('.', 1)[0]}.jpg"
        return ContentFile(output.read(), name=name)


class ItemUpdateSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False),
        write_only=True,
        required=False,
        max_length=6,
    )

    class Meta:
        model = Item
        fields = [
            'title', 'description', 'category', 'daily_rate_usd',
            'deposit_amount_usd', 'is_available', 'availability_calendar', 'images',
        ]

    def validate_images(self, images):
        if len(images) > 6:
            raise serializers.ValidationError('Maximum 6 images allowed.')
        for img in images:
            if img.size > 5 * 1024 * 1024:
                raise serializers.ValidationError('Each image must be under 5MB.')
        return images

    def update(self, instance, validated_data):
        images = validated_data.pop('images', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if images is not None:
            instance.images.all().delete()
            for idx, img in enumerate(images):
                processed = self.process_image(img)
                ItemImage.objects.create(item=instance, image=processed, order=idx)

        return instance

    def process_image(self, image_file):
        img = Image.open(image_file)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        max_size = 1200
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)

        name = f"{image_file.name.rsplit('.', 1)[0]}.jpg"
        return ContentFile(output.read(), name=name)


class CategorySerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()

    @classmethod
    def get_all(cls):
        return [{'value': c.value, 'label': c.label} for c in Category]