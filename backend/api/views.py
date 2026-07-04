"""DRF views.

One endpoint per mode (CLAUDE.md build step 5): ``/api/calculate/personal/`` and
``/api/calculate/professional/``. Both return the full structured derivation. Engine
errors are translated into clean HTTP responses — an unsupported configuration is a 422
with the engine's explanation, never a wrong number.
"""

from __future__ import annotations

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

        return Response(serialize_result(result), status=status.HTTP_200_OK)


class CalculatePersonalView(_CalculateView):
    mode = "personal"


class CalculateProfessionalView(_CalculateView):
    mode = "professional"


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
