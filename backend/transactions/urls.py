from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet

router = DefaultRouter()
router.register(r'', TransactionViewSet, basename='transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('borrow-request', TransactionViewSet.as_view({'post': 'borrow_request'}), name='borrow-request'),
    path('<uuid:pk>/accept/', TransactionViewSet.as_view({'post': 'accept'}), name='transaction-accept'),
    path('<uuid:pk>/decline/', TransactionViewSet.as_view({'post': 'decline'}), name='transaction-decline'),
    path('<uuid:pk>/hold-deposit/', TransactionViewSet.as_view({'post': 'hold_deposit'}), name='transaction-hold-deposit'),
    path('<uuid:pk>/close/', TransactionViewSet.as_view({'post': 'close_transaction'}), name='transaction-close'),
    path('<uuid:pk>/generate-qr/', TransactionViewSet.as_view({'post': 'generate_qr'}), name='generate-qr'),
    path('<uuid:pk>/scan-qr/', TransactionViewSet.as_view({'post': 'scan_qr'}), name='scan-qr'),
    path('<uuid:pk>/dispute/', TransactionViewSet.as_view({'post': 'dispute'}), name='transaction-dispute'),
    path('<uuid:pk>/rating/', TransactionViewSet.as_view({'post': 'rating'}), name='transaction-rating'),
    path('<uuid:pk>/audit-log/', TransactionViewSet.as_view({'get': 'audit_log'}), name='transaction-audit-log'),
]
