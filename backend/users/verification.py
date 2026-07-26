"""
Identity Verification Provider Abstraction

This module provides a clean abstraction for national ID verification.
The interface allows swapping between mock providers for development/testing
and real government API integrations for production without changing calling code.
"""
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class VerificationError(Exception):
    """Raised when verification service fails"""
    pass


class IdentityVerificationProvider(ABC):
    """
    Abstract base class for identity verification providers.
    
    All verification providers must implement this interface to ensure
    consistency and swappability between mock and production implementations.
    """
    
    @abstractmethod
    def verify(self, national_id: str, country_code: str = 'ZW') -> Dict[str, Any]:
        """
        Verify a national ID against the official registry.
        
        Args:
            national_id: The national ID number to verify
            country_code: ISO country code (default: ZW for Zimbabwe)
        
        Returns:
            Dict with keys:
                - valid (bool): Whether the ID is valid
                - full_name (str, optional): Full name from registry
                - date_of_birth (str, optional): DOB from registry
                - error (str, optional): Error message if verification failed
        
        Raises:
            VerificationError: If verification service is unavailable
        """
        pass


class MockIdentityVerificationProvider(IdentityVerificationProvider):
    """
    Mock provider for development and testing.
    
    This provider validates format but does not check against a real registry.
    In production, this should be replaced with a real government API integration.
    """
    
    def verify(self, national_id: str, country_code: str = 'ZW') -> Dict[str, Any]:
        """
        Mock verification that validates Zimbabwean ID format.
        
        Format: 2 letters + 6 digits (e.g., AB123456)
        """
        logger.info(f"Mock verification for National ID: {national_id[:4]}****")
        
        # Basic format validation for Zimbabwe
        if country_code == 'ZW':
            if len(national_id) != 8 or not national_id[:2].isalpha() or not national_id[2:].isdigit():
                return {
                    'valid': False,
                    'error': 'Invalid Zimbabwean ID format. Expected: 2 letters + 6 digits'
                }
        
        # Mock successful verification
        return {
            'valid': True,
            'full_name': None,  # Would be populated by real registry
            'date_of_birth': None,  # Would be populated by real registry
        }


# Backward compatibility alias
MockVerificationProvider = MockIdentityVerificationProvider


class NominatimProvider:
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.headers = {
            'User-Agent': getattr(settings, 'NOMINATIM_USER_AGENT', 'NeighbourShare/1.0'),
        }

    def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        params = {
            'q': address,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1,
        }
        try:
            response = requests.get(self.base_url, params=params, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            if data:
                return {
                    'lat': float(data[0]['lat']),
                    'lon': float(data[0]['lon']),
                    'display_name': data[0]['display_name'],
                }
        except Exception as e:
            logger.error(f"Nominatim geocoding failed: {e}")
        return None