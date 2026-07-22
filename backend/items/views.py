from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, permission_classes
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


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('owner', 'owner__profile').prefetch_related('images')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['category', 'is_available', 'owner']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'daily_rate_usd', 'deposit_amount_usd']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ItemCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ItemUpdateSerializer
        return ItemSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'search']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Only filter by is_available if not filtering by owner (for "My Listings")
        if self.action == 'list' and self.request.user.is_authenticated and 'owner' not in self.request.query_params:
            queryset = queryset.filter(is_available=True)
        return queryset

    @action(detail=False, methods=['get'], url_path='search')
    @permission_classes([AllowAny])
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

        point = Point(lng, lat, srid=4326)

        from neighbourshare.gis_mock import gdal_available

        if not gdal_available:
            # Fallback for local development when GDAL is not installed
            queryset = Item.objects.filter(is_available=True).select_related('owner', 'owner__profile').prefetch_related('images')
            # Mock distance attribute for serializers/responses
            for item in queryset:
                item.distance = 0.0
        else:
            queryset = Item.objects.filter(
                is_available=True,
                location__distance_lte=(point, D(km=radius_km))
            ).annotate(
                distance=Distance('location', point)
            ).select_related('owner', 'owner__profile').prefetch_related('images')

        if category:
            queryset = queryset.filter(category=category)

        if sort == 'distance' and gdal_available:
            queryset = queryset.order_by('distance')
        elif sort == 'newest':
            queryset = queryset.order_by('-created_at')
        elif sort == 'price_asc':
            queryset = queryset.order_by('daily_rate_usd')
        elif sort == 'price_desc':
            queryset = queryset.order_by('-daily_rate_usd')

        serializer = ItemSerializer(queryset, many=True, context={'request': request})
        data = serializer.data

        widen_suggestion = len(data) == 0 and radius_km < 10

        # Build features from queryset (model instances) to access location
        features = []
        for item in queryset:
            # Handle location - might be MockPoint, Point, or None
            if item.location and hasattr(item.location, 'x') and hasattr(item.location, 'y'):
                coords = [item.location.x, item.location.y]
            elif item.location and isinstance(item.location, (list, tuple)) and len(item.location) == 2:
                coords = item.location
            else:
                # Skip items without valid location
                continue
            
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': coords,
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


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Category.objects.all()

    def list(self, request, *args, **kwargs):
        return Response(CategorySerializer.get_all())