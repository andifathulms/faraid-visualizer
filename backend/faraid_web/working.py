"""The pokok masalah working — the tabular form a practitioner actually verifies against.

``CalculationResult`` already carries ``pokok_masalah``, ``aul_base`` and every heir's
final :class:`~fractions.Fraction`, but the app only ever rendered those as metadata: a
badge reading "pokok masalah 12" beside a list of fractions. That is the one
representation of a faraid result a trained user does NOT check against, because the
thing they check is the siham column — each heir's share expressed as whole parts of the
base, and the sum of those parts against the base.

Deriving it here rather than in the frontend keeps the arithmetic in one place, with
tests, shared by the JSON wire format and the PDF. The UI never computes siham itself,
for the same reason it never divides money itself.

Two deliberate limits:

* **No tashih al-mas'alah.** When a group's siham do not divide evenly among its members
  (5 siham between 2 sons), classical working multiplies the base until every individual
  holds a whole number. That is a further derivation step, and adding one would require
  its own citation and test fixtures in the same change (CLAUDE.md). This module reports
  the per-head value as the exact fraction it is and leaves the scaling to the reader.
* **Never approximate.** If any group's share does not resolve to a whole number of
  siham over the base, the whole working is withheld (``None``) rather than rounded. A
  table of integers that are not the real integers is worse than no table: it would be a
  number the user cannot trace to a rule.
"""

from __future__ import annotations

from fractions import Fraction

from faraid_engine import CalculationResult
from faraid_engine.results import ShareCategory

from .labels import relation_label


def _fraction(f: Fraction) -> dict:
    return {
        "numerator": f.numerator,
        "denominator": f.denominator,
        "text": f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator),
    }


def working_table(result: CalculationResult, lang: str = "id") -> dict | None:
    """Return the siham working for ``result``, or ``None`` if it cannot be exact.

    The base is ``aul_base`` when 'aul fired and ``pokok_masalah`` otherwise. In both
    cases every awarded share is by construction a whole number of parts over that base:
    'aul rewrites each share as ``n/aul_base``, and ``pokok_masalah`` is otherwise the LCM
    of the final denominators. The exactness check below is therefore an assertion about
    the engine, not a tolerance — if it ever fails, the table is withheld rather than
    fudged, and the shares above it are still correct.
    """
    base = result.aul_base or result.pokok_masalah
    if base < 1:
        return None

    # Harta bersama is a pre-faraid separation, not a share of the divided estate, so it
    # has no siham and must not appear in a column that sums against the base.
    awarded = [s for s in result.shares if s.category != ShareCategory.HARTA_BERSAMA]
    if not awarded:
        return None

    rows = []
    total = 0
    for s in awarded:
        siham = s.share * base
        if siham.denominator != 1:
            return None
        rows.append(
            {
                "label_id": s.relation.label_id,
                "label": relation_label(s.relation.label_id, lang),
                "count": s.count,
                "category": s.category.value,
                "share": _fraction(s.share),
                "siham": siham.numerator,
                # Exact per-individual parts. Non-integral here is normal and is precisely
                # what tashih would resolve; it is reported, not hidden.
                "per_head_siham": _fraction(s.per_head * base),
            }
        )
        total += siham.numerator

    return {
        "base": base,
        "pokok_masalah": result.pokok_masalah,
        "aul_base": result.aul_base,
        "aul_applied": result.aul_applied,
        "radd_applied": result.radd_applied,
        "rows": rows,
        "total_siham": total,
        # Equal in the ordinary case; short when a residue goes to baitul mal, which the
        # engine records as a note rather than as an award.
        "balanced": total == base,
    }


__all__ = ["working_table"]
