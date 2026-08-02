"""Bridge between the pure engine and whatever renders it.

Serializes a :class:`faraid_engine.CalculationResult` into a JSON-able dict that carries
the FULL structured derivation (not just final shares) so the frontend can render the
step-by-step view (CLAUDE.md build step 5). Every cited ``source_id`` is resolved to its
citation and bundled under ``sources`` so the UI renders footnotes without a second call.

The same dict is produced whether this runs in Django or in the browser under Pyodide —
it is the single wire format for the derivation.
"""

from __future__ import annotations

from decimal import Decimal
from fractions import Fraction

from faraid_engine import CalculationResult
from faraid_engine.sources import get_source

from .explain import blocked_reason, reason_for, translate_note
from .labels import category_label, disclaimer, relation_label, step_title


def _fraction(f: Fraction) -> dict:
    return {
        "numerator": f.numerator,
        "denominator": f.denominator,
        "text": f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator),
        "float": float(f),
    }


def _money(d: Decimal | None) -> str | None:
    return None if d is None else str(d.quantize(Decimal("0.01")))


def _per_head_money(result: CalculationResult, per_head: Fraction) -> Decimal | None:
    """Monetary value of ONE member of a heir group.

    Presentation only — derived from the engine's own ``per_head`` fraction and net
    divisible estate so the UI never has to divide money itself. Kept in Decimal for the
    same reason ``CalculationResult.money_for`` is: the group amount and the per-head
    amount must be rounded from the same exact arithmetic, not from each other.
    """
    if result.estate is None:
        return None
    return (
        Decimal(per_head.numerator)
        / Decimal(per_head.denominator)
        * result.estate.net_divisible
    )


def serialize_result(result: CalculationResult, lang: str = "id") -> dict:
    """Serialize the full derivation, localized to ``lang`` ("id" or "en").

    Indonesian uses the engine's authoritative prose; English is regenerated from the
    structured fields via :mod:`faraid_web.explain` (the engine is never touched).
    """
    source_ids: set[str] = set()

    shares = []
    for s in result.shares:
        source_ids.add(s.source_id)
        shares.append(
            {
                "relation": s.relation.value,
                "label_id": s.relation.label_id,
                "label": relation_label(s.relation.label_id, lang),
                "count": s.count,
                "share": _fraction(s.share),
                "per_head": _fraction(s.per_head),
                "category": s.category.value,
                "category_label": category_label(s.category.value, lang),
                "asabah_type": s.asabah_type.value if s.asabah_type else None,
                "rule_applied": s.rule_applied,
                "reason": reason_for(s, lang),
                "source_id": s.source_id,
                "amount": _money(result.money_for(s)),
                "per_head_amount": _money(_per_head_money(result, s.per_head)),
            }
        )

    blocked = []
    for b in result.blocked:
        source_ids.add(b.source_id)
        blocked.append(
            {
                "relation": b.relation.value,
                "label_id": b.relation.label_id,
                "label": relation_label(b.relation.label_id, lang),
                "count": b.count,
                "blocked_by": b.blocked_by.value,
                "blocked_by_label": b.blocked_by.label_id,
                "reason": blocked_reason(b, lang),
                "source_id": b.source_id,
                "full": b.full,
            }
        )

    steps = []
    for st in result.steps:
        if st.source_id:
            source_ids.add(st.source_id)
        steps.append(
            {
                "step": st.step,
                "title": step_title(st.step, st.title, lang),
                "detail": st.detail,
                "source_id": st.source_id,
                "data": st.data,
            }
        )

    estate = None
    if result.estate is not None:
        e = result.estate
        estate = {
            "gross_value": _money(e.gross_value),
            "funeral_costs": _money(e.funeral_costs),
            "debts": _money(e.debts),
            "wasiyya": _money(e.wasiyya),
            "harta_bersama_deducted": _money(e.harta_bersama_deducted),
            "net_divisible": _money(e.net_divisible),
        }

    sources = {}
    for sid in sorted(source_ids):
        src = get_source(sid)
        sources[sid] = {
            "id": src.id,
            "type": src.type.value,
            "reference": src.reference,
            "pointer": src.pointer,
            "note": src.note,
        }

    return {
        "ruleset": result.ruleset.value,
        "mode": result.mode.value,
        "beta": result.beta,
        "pokok_masalah": result.pokok_masalah,
        "aul_applied": result.aul_applied,
        "aul_base": result.aul_base,
        "radd_applied": result.radd_applied,
        "estate": estate,
        "shares": shares,
        "blocked": blocked,
        "steps": steps,
        "notes": [translate_note(n, lang) for n in result.notes],
        "disclaimer": disclaimer(result.mode.value, lang),
        "sources": sources,
    }
