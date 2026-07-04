"""al-jadd wa al-ikhwah (grandfather + siblings, Zaid's muqasama) — Maliki/Syafi'i/Hanbali.

Expected values hand-derived from Zaid's method (the independent check). Covers the
supported cases; the intricate sub-cases (mu'adda, akdariyya, grandfather+siblings+
descendant) are asserted to raise rather than guess (CLAUDE.md).
"""

from __future__ import annotations

from fractions import Fraction as F

import pytest

from faraid_engine import (
    CalculationInput,
    Heirs,
    Relation,
    Ruleset,
    UnsupportedConfiguration,
    calculate,
)
from ._helpers import Case, run_case

R = Relation
S, MALIKI, HANBALI = Ruleset.SYAFII, Ruleset.MALIKI, Ruleset.HANBALI

MUQASAMA_CASES: list[Case] = [
    # Grandfather shares with brothers as a brother (2 heads) when that beats 1/3.
    Case("gf + 1 full brother → 1/2 each", Heirs(paternal_grandfather=True, full_brothers=1), S,
         {R.PATERNAL_GRANDFATHER: F(1, 2), R.FULL_BROTHER: F(1, 2)}),
    Case("gf + 2 full brothers → 1/3 each", Heirs(paternal_grandfather=True, full_brothers=2), S,
         {R.PATERNAL_GRANDFATHER: F(1, 3), R.FULL_BROTHER: F(2, 3)}),
    # With many brothers the grandfather is guaranteed 1/3 (muqasama would give less).
    Case("gf + 4 full brothers → gf 1/3 floor", Heirs(paternal_grandfather=True, full_brothers=4), S,
         {R.PATERNAL_GRANDFATHER: F(1, 3), R.FULL_BROTHER: F(2, 3)}),
    # Grandfather + a lone sister (no spouse): muqasama 2:1.
    Case("gf + 1 full sister → 2:1", Heirs(paternal_grandfather=True, full_sisters=1), MALIKI,
         {R.PATERNAL_GRANDFATHER: F(2, 3), R.FULL_SISTER: F(1, 3)}),
    Case("gf + full brother + full sister", Heirs(paternal_grandfather=True, full_brothers=1, full_sisters=1), HANBALI,
         {R.PATERNAL_GRANDFATHER: F(2, 5), R.FULL_BROTHER: F(2, 5), R.FULL_SISTER: F(1, 5)}),
    # With ashabul furud present, grandfather takes best of muqasama / 1/3-remainder / 1/6.
    Case("gf + mother + 2 full brothers", Heirs(paternal_grandfather=True, mother=True, full_brothers=2), S,
         {R.MOTHER: F(1, 6), R.PATERNAL_GRANDFATHER: F(5, 18), R.FULL_BROTHER: F(5, 9)}),
    # Paternal siblings behave like full when no full siblings are present.
    Case("gf + 1 paternal brother → 1/2 each", Heirs(paternal_grandfather=True, paternal_brothers=1), S,
         {R.PATERNAL_GRANDFATHER: F(1, 2), R.PATERNAL_BROTHER: F(1, 2)}),
]


@pytest.mark.parametrize("case", MUQASAMA_CASES, ids=[c.name for c in MUQASAMA_CASES])
def test_muqasama_cases(case: Case) -> None:
    run_case(case)


def test_mixed_full_and_paternal_raises():
    # mu'adda: a full sister (not brother) leaves paternal siblings competing → unimplemented.
    heirs = Heirs(paternal_grandfather=True, full_sisters=1, paternal_brothers=1)
    with pytest.raises(UnsupportedConfiguration):
        calculate(CalculationInput(heirs=heirs, ruleset=S))


def test_full_brother_blocks_paternal_then_muqasama():
    """A full brother blocks paternal siblings (hajb), so this is NOT mu'adda — the
    grandfather simply does muqasama with the full brother."""
    heirs = Heirs(paternal_grandfather=True, full_brothers=1, paternal_brothers=1)
    result = calculate(CalculationInput(heirs=heirs, ruleset=S))
    shares = {s.relation: s.share for s in result.shares}
    assert shares == {R.PATERNAL_GRANDFATHER: F(1, 2), R.FULL_BROTHER: F(1, 2)}
    assert R.PATERNAL_BROTHER in {b.relation for b in result.blocked}


def test_akdariyya_trigger_raises():
    # Grandfather + lone sister + spouse can trigger akdariyya — not implemented.
    heirs = Heirs(paternal_grandfather=True, full_sisters=1, husband=True, mother=True)
    with pytest.raises(UnsupportedConfiguration):
        calculate(CalculationInput(heirs=heirs, ruleset=S))


def test_grandfather_siblings_with_descendant_raises():
    heirs = Heirs(paternal_grandfather=True, full_brothers=1, daughters=1)
    with pytest.raises(UnsupportedConfiguration):
        calculate(CalculationInput(heirs=heirs, ruleset=S))


def test_muqasama_diverges_from_khi_which_blocks():
    """KHI/Hanafi block siblings with the grandfather; muqasama schools share with them."""
    heirs = Heirs(paternal_grandfather=True, full_brothers=1)
    khi = calculate(CalculationInput(heirs=heirs, ruleset=Ruleset.KHI))
    syafii = calculate(CalculationInput(heirs=heirs, ruleset=S))
    khi_gf = {s.relation: s.share for s in khi.shares}[R.PATERNAL_GRANDFATHER]
    syafii_gf = {s.relation: s.share for s in syafii.shares}[R.PATERNAL_GRANDFATHER]
    assert khi_gf == F(1)      # KHI: grandfather takes all, brother blocked
    assert syafii_gf == F(1, 2)  # Syafi'i: shares with the brother
