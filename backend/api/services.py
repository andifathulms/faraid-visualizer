"""Bridge between the pure engine and the HTTP layer.

Serializes a :class:`faraid_engine.CalculationResult` into a JSON-able dict that carries
the FULL structured derivation (not just final shares) so the frontend can render the
step-by-step view (CLAUDE.md build step 5). Every cited ``source_id`` is resolved to its
citation and bundled under ``sources`` so the UI renders footnotes without a second call.
"""

from __future__ import annotations

from decimal import Decimal
from fractions import Fraction

from faraid_engine import CalculationResult
from faraid_engine.sources import get_source


def _fraction(f: Fraction) -> dict:
    return {
        "numerator": f.numerator,
        "denominator": f.denominator,
        "text": f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator),
        "float": float(f),
    }


def _money(d: Decimal | None) -> str | None:
    return None if d is None else str(d.quantize(Decimal("0.01")))


def serialize_result(result: CalculationResult) -> dict:
    source_ids: set[str] = set()

    shares = []
    for s in result.shares:
        source_ids.add(s.source_id)
        shares.append(
            {
                "relation": s.relation.value,
                "label_id": s.relation.label_id,
                "count": s.count,
                "share": _fraction(s.share),
                "per_head": _fraction(s.per_head),
                "category": s.category.value,
                "asabah_type": s.asabah_type.value if s.asabah_type else None,
                "rule_applied": s.rule_applied,
                "reason": s.reason,
                "source_id": s.source_id,
                "amount": _money(result.money_for(s)),
            }
        )

    blocked = []
    for b in result.blocked:
        source_ids.add(b.source_id)
        blocked.append(
            {
                "relation": b.relation.value,
                "label_id": b.relation.label_id,
                "count": b.count,
                "blocked_by": b.blocked_by.value,
                "blocked_by_label": b.blocked_by.label_id,
                "reason": b.reason,
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
                "title": st.title,
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
        "notes": result.notes,
        "disclaimer": result.disclaimer,
        "sources": sources,
    }
