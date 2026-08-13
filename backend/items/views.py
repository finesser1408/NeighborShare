from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import Item, ItemImage, Category
from .serializers import (
    ItemSerializer, ItemCreateSerializer, ItemUpdateSerializer,
    CategorySerializer, ItemImageSerializer
)
from users.models import UserProfile


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Allow owners to modify their own items; everyone else is read-only."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('owner', 'owner__profile').prefetch_related('images')
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['category', 'is_available', 'owner', 'tier', 'trade_type', 'listing_type']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'time_credits_per_day']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ItemCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ItemUpdateSerializer
        return ItemSerializer

    def get_permissions(self):
        # Lookup/metadata actions are public; everything else requires auth.
        # IsOwnerOrReadOnly always applies so only owners can modify an item.
        if self.action in ['list', 'retrieve', 'search', 'categories', 'tiers', 'trade_types', 'listing_types']:
            return [AllowAny(), IsOwnerOrReadOnly()]
        return [IsAuthenticated(), IsOwnerOrReadOnly()]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Only filter by is_available if not filtering by owner (for "My Listings")
        if self.action == 'list' and self.request.user.is_authenticated and 'owner' not in self.request.query_params:
            queryset = queryset.filter(is_available=True)
        return queryset

    @action(detail=False, methods=['get'], url_path='search', permission_classes=[AllowAny])
    def search(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')

        if not lat or not lng:
            return Response(
                {'error': 'lat and lng query parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return Response(
                {'error': 'lat and lng must be valid floats'},
                status=status.HTTP_400_BAD_REQUEST
            )

        radius_km = float(request.query_params.get('radius_km', 5))
        radius_km = min(max(radius_km, 0.1), 10)

        category = request.query_params.get('category')
        sort = request.query_params.get('sort', 'distance')
        q = (request.query_params.get('q') or '').strip()

        point = Point(lng, lat, srid=4326)

        from neighbourshare.gis_mock import gdal_available
        import math

        if not gdal_available:
            # Fallback for local development when GDAL is not installed
            # Use Haversine formula for distance filtering
            queryset = Item.objects.filter(is_available=True).select_related('owner', 'owner__profile').prefetch_related('images')
            if q:
                queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q))
            
            def haversine_distance(lat1, lon1, lat2, lon2):
                """Calculate distance between two points in kilometers using Haversine formula"""
                R = 6371  # Earth's radius in km
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                return R * c
            
            filtered_items = []
            for item in queryset:
                if item.location and hasattr(item.location, 'y') and hasattr(item.location, 'x'):
                    item_lat = item.location.y
                    item_lng = item.location.x
                    distance = haversine_distance(lat, lng, item_lat, item_lng)
                    if distance <= radius_km:
                        item.distance = distance
                        filtered_items.append(item)
            
            # Convert filtered list back to queryset-like structure
            # Note: This is a limitation of the fallback - we can't maintain queryset methods
            queryset = filtered_items
            print(f"[SEARCH] Dev mode - found {len(queryset)} items within {radius_km}km using Haversine")
        else:
            queryset = Item.objects.filter(
                is_available=True,
                location__distance_lte=(point, D(km=radius_km))
            ).annotate(
                distance=Distance('location', point)
            ).select_related('owner', 'owner__profile').prefetch_related('images')
            if q:
                queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q))
            print(f"[SEARCH] GDAL mode - found {queryset.count()} items within {radius_km}km")

        if not gdal_available:
            if category:
                queryset = [item for item in queryset if item.category == category]
            if sort == 'distance':
                queryset.sort(key=lambda x: getattr(x, 'distance', 9999))
            elif sort == 'newest':
                queryset.sort(key=lambda x: x.created_at, reverse=True)
            elif sort == 'credits_asc':
                queryset.sort(key=lambda x: x.time_credits_per_day)
            elif sort == 'credits_desc':
                queryset.sort(key=lambda x: x.time_credits_per_day, reverse=True)
        else:
            if category:
                queryset = queryset.filter(category=category)
            if sort == 'distance':
                queryset = queryset.order_by('distance')
            elif sort == 'newest':
                queryset = queryset.order_by('-created_at')
            elif sort == 'credits_asc':
                queryset = queryset.order_by('time_credits_per_day')
            elif sort == 'credits_desc':
                queryset = queryset.order_by('-time_credits_per_day')

        serializer = ItemSerializer(queryset, many=True, context={'request': request})
        data = serializer.data

        widen_suggestion = len(data) == 0 and radius_km < 10

        # Build features from queryset (model instances) to access location
        # NOTE: We do NOT include precise coordinates in the response for privacy
        # Only neighborhood-level location_display is exposed via serializer
        features = []
        for item in queryset:
            # Skip items without valid location
            if not item.location:
                continue
            
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    # Coordinates are obfuscated - only used for map rendering at neighborhood level
                    'coordinates': [0, 0],  # Placeholder - actual coords never exposed
                },
                'properties': next((d for d in data if d['id'] == str(item.id)), {}),
            })

        return Response({
            'type': 'FeatureCollection',
            'features': features,
            'widen_suggestion': widen_suggestion,
            'search_center': {'lat': lat, 'lng': lng},
            'radius_km': radius_km,
        })

    @action(detail=True, methods=['post'], url_path='images')
    def upload_images(self, request, pk=None):
        item = self.get_object()
        if item.owner != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        images = request.FILES.getlist('images')
        if not images:
            return Response({'error': 'No images provided'}, status=status.HTTP_400_BAD_REQUEST)

        if item.images.count() + len(images) > 6:
            return Response({'error': 'Maximum 6 images allowed'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ItemImageSerializer(data=[{'image': img} for img in images], many=True)
        serializer.is_valid(raise_exception=True)

        for idx, img in enumerate(images):
            ItemImage.objects.create(item=item, image=img, order=item.images.count() + idx)

        return Response(ItemSerializer(item, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        return Response(CategorySerializer.get_all())

    @action(detail=False, methods=['get'], url_path='tiers')
    def tiers(self, request):
        return Response(CategorySerializer.get_tiers())

    @action(detail=False, methods=['get'], url_path='trade-types')
    def trade_types(self, request):
        return Response(CategorySerializer.get_trade_types())

    @action(detail=False, methods=['get'], url_path='listing-types')
    def listing_types(self, request):
        return Response(CategorySerializer.get_listing_types())


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Category.objects.all()

    def list(self, request, *args, **kwargs):
        return Response(CategorySerializer.get_all())