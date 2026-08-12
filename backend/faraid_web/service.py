"""Application layer shared by the DRF endpoints and the in-browser runtime.

Pure Python, no Django. Each function takes a raw request payload (a plain dict, exactly
what arrives as JSON) and returns the serialized derivation — so the Django view and the
Pyodide bridge run *identical* code and cannot drift apart. Transport concerns (HTTP
status codes, Response objects) stay in their respective adapters.

Errors are raised, not returned, and the three kinds stay distinct:
``InvalidInput`` (malformed payload) → 400, ``InvalidHeirInput`` /
``UnsupportedConfiguration`` (impossible or unhandled fiqh configuration) → 422.
"""

from __future__ import annotations

from faraid_engine import Ruleset, UnsupportedConfiguration, calculate
from faraid_engine.exceptions import InvalidHeirInput
from faraid_engine.sources import all_sources

from .divergence import detect_divergence
from .sensitivity import analyze
from .serialize import serialize_result
from .validate import InvalidInput, build_input, validate_payload

DEFAULT_COMPARISON = (Ruleset.KHI.value, Ruleset.SYAFII.value)


def calculate_payload(payload: object, *, mode_override: str | None = None) -> dict:
    """Validate, calculate, and serialize the full derivation for one rule set.

    Also runs the counterpart Tier-1 rule set to detect whether the two diverge on this
    case (PRD §4.1). The extra run is a second pass over the same pure functions — the
    engine has no I/O — and it is what stops a user on the KHI default from silently
    never learning that classical Syafi'i divides their family differently.
    """
    data = validate_payload(payload)
    result = calculate(build_input(data, mode_override=mode_override))
    out = serialize_result(result, data["lang"])
    out["divergence"] = detect_divergence(
        data, result, mode_override=mode_override, lang=data["lang"]
    )
    return out


def compare_payload(
    payload: object,
    rulesets: list[str] | None = None,
    *,
    mode_override: str | None = None,
) -> dict:
    """Run the same heirs through several rule sets side by side (PRD §4.1).

    A rule set that cannot handle the configuration yields a structured error entry
    rather than aborting the whole comparison — showing exactly where the schools diverge
    is the entire point, and "Syafi'i can't express this" is itself a meaningful answer.
    """
    data = validate_payload(payload)
    valid = {r.value for r in Ruleset}
    requested = [r for r in (rulesets or []) if r in valid] or list(DEFAULT_COMPARISON)

    entries = []
    for rs in requested:
        calc_input = build_input(data, mode_override=mode_override, ruleset_override=rs)
        try:
            result = calculate(calc_input)
            entries.append(
                {"ruleset": rs, "ok": True, "result": serialize_result(result, data["lang"])}
            )
        except (InvalidHeirInput, UnsupportedConfiguration) as exc:
            entries.append(
                {"ruleset": rs, "ok": False, "error": type(exc).__name__, "detail": str(exc)}
            )
    return {"comparison": entries}


def sensitivity_payload(payload: object, *, mode_override: str | None = None) -> dict:
    """Which heirs are load-bearing for this case, and which change nothing.

    A separate action rather than a field on every calculation: it is roughly thirty
    additional engine runs, and it answers a question the user has to ask before it is
    worth spending them. The default path stays as fast as it was.
    """
    data = validate_payload(payload)
    result = calculate(build_input(data, mode_override=mode_override))
    return analyze(data, result, mode_override=mode_override, lang=data["lang"])


def pdf_payload(payload: object) -> bytes:
    """Professional-mode PDF export (PRD §7). Always computes in Professional mode.

    ``reportlab`` is imported lazily: it is the only third-party dependency anywhere in
    the engine or this layer, and the calculation path must not require it. In the
    browser build that keeps the ~2 MB PDF library out of the critical path — it is
    fetched on first export, not on first calculation.
    """
    from .pdf import build_pdf

    data = validate_payload(payload)
    result = calculate(build_input(data, mode_override="professional"))
    serialized = serialize_result(result, data["lang"])
    heirs_input = payload.get("heirs") if isinstance(payload, dict) else None
    return build_pdf(serialized, heirs_input, data["lang"])


def sources_payload() -> dict:
    """Read-only citation registry — powers the references page and footnotes."""
    data = [
        {
            "id": s.id,
            "type": s.type.value,
            "reference": s.reference,
            "pointer": s.pointer,
            "note": s.note,
            # Additive: `note` stays the canonical English text so existing consumers of
            # /api/sources/ are unaffected; the UI picks per language.
            "note_id": s.note_id,
        }
        for s in all_sources()
    ]
    return {"count": len(data), "sources": data}


__all__ = [
    "InvalidInput",
    "calculate_payload",
    "compare_payload",
    "pdf_payload",
    "sensitivity_payload",
    "sources_payload",
]
