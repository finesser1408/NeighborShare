from django.contrib import admin
from django.contrib.gis import admin as gis_admin
from .models import Item, ItemImage

class ItemImageInline(admin.TabularInline):
    model = ItemImage
    extra = 1

@admin.register(Item)
class ItemAdmin(gis_admin.GISModelAdmin):
    list_display = ('title', 'owner', 'category', 'daily_rate_usd', 'deposit_amount_usd', 'is_available', 'created_at')
    list_filter = ('category', 'is_available', 'created_at')
    search_fields = ('title', 'description', 'owner__email')
    inlines = [ItemImageInline]
