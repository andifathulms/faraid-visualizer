"""Does the other Tier-1 rule set give a different answer?

PRD §4.1 names silent conflation of KHI and classical Syafi'i as *the* failure mode the
project is designing against, and models them as two separate rule sets to avoid it. The
comparison endpoint then made that visible — but only to a user who ticked a box, which
is a user who already knew the divergence existed. Everyone else took the KHI default and
was never told their case was one where the two part ways.

This runs the counterpart Tier-1 rule set alongside the requested one and reports whether
the division actually differs. It is a *detector*, not a second result: it says that the
answers diverge and on which heirs, and leaves rendering both derivations to the existing
side-by-side comparison. Nothing here decides which rule set is right.

Scope is deliberately Tier 1 only. Hanafi/Maliki/Hanbali are Beta (PRD §4) and have no
designated counterpart; pairing a Beta rule set against a validated one would invite the
user to read a Beta disagreement as evidence about KHI.
"""

from __future__ import annotations

from fractions import Fraction

from faraid_engine import Ruleset, UnsupportedConfiguration, calculate
from faraid_engine.exceptions import InvalidHeirInput
from faraid_engine.results import CalculationResult, ShareCategory

from .labels import relation_label, ruleset_label
from .validate import build_input

#: The two fully-validated rule sets, each the other's counterpart (PRD §4 tier 1).
COUNTERPART: dict[str, str] = {
    Ruleset.KHI.value: Ruleset.SYAFII.value,
    Ruleset.SYAFII.value: Ruleset.KHI.value,
}


def _faraid_shares(result: CalculationResult) -> dict[str, Fraction]:
    """Awarded shares keyed by relation.

    Harta bersama is excluded: it is a pre-faraid separation of marital property, not a
    share of the divided estate, so including it would report every harta-bersama case as
    a fractional divergence when the fractions are in fact identical. That case is
    reported separately and precisely — see ``harta_bersama_only``.
    """
    return {
        s.relation.value: s.share
        for s in result.shares
        if s.category != ShareCategory.HARTA_BERSAMA
    }


def _fraction(f: Fraction | None) -> dict | None:
    if f is None:
        return None
    return {
        "numerator": f.numerator,
        "denominator": f.denominator,
        "text": f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator),
    }


def detect_divergence(
    data: dict,
    result: CalculationResult,
    *,
    mode_override: str | None = None,
    lang: str = "id",
) -> dict | None:
    """Compare ``result`` against the counterpart Tier-1 rule set.

    Returns ``None`` when there is no counterpart to compare against (a Beta rule set), so
    the caller renders nothing. Otherwise returns a status of ``same``, ``differs`` or
    ``unsupported`` — the last being a real answer, not a failure: "classical Syafi'i
    cannot express this configuration" is itself a divergence worth surfacing.
    """
    used = result.ruleset.value
    other = COUNTERPART.get(used)
    if other is None:
        return None

    base = {
        "ruleset": used,
        "ruleset_label": ruleset_label(used, lang),
        "counterpart": other,
        "counterpart_label": ruleset_label(other, lang),
    }

    try:
        other_result = calculate(
            build_input(data, mode_override=mode_override, ruleset_override=other)
        )
    except (InvalidHeirInput, UnsupportedConfiguration) as exc:
        # The counterpart refuses the configuration. Reported as-is; the engine declining
        # to guess is meaningful information about the two rule sets, not an error here.
        return {**base, "status": "unsupported", "detail": str(exc), "rows": []}

    mine = _faraid_shares(result)
    theirs = _faraid_shares(other_result)

    rows = []
    for relation in sorted(set(mine) | set(theirs)):
        a, b = mine.get(relation), theirs.get(relation)
        if a == b:
            continue
        label_id = _label_id_for(result, other_result, relation)
        rows.append(
            {
                "relation": relation,
                "label_id": label_id,
                "label": relation_label(label_id, lang),
                "this": _fraction(a),
                "other": _fraction(b),
            }
        )

    if rows:
        return {**base, "status": "differs", "harta_bersama_only": False, "rows": rows}

    # Identical fractions. Under KHI with harta bersama applied the *amounts* still differ,
    # because half the joint property is separated before faraid and classical fiqh has no
    # such step at all (PRD §4.1). Saying "these agree" there would be false.
    hb = any(s.category == ShareCategory.HARTA_BERSAMA for s in result.shares)
    return {**base, "status": "same", "harta_bersama_only": hb, "rows": []}


def _label_id_for(a: CalculationResult, b: CalculationResult, relation: str) -> str:
    """The display label id for a relation that may appear in only one of the two results."""
    for result in (a, b):
        for s in result.shares:
            if s.relation.value == relation:
                return s.relation.label_id
    return relation


__all__ = ["COUNTERPART", "detect_divergence"]
