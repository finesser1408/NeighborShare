from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        custom_response = {
            'error': {
                'code': response.status_code,
                'message': response.data.get('detail', 'An error occurred'),
                'details': response.data if isinstance(response.data, dict) else None,
            }
        }
        response.data = custom_response
    else:
        logger.exception('Unhandled exception', exc_info=exc)
        response = Response(
            {
                'error': {
                    'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                    'message': 'An internal server error occurred',
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response