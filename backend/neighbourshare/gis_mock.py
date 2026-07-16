import sys
import types
from django.db import models

# First, check if GDAL is installed/functional by trying to import the default libgdal
gdal_available = False
try:
    from django.contrib.gis.gdal import HAS_GDAL
    if HAS_GDAL:
        gdal_available = True
except Exception:
    pass

if not gdal_available:
    print("--> GDAL is not installed/configured. Enabling GeoDjango Mock Layer for local development without OSGeo4W/Docker.")

    # Create dummy Point class
    class MockPoint:
        def __init__(self, x=0.0, y=0.0, srid=4326):
            # x is typically longitude, y is latitude
            self.x = float(x)
            self.y = float(y)

        @property
        def coords(self):
            return (self.x, self.y)

        def __str__(self):
            return f"POINT ({self.x} {self.y})"

        def __repr__(self):
            return f"<MockPoint: POINT ({self.x} {self.y})>"

    # 1. Root django.contrib.gis module
    gis_mock = types.ModuleType('django.contrib.gis')
    sys.modules['django.contrib.gis'] = gis_mock

    # 2. django.contrib.gis.geos
    geos_mock = types.ModuleType('django.contrib.gis.geos')
    geos_mock.Point = MockPoint
    sys.modules['django.contrib.gis.geos'] = geos_mock
    gis_mock.geos = geos_mock

    # 3. django.contrib.gis.measure
    measure_mock = types.ModuleType('django.contrib.gis.measure')
    class MockD:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
    measure_mock.D = MockD
    sys.modules['django.contrib.gis.measure'] = measure_mock
    gis_mock.measure = measure_mock

    # 4. django.contrib.gis.admin
    from django.contrib import admin
    admin_mock = types.ModuleType('django.contrib.gis.admin')
    admin_mock.GISModelAdmin = admin.ModelAdmin
    sys.modules['django.contrib.gis.admin'] = admin_mock
    gis_mock.admin = admin_mock

    # 5. django.contrib.gis.db
    db_mock = types.ModuleType('django.contrib.gis.db')
    sys.modules['django.contrib.gis.db'] = db_mock
    gis_mock.db = db_mock

    # 6. django.contrib.gis.db.models
    # We copy standard models and overlay our MockPointField
    db_models_mock = types.ModuleType('django.contrib.gis.db.models')
    for attr in dir(models):
        setattr(db_models_mock, attr, getattr(models, attr))

    class MockPointField(models.JSONField):
        def __init__(self, *args, **kwargs):
            # Pop spatial parameters to prevent JSONField initialization errors
            kwargs.pop('srid', None)
            kwargs.pop('geography', None)
            kwargs.pop('spatial_index', None)
            super().__init__(*args, **kwargs)

        def from_db_value(self, value, expression, connection):
            value = super().from_db_value(value, expression, connection)
            if value is None:
                return None
            if isinstance(value, (list, tuple)) and len(value) == 2:
                return MockPoint(value[0], value[1])
            return value

        def to_python(self, value):
            if isinstance(value, MockPoint):
                return value
            value = super().to_python(value)
            if isinstance(value, (list, tuple)) and len(value) == 2:
                return MockPoint(value[0], value[1])
            return value

        def get_prep_value(self, value):
            if isinstance(value, MockPoint):
                return [value.x, value.y]
            return super().get_prep_value(value)

    db_models_mock.PointField = MockPointField
    sys.modules['django.contrib.gis.db.models'] = db_models_mock
    db_mock.models = db_models_mock

    # 7. django.contrib.gis.db.models.functions
    functions_mock = types.ModuleType('django.contrib.gis.db.models.functions')
    class MockDistance:
        def __init__(self, *args, **kwargs):
            pass
    functions_mock.Distance = MockDistance
    sys.modules['django.contrib.gis.db.models.functions'] = functions_mock
    db_models_mock.functions = functions_mock
