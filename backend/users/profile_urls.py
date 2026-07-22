from django.urls import path
from .views import UserProfileViewSet, PublicProfileViewSet

urlpatterns = [
    path('me/', UserProfileViewSet.as_view({'get': 'me', 'patch': 'me'}), name='my-profile'),
    path('<int:user__id>/profile/', PublicProfileViewSet.as_view({'get': 'retrieve'}), name='public-profile'),
]
