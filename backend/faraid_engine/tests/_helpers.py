"""Shared test helpers for the validation bank."""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

from faraid_engine import CalculationInput, Heirs, Relation, Ruleset, calculate

R = Relation


@dataclass
class Case:
    """One worked example with an independently-derived expected answer.

    ``expected`` maps each inheriting relation to its combined group share (fraction of
    the divisible estate). ``note`` records the case type / source of the hand derivation.
    """

    name: str
    heirs: Heirs
    ruleset: Ruleset
    expected: dict[Relation, Fraction]
    aul_base: int | None = None
    radd: bool | None = None
    blocked: set[Relation] = field(default_factory=set)
    baitul_mal: Fraction = Fraction(0)
    note: str = ""


def run_case(case: Case) -> None:
    result = calculate(CalculationInput(heirs=case.heirs, ruleset=case.ruleset))

    actual = {
        s.relation: s.share
        for s in result.shares
        if s.category.value != "harta_bersama"
    }
    assert actual == case.expected, (
        f"\n{case.name} [{case.ruleset.value}]"
        f"\n  expected: {{{_fmt(case.expected)}}}"
        f"\n  actual:   {{{_fmt(actual)}}}"
    )

    # Shares (+ any baitul-mal residue) must total exactly 1.
    total = sum(actual.values(), Fraction(0)) + case.baitul_mal
    assert total == Fraction(1), f"{case.name}: shares total {total}, not 1"

    if case.aul_base is not None:
        assert result.aul_base == case.aul_base, (
            f"{case.name}: expected 'aul base {case.aul_base}, got {result.aul_base}"
        )
    else:
        assert result.aul_base is None, f"{case.name}: unexpected 'aul {result.aul_base}"

    if case.radd is not None:
        assert result.radd_applied == case.radd, (
            f"{case.name}: expected radd={case.radd}, got {result.radd_applied}"
        )

    if case.blocked:
        blocked_relations = {b.relation for b in result.blocked}
        assert case.blocked <= blocked_relations, (
            f"{case.name}: expected blocked {case.blocked}, got {blocked_relations}"
        )

    # Every fired rule must resolve to a registered citation (PRD §5.3).
    from faraid_engine.sources import get_source

    for s in result.shares:
        get_source(s.source_id)


def _fmt(d: dict[Relation, Fraction]) -> str:
    return ", ".join(f"{k.value}={v}" for k, v in sorted(d.items(), key=lambda kv: kv[0].value))
