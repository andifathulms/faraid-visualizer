"""'Aul with two grandmothers — the collective 1/6 must be one share, not two halves.

Al-jaddat take 1/6 together and divide it equally (hadith: Abu Dawud 2894 / Tirmidhi
2101). The engine displays them as two rows because hajb treats them differently — a
surviving father blocks the paternal grandmother and not the maternal one — but 'aul has
to reason about the 1/6, not about the halves.

Splitting first made the pokok masalah 12 instead of 6 and produced ratios like 12→14,
which apply_aul's validity guard correctly rejected as impossible 'aul cases. The user saw
an engine_error: the generic crash state, worse than either a correct answer or an honest
"unsupported". 140 configurations reached it, across all five rule sets.

The awarded fractions were never wrong — only the base they were expressed over — so the
expected values below are unchanged from what the engine already computed internally, and
are hand-derived from the classical working.
"""

from __future__ import annotations

from fractions import Fraction as F

import pytest

from faraid_engine import CalculationInput, Heirs, Ruleset, calculate
from faraid_engine.rules.aul import VALID_AUL

BOTH_GM = {"paternal_grandmother": True, "maternal_grandmother": True}


def result(heirs: Heirs, ruleset: Ruleset = Ruleset.KHI):
    return calculate(CalculationInput(heirs=heirs, ruleset=ruleset))


def shares(r) -> dict[str, F]:
    return {s.relation.label_id: s.share for s in r.shares}


class TestTheFourCasesThatUsedToCrash:
    """Each was hand-derived from the furud, then checked against the engine.

    Working for the first: husband 1/2, grandmothers 1/6, full sister 1/2. Over a base of
    6 that is 3 + 1 + 3 = 7 siham — more than 6, so 'aul raises the base to 7.
    """

    def test_husband_two_grandmothers_one_full_sister(self):
        r = result(Heirs(husband=True, full_sisters=1, **BOTH_GM), Ruleset.SYAFII)
        assert (r.pokok_masalah, r.aul_base) == (6, 7)
        s = shares(r)
        assert s["suami"] == F(3, 7)
        assert s["saudari_kandung"] == F(3, 7)
        # The collective 1/6 becomes a collective 1/7, split equally.
        assert s["nenek_ayah"] == F(1, 14)
        assert s["nenek_ibu"] == F(1, 14)
        assert s["nenek_ayah"] + s["nenek_ibu"] == F(1, 7)

    def test_husband_two_grandmothers_two_full_sisters(self):
        """3 + 1 + 4 = 8 siham over 6."""
        r = result(Heirs(husband=True, full_sisters=2, **BOTH_GM), Ruleset.SYAFII)
        assert (r.pokok_masalah, r.aul_base) == (6, 8)
        s = shares(r)
        assert s["suami"] == F(3, 8)
        assert s["saudari_kandung"] == F(1, 2)  # 4/8
        assert s["nenek_ayah"] + s["nenek_ibu"] == F(1, 8)

    def test_with_maternal_siblings(self):
        """3 + 1 + 3 + 2 = 9 siham over 6."""
        r = result(Heirs(husband=True, full_sisters=1, maternal_siblings=2, **BOTH_GM), Ruleset.SYAFII)
        assert (r.pokok_masalah, r.aul_base) == (6, 9)
        s = shares(r)
        assert s["suami"] == F(1, 3)  # 3/9
        assert s["saudara_seibu"] == F(2, 9)
        assert s["nenek_ayah"] + s["nenek_ibu"] == F(1, 9)

    def test_the_full_house(self):
        """3 + 1 + 4 + 2 = 10 siham over 6 — the largest valid 'aul from base 6."""
        r = result(Heirs(husband=True, full_sisters=2, maternal_siblings=2, **BOTH_GM), Ruleset.SYAFII)
        assert (r.pokok_masalah, r.aul_base) == (6, 10)
        s = shares(r)
        assert s["suami"] == F(3, 10)
        assert s["saudari_kandung"] == F(2, 5)  # 4/10
        assert s["saudara_seibu"] == F(1, 5)    # 2/10
        assert s["nenek_ayah"] + s["nenek_ibu"] == F(1, 10)

    @pytest.mark.parametrize("ruleset", list(Ruleset))
    def test_every_rule_set_now_resolves_the_smallest_trigger(self, ruleset):
        """It crashed under all five, so all five are asserted."""
        r = result(Heirs(husband=True, full_sisters=1, **BOTH_GM), ruleset)
        assert r.aul_base in VALID_AUL[r.pokok_masalah]
        assert sum((s.share for s in r.shares), F(0)) == 1


class TestTheCollectiveShareIsPreserved:
    def test_a_single_grandmother_still_takes_the_whole_sixth(self):
        """The grouping must not change the one-grandmother case, which never grouped."""
        for gm in ("paternal_grandmother", "maternal_grandmother"):
            r = result(Heirs(sons=1, **{gm: True}))
            assert shares(r)[{"paternal_grandmother": "nenek_ayah",
                              "maternal_grandmother": "nenek_ibu"}[gm]] == F(1, 6)

    def test_two_grandmothers_split_the_sixth_when_there_is_no_aul(self):
        r = result(Heirs(sons=1, **BOTH_GM))
        s = shares(r)
        assert s["nenek_ayah"] == F(1, 12)
        assert s["nenek_ibu"] == F(1, 12)
        assert s["nenek_ayah"] + s["nenek_ibu"] == F(1, 6)

    def test_a_father_blocks_only_the_paternal_grandmother(self):
        """Why they cannot simply be merged into one row: hajb separates them, so the
        maternal grandmother then holds the entire 1/6 alone."""
        r = result(Heirs(father=True, sons=1, **BOTH_GM))
        s = shares(r)
        assert "nenek_ayah" not in s
        assert s["nenek_ibu"] == F(1, 6)
        assert [b.relation.label_id for b in r.blocked] == ["nenek_ayah"]


class TestNoInvalidBaseIsReachable:
    """The guard is right; nothing should be able to trip it.

    A targeted sweep rather than the full 280k-configuration enumeration, so it stays fast
    enough to run on every commit. It covers the shape that caused this — both
    grandmothers alongside every combination of the heirs that push a base-6 problem into
    'aul.
    """

    @pytest.mark.parametrize("sisters", [0, 1, 2])
    @pytest.mark.parametrize("maternal", [0, 1, 2])
    @pytest.mark.parametrize("spouse", ["husband", "wives"])
    @pytest.mark.parametrize("ruleset", [Ruleset.KHI, Ruleset.SYAFII])
    def test_sweep(self, sisters, maternal, spouse, ruleset):
        kw = {"full_sisters": sisters, "maternal_siblings": maternal, **BOTH_GM}
        kw[spouse] = True if spouse == "husband" else 1
        r = result(Heirs(**kw), ruleset)
        if r.aul_base is not None:
            assert r.aul_base in VALID_AUL[r.pokok_masalah], (
                f"invalid 'aul {r.pokok_masalah}->{r.aul_base} for {kw}"
            )
        assert sum((s.share for s in r.shares), F(0)) + F(0) <= 1
