"""
Run this script to fix existing listings that have is_available=False
Usage: python manage.py shell < fix_listings.py
Or in Django shell: exec(open('fix_listings.py').read())
"""

from items.models import Item

# Update all items to be available
updated = Item.objects.filter(is_available=False).update(is_available=True)
print(f"Updated {updated} items to is_available=True")

# Show current status
available = Item.objects.filter(is_available=True).count()
unavailable = Item.objects.filter(is_available=False).count()
print(f"Total available: {available}")
print(f"Total unavailable: {unavailable}")
