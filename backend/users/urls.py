from django.urls import path
from .views import RegistrationViewSet, LoginViewSet

urlpatterns = [
    path('register', RegistrationViewSet.as_view({'post': 'register_step1'}), name='register-step1'),
    path('verify-email', RegistrationViewSet.as_view({'post': 'verify_email'}), name='verify-email'),
    path('resend-verification', RegistrationViewSet.as_view({'post': 'resend_verification'}), name='resend-verification'),
    path('verify-id', RegistrationViewSet.as_view({'post': 'verify_id_step2'}), name='verify-id-step2'),
    path('verify-address', RegistrationViewSet.as_view({'post': 'verify_address_step3'}), name='verify-address-step3'),
    path('login', LoginViewSet.as_view({'post': 'login'}), name='login'),
    path('refresh', LoginViewSet.as_view({'post': 'refresh'}), name='token-refresh'),
]
