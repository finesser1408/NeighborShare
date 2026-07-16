from django.contrib import admin
from .models import Transaction, TransactionEvent, Rating

class TransactionEventInline(admin.TabularInline):
    model = TransactionEvent
    readonly_fields = ('event_type', 'detail', 'created_at')
    extra = 0
    can_delete = False

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'borrower', 'item', 'state', 'requested_from', 'requested_to', 'total_cost', 'created_at')
    list_filter = ('state', 'requested_from', 'requested_to', 'created_at')
    search_fields = ('id', 'borrower__email', 'item__title', 'escrow_reference')
    inlines = [TransactionEventInline]
    readonly_fields = ('escrow_reference',)

@admin.register(TransactionEvent)
class TransactionEventAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'event_type', 'created_at')
    list_filter = ('event_type', 'created_at')
    search_fields = ('transaction__id', 'event_type')

@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'rater', 'ratee', 'average_score', 'submitted_at', 'is_visible')
    list_filter = ('is_visible', 'submitted_at')
    search_fields = ('transaction__id', 'rater__email', 'ratee__email')
