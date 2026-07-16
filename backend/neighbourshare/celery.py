import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neighbourshare.settings')

app = Celery('neighbourshare')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'check-expired-qr-tokens': {
        'task': 'transactions.tasks.cleanup_expired_qr_tokens',
        'schedule': 300.0,
    },
    'check-expired-transactions': {
        'task': 'transactions.tasks.check_expired_transactions',
        'schedule': 300.0,
    },
    'check-ecocash-pending': {
        'task': 'transactions.tasks.check_pending_ecocash_transactions',
        'schedule': 60.0,
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')