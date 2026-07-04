"""DRF views.

One endpoint per mode (CLAUDE.md build step 5): ``/api/calculate/personal/`` and
``/api/calculate/professional/``. Both return the full structured derivation. Engine
errors are translated into clean HTTP responses — an unsupported configuration is a 422
with the engine's explanation, never a wrong number.
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
    calculate,
)
from faraid_engine.sources import all_sources

from .pdf import build_pdf
from .serializers import CalculationInputSerializer
from .services import serialize_result


class _CalculateView(APIView):
    """Shared calculation handler; subclasses pin the mode."""

    mode: str = "personal"

    def post(self, request: Request) -> Response:
        serializer = CalculationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        calc_input = serializer.to_calculation_input(mode_override=self.mode)

        try:
            result = calculate(calc_input)
        except (InvalidHeirInput, UnsupportedConfiguration) as exc:
            return Response(
                {
                    "error": type(exc).__name__,
                    "detail": str(exc),
                    "supported": False,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except EngineInvariantError as exc:  # pragma: no cover - indicates an engine bug
            return Response(
                {"error": "EngineInvariantError", "detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        lang = serializer.validated_data.get("lang", "id")
        return Response(serialize_result(result, lang), status=status.HTTP_200_OK)


class CalculatePersonalView(_CalculateView):
    mode = "personal"


class CalculateProfessionalView(_CalculateView):
    mode = "professional"


class CompareView(APIView):
    """Compare the same heirs across rule sets side by side (KHI vs Syafi'i by default).

    Returns one entry per requested ruleset — either the full serialized derivation or a
    structured error (unsupported/invalid) — so the UI can render both columns and show
    exactly where the two schools diverge (PRD §4.1).
    """

    def post(self, request: Request) -> Response:
        serializer = CalculationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested = request.data.get("rulesets") or ["khi", "syafii"]
        valid = {r.value for r in __import__("faraid_engine", fromlist=["Ruleset"]).Ruleset}
        rulesets = [r for r in requested if r in valid] or ["khi", "syafii"]

        mode = request.data.get("mode", "personal")
        lang = serializer.validated_data.get("lang", "id")
        results = []
        for rs in rulesets:
            calc_input = serializer.to_calculation_input(mode_override=mode, ruleset_override=rs)
            try:
                result = calculate(calc_input)
                results.append({"ruleset": rs, "ok": True, "result": serialize_result(result, lang)})
            except (InvalidHeirInput, UnsupportedConfiguration) as exc:
                results.append(
                    {"ruleset": rs, "ok": False, "error": type(exc).__name__, "detail": str(exc)}
                )
        return Response({"comparison": results})


class CalculateProfessionalPdfView(APIView):
    """Professional-mode PDF export (PRD §7) — full derivation + citation trail.

    Same input contract as the calculate endpoints; returns application/pdf. Always
    computes in Professional mode regardless of any ``mode`` in the body.
    """

    def post(self, request: Request) -> HttpResponse | Response:
        serializer = CalculationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        calc_input = serializer.to_calculation_input(mode_override="professional")

        try:
            result = calculate(calc_input)
        except (InvalidHeirInput, UnsupportedConfiguration) as exc:
            return Response(
                {"error": type(exc).__name__, "detail": str(exc), "supported": False},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except EngineInvariantError as exc:  # pragma: no cover
            return Response(
                {"error": "EngineInvariantError", "detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        lang = serializer.validated_data.get("lang", "id")
        payload = serialize_result(result, lang)
        pdf_bytes = build_pdf(payload, request.data.get("heirs"), lang)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="perhitungan-faraid.pdf"'
        return response


class SourcesListView(APIView):
    """Read-only citation registry — powers the UI references page / footnotes."""

    def get(self, request: Request) -> Response:
        data = [
            {
                "id": s.id,
                "type": s.type.value,
                "reference": s.reference,
                "pointer": s.pointer,
                "note": s.note,
            }
            for s in all_sources()
        ]
        return Response({"count": len(data), "sources": data})


class HealthView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "engine": "faraid_engine"})
