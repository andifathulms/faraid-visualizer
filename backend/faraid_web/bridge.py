"""JSON-in / JSON-out entrypoint for the in-browser (Pyodide) runtime.

The static GitHub Pages build has no server: the browser loads this package under
Pyodide and calls :func:`dispatch` across the JavaScript boundary. Keeping that boundary
to a single function that speaks JSON — rather than passing live Python objects to JS —
means the frontend consumes the *same* wire format the DRF API returns, so one set of
TypeScript types describes both deployments.

It lives here, not in the frontend as an embedded Python string, so it is covered by the
normal pytest suite instead of being untested glue.

Errors are returned rather than raised, because an exception crossing into JavaScript
loses its type. The ``kind`` field preserves the distinction the HTTP layer expresses as
status codes, and which CLAUDE.md insists must never blur:

* ``invalid_input``  — malformed payload (HTTP 400 equivalent)
* ``unsupported``    — impossible or unhandled fiqh configuration (HTTP 422 equivalent)
* ``engine_error``   — an engine invariant broke (HTTP 500 equivalent)

An unsupported configuration must always surface as an explicit error to the user, never
as a silently wrong number.
"""

from __future__ import annotations

import base64
import json

from faraid_engine import (
    EngineInvariantError,
    InvalidHeirInput,
    UnsupportedConfiguration,
)

from .service import (
    calculate_payload,
    compare_payload,
    pdf_payload,
    sensitivity_payload,
    sources_payload,
)
from .validate import InvalidInput

ACTIONS = ("calculate", "compare", "pdf", "sensitivity", "sources")


def _ok(data: object) -> str:
    return json.dumps({"ok": True, "data": data})


def _err(kind: str, error: str, detail: object) -> str:
    return json.dumps({"ok": False, "kind": kind, "error": error, "detail": detail})


def dispatch(action: str, request_json: str) -> str:
    """Run one action and return a JSON envelope. Never raises across the JS boundary.

    ``request_json`` is the JSON request body, plus two transport-level keys the HTTP API
    expresses in the URL and method instead: ``mode_override`` (which endpoint was hit)
    and ``rulesets`` (for comparison).
    """
    try:
        request = json.loads(request_json) if request_json else {}
    except (TypeError, ValueError) as exc:
        return _err("invalid_input", "MalformedJSON", str(exc))

    if action not in ACTIONS:
        return _err("invalid_input", "UnknownAction", f'"{action}" is not one of {list(ACTIONS)}.')

    payload = request.get("payload", {})
    mode_override = request.get("mode_override")

    try:
        if action == "calculate":
            return _ok(calculate_payload(payload, mode_override=mode_override))
        if action == "compare":
            return _ok(compare_payload(payload, request.get("rulesets"), mode_override=mode_override))
        if action == "sensitivity":
            return _ok(sensitivity_payload(payload, mode_override=mode_override))
        if action == "sources":
            return _ok(sources_payload())
        # PDF bytes cannot travel as JSON; base64 keeps the envelope uniform. The payload
        # is small (single-digit KB), so the encoding overhead is irrelevant.
        return _ok({"pdf_base64": base64.b64encode(pdf_payload(payload)).decode("ascii")})
    except InvalidInput as exc:
        return _err("invalid_input", "InvalidInput", exc.errors)
    except (InvalidHeirInput, UnsupportedConfiguration) as exc:
        return _err("unsupported", type(exc).__name__, str(exc))
    except EngineInvariantError as exc:  # pragma: no cover - indicates an engine bug
        return _err("engine_error", "EngineInvariantError", str(exc))
