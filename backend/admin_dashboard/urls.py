from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminDisputeViewSet, AdminUserViewSet, AdminStatsViewSet

router = DefaultRouter()
router.register(r'disputes', AdminDisputeViewSet, basename='admin-dispute')
router.register(r'users', AdminUserViewSet, basename='admin-user')
router.register(r'stats', AdminStatsViewSet, basename='admin-stats')

urlpatterns = [
    path('', include(router.urls)),
]