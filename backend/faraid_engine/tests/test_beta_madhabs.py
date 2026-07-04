"""Tier-2 madhab tests (PRD §4 / CLAUDE.md build step 8).

New madhabs ship with citations AND fixtures in the same change (CLAUDE.md guardrail).
These assert the Beta flag, the citable divergences each school is known for on the
modeled heirs, and that unimplemented corners still raise rather than guess. This is NOT
the ≥30-example validation pass required to REMOVE the Beta badge — the badge stays.
"""

from __future__ import annotations

from fractions import Fraction as F

import pytest

from faraid_engine import (
    CalculationInput,
    Heirs,
    InvalidHeirInput,
    Relation,
    Representative,
    Ruleset,
    UnsupportedConfiguration,
    calculate,
)
from ._helpers import Case, run_case

R = Relation
HANAFI, MALIKI, HANBALI = Ruleset.HANAFI, Ruleset.MALIKI, Ruleset.HANBALI

# Value cases run through the shared bank harness (independently hand-derived).
BETA_CASES: list[Case] = [
    # Standard furud/asabah must match the other schools (same ayat).
    Case("hanafi: son+father+mother", Heirs(sons=1, father=True, mother=True), HANAFI,
         {R.FATHER: F(1, 6), R.MOTHER: F(1, 6), R.SON: F(2, 3)}),
    Case("hanbali: husband+father+mother (gharrawain)", Heirs(husband=True, father=True, mother=True), HANBALI,
         {R.HUSBAND: F(1, 2), R.MOTHER: F(1, 6), R.FATHER: F(1, 3)}),

    # Radd divergence: Hanafi/Hanbali apply radd; Maliki does NOT (surplus → baitul mal).
    Case("hanafi: mother+2 daughters → radd", Heirs(mother=True, daughters=2), HANAFI,
         {R.MOTHER: F(1, 5), R.DAUGHTER: F(4, 5)}, radd=True),
    Case("hanbali: mother+2 daughters → radd", Heirs(mother=True, daughters=2), HANBALI,
         {R.MOTHER: F(1, 5), R.DAUGHTER: F(4, 5)}, radd=True),
    Case("maliki: mother+2 daughters → NO radd, baitul mal 1/6", Heirs(mother=True, daughters=2), MALIKI,
         {R.MOTHER: F(1, 6), R.DAUGHTER: F(2, 3)}, radd=False, baitul_mal=F(1, 6)),
    Case("maliki: husband alone → baitul mal", Heirs(husband=True), MALIKI,
         {R.HUSBAND: F(1, 2)}, radd=False, baitul_mal=F(1, 2)),

    # Hanafi: grandfather blocks siblings (like the father).
    Case("hanafi: grandfather blocks full siblings", Heirs(paternal_grandfather=True, full_brothers=1, full_sisters=1), HANAFI,
         {R.PATERNAL_GRANDFATHER: F(1)}, blocked={R.FULL_BROTHER, R.FULL_SISTER}),
]


@pytest.mark.parametrize("case", BETA_CASES, ids=[c.name for c in BETA_CASES])
def test_beta_value_cases(case: Case) -> None:
    run_case(case)


@pytest.mark.parametrize("ruleset", [HANAFI, MALIKI, HANBALI])
def test_beta_flag_set_and_noted(ruleset: Ruleset) -> None:
    result = calculate(CalculationInput(heirs=Heirs(sons=1), ruleset=ruleset))
    assert result.beta is True
    assert any("BETA" in n for n in result.notes)


@pytest.mark.parametrize("ruleset", [MALIKI, HANBALI])
def test_muqasama_schools_share_grandfather_with_siblings(ruleset: Ruleset) -> None:
    """Maliki & Hanbali apply Zaid's muqasama: grandfather shares with a lone brother 1:1
    (see test_jadd_ikhwah for the full bank). The intricate sub-cases still raise."""
    heirs = Heirs(paternal_grandfather=True, full_brothers=1)
    result = calculate(CalculationInput(heirs=heirs, ruleset=ruleset))
    shares = {s.relation: s.share for s in result.shares}
    assert shares == {R.PATERNAL_GRANDFATHER: F(1, 2), R.FULL_BROTHER: F(1, 2)}

    # mu'adda (full sister leaving paternal siblings competing) is unimplemented → raises.
    with pytest.raises(UnsupportedConfiguration):
        calculate(CalculationInput(
            heirs=Heirs(paternal_grandfather=True, full_sisters=1, paternal_brothers=1), ruleset=ruleset,
        ))


@pytest.mark.parametrize("ruleset", [HANAFI, MALIKI, HANBALI])
def test_representation_and_harta_bersama_rejected_on_beta_madhabs(ruleset: Ruleset) -> None:
    with pytest.raises(InvalidHeirInput):
        calculate(CalculationInput(
            heirs=Heirs(sons=1, representatives=(Representative(R.SON, sons=1),)), ruleset=ruleset,
        ))


def test_maliki_vs_hanbali_radd_genuinely_diverges() -> None:
    heirs = Heirs(mother=True, daughters=2)
    maliki = calculate(CalculationInput(heirs=heirs, ruleset=MALIKI))
    hanbali = calculate(CalculationInput(heirs=heirs, ruleset=HANBALI))
    m = {s.relation: s.share for s in maliki.shares}[R.DAUGHTER]
    h = {s.relation: s.share for s in hanbali.shares}[R.DAUGHTER]
    assert m == F(2, 3)   # Maliki: no radd
    assert h == F(4, 5)   # Hanbali: radd
    assert m != h
