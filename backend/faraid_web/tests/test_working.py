"""Tests for the siham working table.

The table introduces no fiqh rule — it re-expresses shares the engine already derived as
whole parts of the base. But it is a column of integers a practitioner will check their
own paper working against, so it is pinned like the rest of the ledger: hand-derived
expected values, and an explicit test that an inexact table is withheld rather than
rounded.
"""

from __future__ import annotations

from fractions import Fraction

import pytest

from faraid_engine import CalculationResult, Mode, Ruleset
from faraid_engine.results import AsabahType, HeirShare, ShareCategory
from faraid_engine.heirs import Relation
from faraid_web.service import calculate_payload
from faraid_web.working import working_table


def working_for(heirs: dict, ruleset: str = "khi", lang: str = "id") -> dict:
    payload = {"heirs": heirs, "ruleset": ruleset, "lang": lang}
    working = calculate_payload(payload)["working"]
    assert working is not None, "expected an exact working table"
    return working


def siham(working: dict) -> dict[str, int]:
    return {row["label_id"]: row["siham"] for row in working["rows"]}


class TestPlainCase:
    def test_wife_and_two_sons_over_base_eight(self):
        """Wife 1/8, two sons take the residue 7/8. Base 8 → siham 1 and 7."""
        w = working_for({"wives": 1, "sons": 2})
        assert w["base"] == 8
        assert w["aul_applied"] is False
        assert siham(w) == {"istri": 1, "anak_laki": 7}
        assert w["total_siham"] == 8
        assert w["balanced"] is True

    def test_husband_and_daughter_over_base_four(self):
        """Husband 1/4 (a child survives), daughter 1/2, radd returns the rest."""
        w = working_for({"husband": True, "daughters": 1})
        assert w["total_siham"] == w["base"]
        assert w["balanced"] is True


class TestAul:
    def test_base_is_the_raised_base_and_siham_survive_it(self):
        """The classic 6→7: husband 1/2 and two full sisters 2/3.

        'Aul's whole content is that the siham do NOT change — 3 and 4 — while the base
        rises from 6 to 7 to accommodate them. That is exactly what a fraction list hides
        and this table exists to show, so it is asserted directly.
        """
        w = working_for({"husband": True, "full_sisters": 2}, ruleset="syafii")
        assert w["pokok_masalah"] == 6
        assert w["aul_base"] == 7
        assert w["base"] == 7
        assert w["aul_applied"] is True
        assert siham(w) == {"suami": 3, "saudari_kandung": 4}
        assert w["total_siham"] == 7
        assert w["balanced"] is True


class TestRadd:
    def test_base_contracts_to_the_returned_total(self):
        """Mother 1/6 + daughter 1/2 with no asabah: radd rescales to base 4 (1 + 3)."""
        w = working_for({"mother": True, "daughters": 1}, ruleset="syafii")
        assert w["radd_applied"] is True
        assert siham(w) == {"ibu": 1, "anak_perempuan": 3}
        assert w["base"] == 4
        assert w["balanced"] is True


class TestPerHead:
    def test_reports_a_non_integral_per_head_rather_than_rounding_it(self):
        """7 siham between 2 sons is 7/2 each — the case tashih would resolve.

        The engine does not perform tashih and neither does this table, so the exact
        fraction is reported. Silently rounding to 3 or 4 would be a number the reader
        could not trace.
        """
        w = working_for({"wives": 1, "sons": 2})
        sons = next(r for r in w["rows"] if r["label_id"] == "anak_laki")
        assert sons["siham"] == 7
        assert sons["per_head_siham"]["numerator"] == 7
        assert sons["per_head_siham"]["denominator"] == 2
        assert sons["per_head_siham"]["text"] == "7/2"


class TestExclusions:
    def test_harta_bersama_is_not_a_row(self):
        """It is a pre-faraid separation, so it holds no siham and must not sum into the base."""
        payload = {
            "heirs": {"husband": True, "sons": 1},
            "ruleset": "khi",
            "apply_harta_bersama": True,
            "estate": {"gross_value": "1000000", "joint_assets": "400000"},
        }
        result = calculate_payload(payload)
        assert any(s["category"] == "harta_bersama" for s in result["shares"])
        labels = [r["category"] for r in result["working"]["rows"]]
        assert "harta_bersama" not in labels
        assert result["working"]["balanced"] is True

    def test_localizes_row_labels(self):
        w = working_for({"wives": 1, "sons": 2}, lang="en")
        assert {r["label"] for r in w["rows"]} == {"Wife", "Son"}


class TestWithheldRatherThanRounded:
    def test_returns_none_when_a_share_is_not_whole_over_the_base(self):
        """The guard that keeps a wrong integer off the screen.

        Constructed directly rather than via the engine, because the engine cannot
        currently produce this — which is the point: if it ever does, the table
        disappears instead of rendering 0 or a rounded part.
        """
        result = CalculationResult(ruleset=Ruleset.KHI, mode=Mode.PERSONAL, pokok_masalah=4)
        result.shares = [
            HeirShare(
                relation=Relation.SON,
                count=1,
                share=Fraction(1, 3),  # not a whole number of quarters
                per_head=Fraction(1, 3),
                category=ShareCategory.ASABAH,
                rule_applied="test",
                reason="test",
                source_id="quran-nisa-11",
                asabah_type=AsabahType.BINAFSIHI,
            )
        ]
        assert working_table(result) is None

    def test_returns_none_when_there_is_nothing_awarded(self):
        result = CalculationResult(ruleset=Ruleset.KHI, mode=Mode.PERSONAL, pokok_masalah=6)
        assert working_table(result) is None


@pytest.mark.parametrize(
    "heirs,ruleset",
    [
        ({"wives": 1, "sons": 2, "daughters": 1}, "khi"),
        ({"husband": True, "mother": True, "father": True}, "khi"),
        ({"husband": True, "full_sisters": 2}, "syafii"),
        ({"wives": 1, "daughters": 2, "father": True, "mother": True}, "khi"),
        ({"mother": True, "daughters": 1}, "syafii"),
        ({"daughters": 1, "full_sisters": 1}, "syafii"),
    ],
)
def test_siham_reconstruct_the_shares(heirs, ruleset):
    """The table must be a faithful re-expression, not a parallel calculation.

    For every row, siham / base has to equal the share the engine awarded. This is the
    property that makes the column safe to put in front of someone verifying by hand.
    """
    payload = {"heirs": heirs, "ruleset": ruleset}
    result = calculate_payload(payload)
    working = result["working"]
    assert working is not None

    shares = {s["label_id"]: s["share"] for s in result["shares"] if s["category"] != "harta_bersama"}
    for row in working["rows"]:
        share = shares[row["label_id"]]
        assert Fraction(row["siham"], working["base"]) == Fraction(
            share["numerator"], share["denominator"]
        )
