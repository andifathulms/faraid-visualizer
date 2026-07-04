from django.urls import path

from .views import (
    CalculatePersonalView,
    CalculateProfessionalPdfView,
    CalculateProfessionalView,
    HealthView,
    SourcesListView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("calculate/personal/", CalculatePersonalView.as_view(), name="calculate-personal"),
    path("calculate/professional/", CalculateProfessionalView.as_view(), name="calculate-professional"),
    path("calculate/professional/pdf/", CalculateProfessionalPdfView.as_view(), name="calculate-professional-pdf"),
    path("sources/", SourcesListView.as_view(), name="sources"),
]
