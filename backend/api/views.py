"""DRF views — a thin HTTP adapter over :mod:`faraid_web`.

One endpoint per mode (CLAUDE.md build step 5): ``/api/calculate/personal/`` and
``/api/calculate/professional/``. Both return the full structured derivation.

All validation, calculation, wording and PDF layout live in :mod:`faraid_web`, which has
no Django dependency and is shipped verbatim to the browser in the static build. These
views own only transport: mapping the three error kinds onto status codes.

* ``InvalidInput``          — malformed payload            → 400
* ``InvalidHeirInput`` /
  ``UnsupportedConfiguration`` — impossible/unhandled fiqh → 422 (never a wrong number)
* ``EngineInvariantError``  — an engine bug                → 500
"""

from __future__ import annotations

from django.http import HttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from faraid_engine import (
    EngineInvariantError,
    InvalidHeirInput,
    UnsupportedConfiguration,
)
from faraid_web import (
    InvalidInput,
    calculate_payload,
    compare_payload,
    pdf_payload,
    sources_payload,
)


def _error_response(exc: Exception) -> Response:
    """Map a domain exception onto its HTTP response."""
    if isinstance(exc, InvalidInput):
        return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, (InvalidHeirInput, UnsupportedConfiguration)):
        return Response(
            {"error": type(exc).__name__, "detail": str(exc), "supported": False},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return Response(  # pragma: no cover - indicates an engine bug
        {"error": "EngineInvariantError", "detail": str(exc)},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


_DOMAIN_ERRORS = (InvalidInput, InvalidHeirInput, UnsupportedConfiguration, EngineInvariantError)


class _CalculateView(APIView):
    """Shared calculation handler; subclasses pin the mode."""

    mode: str = "personal"

    def post(self, request: Request) -> Response:
        try:
            return Response(
                calculate_payload(request.data, mode_override=self.mode),
                status=status.HTTP_200_OK,
            )
        except _DOMAIN_ERRORS as exc:
            return _error_response(exc)


class CalculatePersonalView(_CalculateView):
    mode = "personal"


class CalculateProfessionalView(_CalculateView):
    mode = "professional"


class CompareView(APIView):
    """Compare the same heirs across rule sets side by side (KHI vs Syafi'i by default).

    Returns one entry per requested ruleset — either the full serialized derivation or a
    structured error — so the UI can render both columns and show exactly where the two
    schools diverge (PRD §4.1).
    """

    def post(self, request: Request) -> Response:
        try:
            return Response(
                compare_payload(
                    request.data,
                    request.data.get("rulesets"),
                    mode_override=request.data.get("mode"),
                )
            )
        except _DOMAIN_ERRORS as exc:
            return _error_response(exc)


class CalculateProfessionalPdfView(APIView):
    """Professional-mode PDF export (PRD §7) — full derivation + citation trail."""

    def post(self, request: Request) -> HttpResponse | Response:
        try:
            pdf_bytes = pdf_payload(request.data)
        except _DOMAIN_ERRORS as exc:
            return _error_response(exc)

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="perhitungan-faraid.pdf"'
        return response


class SourcesListView(APIView):
    """Read-only citation registry — powers the UI references page / footnotes."""

    def get(self, request: Request) -> Response:
        return Response(sources_payload())


class HealthView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "engine": "faraid_engine"})
