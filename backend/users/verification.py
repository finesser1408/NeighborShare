import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class VerificationProvider(ABC):
    @abstractmethod
    def verify(self, national_id: str) -> bool:
        pass


class MockVerificationProvider(VerificationProvider):
    def verify(self, national_id: str) -> bool:
        logger.info(f"Mock verification for National ID: {national_id[:4]}****")
        return True


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