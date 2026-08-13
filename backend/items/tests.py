import pytest
from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from items.models import Item, ItemImage, Category
from users.models import User, UserProfile


class ItemModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner@example.com',
            email='owner@example.com',
            password='testpass123',
        )
        self.profile = UserProfile.objects.create(
            user=self.owner,
            home_location=Point(31.05, -17.7833, srid=4326),
            is_active=True,
        )

    def test_item_creation(self):
        item = Item.objects.create(
            owner=self.owner,
            title='Test Drill',
            description='A power drill',
            category=Category.TOOLS,
            time_credits_per_day=5,
            location=Point(31.05, -17.7833, srid=4326),
        )
        self.assertEqual(item.title, 'Test Drill')
        self.assertEqual(item.category, Category.TOOLS)
        self.assertTrue(item.is_available)

    def test_item_str(self):
        item = Item.objects.create(
            owner=self.owner,
            title='Test Item',
            category=Category.TOOLS,
            time_credits_per_day=10,
            location=Point(31.05, -17.7833, srid=4326),
        )
        self.assertEqual(str(item), 'Test Item (owner@example.com)')

    def test_category_choices(self):
        self.assertEqual(len(Category.choices), 18)
        self.assertIn(('tools', 'Tools'), Category.choices)
        self.assertIn(('other', 'Other'), Category.choices)


class ItemAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='owner@example.com',
            email='owner@example.com',
            password='testpass123',
        )
        self.profile = UserProfile.objects.create(
            user=self.owner,
            home_location=Point(31.05, -17.7833, srid=4326),
            is_active=True,
        )
        self.borrower = User.objects.create_user(
            username='borrower@example.com',
            email='borrower@example.com',
            password='testpass123',
        )
        UserProfile.objects.create(
            user=self.borrower,
            home_location=Point(31.06, -17.78, srid=4326),
            is_active=True,
        )

        self.item = Item.objects.create(
            owner=self.owner,
            title='Power Drill',
            description='Cordless drill',
            category=Category.TOOLS,
            time_credits_per_day=5,
            location=Point(31.05, -17.7833, srid=4326),
        )

    def test_search_requires_lat_lng(self):
        response = self.client.get('/api/items/search/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_within_radius(self):
        response = self.client.get('/api/items/search/', {'lat': -17.7833, 'lng': 31.05})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['type'], 'FeatureCollection')
        self.assertEqual(len(response.data['features']), 1)

    def test_search_outside_radius(self):
        response = self.client.get('/api/items/search/', {'lat': -18.0, 'lng': 30.0, 'radius_km': 5})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['features']), 0)
        self.assertTrue(response.data['widen_suggestion'])

    def test_search_category_filter(self):
        Item.objects.create(
            owner=self.owner,
            title='Lawn Mower',
            category=Category.GARDEN_EQUIPMENT,
            time_credits_per_day=10,
            location=Point(31.05, -17.7833, srid=4326),
        )
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'category': 'tools'
        })
        self.assertEqual(len(response.data['features']), 1)
        self.assertEqual(response.data['features'][0]['properties']['category'], 'tools')

    def test_search_sort_by_distance(self):
        Item.objects.create(
            owner=self.owner,
            title='Far Item',
            category=Category.TOOLS,
            time_credits_per_day=5,
            location=Point(31.1, -17.8, srid=4326),
        )
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'sort': 'distance'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        distances = [f['properties'].get('distance_km', 0) for f in response.data['features']]
        self.assertEqual(distances, sorted(distances))

    def test_create_item_authenticated(self):
        self.client.force_authenticate(user=self.owner)
        data = {
            'title': 'New Item',
            'description': 'Description',
            'category': 'tools',
            'time_credits_per_day': '10',
        }
        response = self.client.post('/api/items/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_item_unauthenticated(self):
        data = {
            'title': 'New Item',
            'category': 'tools',
            'time_credits_per_day': '10',
        }
        response = self.client.post('/api/items/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_own_item(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(f'/api/items/{self.item.id}/', {'title': 'Updated Title'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Title')

    def test_update_other_item_forbidden(self):
        self.client.force_authenticate(user=self.borrower)
        response = self.client.patch(f'/api/items/{self.item.id}/', {'title': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_own_item(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(f'/api/items/{self.item.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_categories_endpoint(self):
        response = self.client.get('/api/items/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 18)

    def test_search_keyword_matches_title(self):
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'drill'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['features']), 1)
        self.assertEqual(response.data['features'][0]['properties']['title'], 'Power Drill')

    def test_search_keyword_matches_description(self):
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'cordless'
        })
        self.assertEqual(len(response.data['features']), 1)
        self.assertEqual(response.data['features'][0]['properties']['title'], 'Power Drill')

    def test_search_keyword_case_insensitive(self):
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'POWER DRILL'
        })
        self.assertEqual(len(response.data['features']), 1)

    def test_search_keyword_no_match(self):
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'doesnotexist'
        })
        self.assertEqual(len(response.data['features']), 0)

    def test_search_keyword_combined_with_category(self):
        # Keyword + wrong category returns nothing
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'drill', 'category': 'garden_equipment'
        })
        self.assertEqual(len(response.data['features']), 0)
        # Keyword + matching category still finds it
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'drill', 'category': 'tools'
        })
        self.assertEqual(len(response.data['features']), 1)

    def test_search_keyword_ignores_unavailable_items(self):
        self.item.is_available = False
        self.item.save()
        response = self.client.get('/api/items/search/', {
            'lat': -17.7833, 'lng': 31.05, 'q': 'drill'
        })
        self.assertEqual(len(response.data['features']), 0)