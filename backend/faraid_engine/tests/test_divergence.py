"""KHI vs. classical Syafi'i divergence tests (PRD §4.1) — the highest-risk area.

Kept as its own explicit file (CLAUDE.md build step 4) so the load-bearing differences
between the two Tier-1 rule sets are easy to audit. Each test asserts that the two rule
sets genuinely diverge — silent reuse of Syafi'i logic under the KHI label (or vice
versa) is the one failure mode PRD §4 designs against.
"""

from __future__ import annotations

from decimal import Decimal
from fractions import Fraction as F

import pytest

from faraid_engine import (
    CalculationInput,
    Estate,
    Heirs,
    InvalidHeirInput,
    Relation,
    Representative,
    Ruleset,
    UnsupportedConfiguration,
    calculate,
)

R = Relation
K = Ruleset.KHI
S = Ruleset.SYAFII


def _shares(result):
    return {s.relation: s.share for s in result.shares if s.category.value != "harta_bersama"}


# ---------------------------------------------------------------------------
# 1. Ahli waris pengganti (KHI Pasal 185) — no classical Syafi'i equivalent.
# ---------------------------------------------------------------------------
def test_pengganti_grandchildren_inherit_under_khi():
    """2 living sons + a predeceased son leaving a son & daughter.

    KHI: the predeceased son's branch takes his 1/3; grandson 2/9, granddaughter 1/9.
    """
    heirs = Heirs(
        sons=2,
        representatives=(Representative(replacing=R.SON, sons=1, daughters=1),),
    )
    result = calculate(CalculationInput(heirs=heirs, ruleset=K))
    shares = _shares(result)
    assert shares[R.SON] == F(2, 3)               # two living sons, 1/3 each
    assert shares[R.GRANDSON_VIA_SON] == F(2, 9)  # branch 1/3 split 2:1
    assert shares[R.GRANDDAUGHTER_VIA_SON] == F(1, 9)
    assert any("Pasal 185" in n for n in result.notes)


def test_syafii_has_no_representation_grandchildren_blocked():
    """Classical Syafi'i: the same grandchildren, on their own standing, are blocked by
    living sons and inherit NOTHING (they are not substitutes for a deceased parent)."""
    heirs = Heirs(sons=2, grandsons_via_son=1, granddaughters_via_son=1)
    result = calculate(CalculationInput(heirs=heirs, ruleset=S))
    shares = _shares(result)
    assert shares == {R.SON: F(1)}  # sons take everything
    blocked = {b.relation for b in result.blocked}
    assert {R.GRANDSON_VIA_SON, R.GRANDDAUGHTER_VIA_SON} <= blocked


def test_representation_rejected_on_syafii():
    """Representatives cannot even be submitted under classical Syafi'i (PRD §4.1)."""
    heirs = Heirs(sons=1, representatives=(Representative(replacing=R.SON, sons=1),))
    with pytest.raises(InvalidHeirInput):
        calculate(CalculationInput(heirs=heirs, ruleset=S))


def test_pengganti_changes_outcome_vs_classical():
    """The divergence is real: grandchildren get 1/3 under KHI, 0 under Syafi'i."""
    khi = calculate(CalculationInput(
        heirs=Heirs(sons=2, representatives=(Representative(R.SON, sons=1, daughters=1),)),
        ruleset=K,
    ))
    syafii = calculate(CalculationInput(
        heirs=Heirs(sons=2, grandsons_via_son=1, granddaughters_via_son=1), ruleset=S,
    ))
    khi_grandkids = sum(
        (s.share for s in khi.shares if s.relation in {R.GRANDSON_VIA_SON, R.GRANDDAUGHTER_VIA_SON}),
        F(0),
    )
    syafii_grandkids = sum(
        (s.share for s in syafii.shares if s.relation in {R.GRANDSON_VIA_SON, R.GRANDDAUGHTER_VIA_SON}),
        F(0),
    )
    assert khi_grandkids == F(1, 3)
    assert syafii_grandkids == F(0)


# ---------------------------------------------------------------------------
# 2. Dzawil arham / radd routing — baitul mal (classical) vs distribution (KHI).
# ---------------------------------------------------------------------------
def test_sole_spouse_baitul_mal_vs_radd():
    """Husband as sole heir: classical routes surplus to baitul mal; KHI gives it all
    to the spouse by radd (PRD §4.1 — no functioning baitul mal in practice)."""
    syafii = calculate(CalculationInput(heirs=Heirs(husband=True), ruleset=S))
    khi = calculate(CalculationInput(heirs=Heirs(husband=True), ruleset=K))

    s_share = {s.relation: s.share for s in syafii.shares}[R.HUSBAND]
    k_share = {s.relation: s.share for s in khi.shares}[R.HUSBAND]
    assert s_share == F(1, 2)  # classical: spouse keeps only the fixed 1/2
    assert k_share == F(1)     # KHI practice: spouse takes everything
    assert any("baitul mal" in n.lower() for n in syafii.notes)


# ---------------------------------------------------------------------------
# 3. Harta bersama (KHI-only marital community property, deducted pre-faraid).
# ---------------------------------------------------------------------------
def test_harta_bersama_khi_only_deducted_before_faraid():
    """Estate 1000, all of it joint marital assets, heirs wife + son.

    Wife keeps 500 harta bersama first; faraid then divides the remaining 500
    (wife 1/8 = 62.5, son 7/8 = 437.5)."""
    estate = Estate(gross_value=Decimal("1000"), joint_assets=Decimal("1000"))
    result = calculate(CalculationInput(
        heirs=Heirs(wives=1, sons=1), ruleset=K, estate=estate, apply_harta_bersama=True,
    ))
    assert result.estate.harta_bersama_deducted == Decimal("500")
    assert result.estate.net_divisible == Decimal("500")

    hb = [s for s in result.shares if s.category.value == "harta_bersama"]
    assert hb and "500" in hb[0].reason

    faraid = {s.relation: result.money_for(s) for s in result.shares if s.category.value != "harta_bersama"}
    assert faraid[R.WIFE] == Decimal("62.5")
    assert faraid[R.SON] == Decimal("437.5")


def test_harta_bersama_rejected_on_syafii():
    """Classical Syafi'i has no harta bersama concept — requesting it is an error."""
    estate = Estate(gross_value=Decimal("1000"), joint_assets=Decimal("1000"))
    with pytest.raises(InvalidHeirInput):
        calculate(CalculationInput(
            heirs=Heirs(wives=1, sons=1), ruleset=S, estate=estate, apply_harta_bersama=True,
        ))


def test_harta_bersama_off_by_default_changes_result():
    """With HB off, the same wife+son divide the full 1000 (wife 125, son 875)."""
    estate = Estate(gross_value=Decimal("1000"), joint_assets=Decimal("1000"))
    result = calculate(CalculationInput(heirs=Heirs(wives=1, sons=1), ruleset=K, estate=estate))
    assert result.estate.net_divisible == Decimal("1000")
    money = {s.relation: result.money_for(s) for s in result.shares}
    assert money[R.WIFE] == Decimal("125")
    assert money[R.SON] == Decimal("875")


# ---------------------------------------------------------------------------
# 4. Grandfather + siblings — KHI blocks; classical Syafi'i is unimplemented (raises).
# ---------------------------------------------------------------------------
def test_grandfather_blocks_siblings_under_khi():
    """KHI treats the grandfather like the father, blocking full siblings."""
    heirs = Heirs(paternal_grandfather=True, full_brothers=1, full_sisters=1)
    result = calculate(CalculationInput(heirs=heirs, ruleset=K))
    shares = _shares(result)
    assert shares == {R.PATERNAL_GRANDFATHER: F(1)}
    blocked = {b.relation for b in result.blocked}
    assert {R.FULL_BROTHER, R.FULL_SISTER} <= blocked


def test_grandfather_with_siblings_uses_muqasama_under_syafii():
    """Syafi'i shares between grandfather and siblings via Zaid's muqasama — it does NOT
    block the siblings the way KHI does (see test_jadd_ikhwah for the full bank)."""
    heirs = Heirs(paternal_grandfather=True, full_brothers=1, full_sisters=1)
    result = calculate(CalculationInput(heirs=heirs, ruleset=S))
    shares = _shares(result)
    assert shares == {R.PATERNAL_GRANDFATHER: F(2, 5), R.FULL_BROTHER: F(2, 5), R.FULL_SISTER: F(1, 5)}
