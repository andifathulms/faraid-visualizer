"""Which heirs are load-bearing, and which change nothing.

The app shows one derivation. A derivation you cannot perturb is still being taken on
faith, and the thing a family actually needs to know before an argument is not only "what
is my share" but "what would change it" — because the next sentence at the family meeting
is always "but what about so-and-so?"

The engine is pure, local and has no I/O, so the honest way to answer that is to run the
case again with one heir slot moved and compare. Every cell below is therefore a real,
fully derived, fully cited calculation, not an estimate or a heuristic about hajb.

What it exposes that a single result cannot: most heir slots are inert given the others.
A result lists who *was* blocked in this case; it never shows that adding a full brother
would change nothing because a son blocks him, while the father being alive moves
everything. That structure is the actual content of faraid, and it was invisible.

Deliberately descriptive, never advisory. Each row states what the division would be under
a stated hypothetical; nothing here suggests the user should go and check whether someone
is alive, and nothing ranks the heirs by importance.
"""

from __future__ import annotations

from dataclasses import replace
from fractions import Fraction

from faraid_engine import (
    CalculationResult,
    UnsupportedConfiguration,
    calculate,
)
from faraid_engine.exceptions import EngineInvariantError, InvalidHeirInput
from faraid_engine.heirs import Relation
from faraid_engine.results import ShareCategory

from .labels import relation_label
from .validate import MAX_WIVES, build_input

#: Heir slot → the relation it produces, for looking the slot up in a blocked list.
SLOT_RELATION: dict[str, Relation] = {
    "husband": Relation.HUSBAND,
    "wives": Relation.WIFE,
    "sons": Relation.SON,
    "daughters": Relation.DAUGHTER,
    "father": Relation.FATHER,
    "mother": Relation.MOTHER,
    "paternal_grandfather": Relation.PATERNAL_GRANDFATHER,
    "paternal_grandmother": Relation.PATERNAL_GRANDMOTHER,
    "maternal_grandmother": Relation.MATERNAL_GRANDMOTHER,
    "grandsons_via_son": Relation.GRANDSON_VIA_SON,
    "granddaughters_via_son": Relation.GRANDDAUGHTER_VIA_SON,
    "full_brothers": Relation.FULL_BROTHER,
    "full_sisters": Relation.FULL_SISTER,
    "paternal_brothers": Relation.PATERNAL_BROTHER,
    "paternal_sisters": Relation.PATERNAL_SISTER,
    "maternal_siblings": Relation.MATERNAL_SIBLING,
}

BOOL_SLOTS = frozenset(
    {"husband", "father", "mother", "paternal_grandfather", "paternal_grandmother",
     "maternal_grandmother"}
)


def _shares(result: CalculationResult) -> dict[str, Fraction]:
    """Awarded faraid shares by relation. Harta bersama is pre-faraid, so it is excluded."""
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


def _perturbations(heirs: dict) -> list[tuple[str, str, object, object]]:
    """(slot, direction, from, to) for every single-slot counterfactual worth running.

    Two directions only, because they are the two questions people actually ask:
    "what if this person were not an heir" and "what if there were also one of these".
    Contradictory pairs are skipped rather than reported as errors — swapping a husband
    for a wife is a different family, not a perturbation of this one.
    """
    out: list[tuple[str, str, object, object]] = []
    has_husband = bool(heirs.get("husband"))
    wives = int(heirs.get("wives") or 0)

    for slot in SLOT_RELATION:
        current = heirs.get(slot) or (False if slot in BOOL_SLOTS else 0)

        if slot in BOOL_SLOTS:
            if current:
                out.append((slot, "remove", True, False))
            else:
                if slot == "husband" and wives > 0:
                    continue  # a husband and wives cannot both be heirs of one estate
                out.append((slot, "add", False, True))
        else:
            count = int(current)
            if count > 0:
                out.append((slot, "remove", count, 0))
            else:
                if slot == "wives" and has_husband:
                    continue
                if slot == "wives" and count >= MAX_WIVES:
                    continue
                out.append((slot, "add", 0, 1))
    return out


def _blocked_entry(result: CalculationResult, relation: Relation):
    for b in result.blocked:
        if b.relation == relation:
            return b
    return None


def analyze(
    data: dict,
    result: CalculationResult,
    *,
    mode_override: str | None = None,
    lang: str = "id",
) -> dict:
    """Run every single-slot counterfactual against ``result`` and report what moves."""
    base = _shares(result)
    heirs = data["heirs"]

    changing: list[dict] = []
    inert: list[dict] = []
    refused: list[dict] = []

    for slot, direction, frm, to in _perturbations(heirs):
        variant = dict(data)
        variant["heirs"] = {**heirs, slot: to}
        relation = SLOT_RELATION[slot]
        row = {
            "slot": slot,
            "relation": relation.value,
            "label": relation_label(relation.label_id, lang),
            "direction": direction,
            "from": frm,
            "to": to,
        }

        try:
            other = calculate(build_input(variant, mode_override=mode_override))
        except (InvalidHeirInput, UnsupportedConfiguration) as exc:
            # The engine declines this hypothetical. Reported, not hidden: "we cannot
            # answer that one" is the same refusal the product makes everywhere else.
            refused.append({**row, "status": "unsupported", "detail": str(exc)})
            continue
        except EngineInvariantError as exc:  # pragma: no cover - an engine bug, not input
            refused.append({**row, "status": "engine_error", "detail": str(exc)})
            continue

        after = _shares(other)
        changed = []
        for rel in sorted(set(base) | set(after)):
            a, b = base.get(rel), after.get(rel)
            if a == b:
                continue
            label_id = _label_id(result, other, rel)
            changed.append(
                {
                    "relation": rel,
                    "label": relation_label(label_id, lang),
                    "from": _fraction(a),
                    "to": _fraction(b),
                }
            )

        if changed:
            changing.append({**row, "status": "changes", "changed": changed})
            continue

        # Nothing moved. For an added heir that is the interesting answer, and the reason
        # is usually hajb — so name the heir who blocks them rather than leaving the user
        # to infer it. This is the structure a single result never shows.
        entry = _blocked_entry(other, relation) if direction == "add" else None
        inert.append(
            {
                **row,
                "status": "no_change",
                "changed": [],
                "blocked_by": relation_label(entry.blocked_by.label_id, lang) if entry else None,
                "blocked_reason_source": entry.source_id if entry else None,
            }
        )

    return {
        "base_ruleset": result.ruleset.value,
        "changing": changing,
        "inert": inert,
        "refused": refused,
        "counts": {
            "changing": len(changing),
            "inert": len(inert),
            "refused": len(refused),
        },
    }


def _label_id(a: CalculationResult, b: CalculationResult, relation: str) -> str:
    for res in (a, b):
        for s in res.shares:
            if s.relation.value == relation:
                return s.relation.label_id
        for blocked in res.blocked:
            if blocked.relation.value == relation:
                return blocked.relation.label_id
    return relation


__all__ = ["analyze", "SLOT_RELATION"]
