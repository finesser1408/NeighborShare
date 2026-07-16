from django.http import JsonResponse
from django.db import connection


def health_check(request):
    """
    Lightweight health check endpoint used by Docker and nginx.
    Verifies the database connection is alive.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = str(e)

    healthy = db_status == "ok"
    data = {
        "status": "healthy" if healthy else "unhealthy",
        "database": db_status,
    }
    return JsonResponse(data, status=200 if healthy else 503)
