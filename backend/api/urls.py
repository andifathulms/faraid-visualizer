from django.urls import path

from .views import (
    CalculatePersonalView,
    CalculateProfessionalView,
    HealthView,
    SourcesListView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("calculate/personal/", CalculatePersonalView.as_view(), name="calculate-personal"),
    path("calculate/professional/", CalculateProfessionalView.as_view(), name="calculate-professional"),
    path("sources/", SourcesListView.as_view(), name="sources"),
]
