"""The prose must describe the case that actually happened.

The validation bank pins fractions, which is what protects the arithmetic. Nothing pinned
the sentences — so a share could be correct while the sentence explaining it described a
rule that never fired, and the suite stayed green. For a tool whose stated purpose is that
the reasoning can be followed (PRD §1), a false explanation attached to a right number is
the worse failure of the two, so the sentences get assertions too.
"""

from __future__ import annotations

import pytest

from faraid_engine import CalculationInput, Heirs, Ruleset, calculate
from faraid_engine.heirs import Relation


def reasons(heirs: Heirs, ruleset: Ruleset = Ruleset.KHI) -> dict[str, str]:
    result = calculate(CalculationInput(heirs=heirs, ruleset=ruleset))
    return {s.relation.label_id: s.reason for s in result.shares}


def steps_detail(heirs: Heirs, step: str, ruleset: Ruleset = Ruleset.KHI) -> str:
    result = calculate(CalculationInput(heirs=heirs, ruleset=ruleset))
    return " ".join(s.detail for s in result.steps if s.step == step)


class TestNoAbsentHeirIsDescribed:
    """The regression that motivated this file."""

    def test_a_sole_son_is_not_told_he_splits_with_daughters(self):
        r = reasons(Heirs(sons=1, father=True))
        assert "anak perempuan" not in r["anak_laki"].lower()
        assert "2:1" not in r["anak_laki"]
        assert "SELURUH sisa" in r["anak_laki"]

    @pytest.mark.parametrize(
        "heirs,male,absent_female",
        [
            (Heirs(sons=2), "anak_laki", "anak perempuan"),
            (Heirs(grandsons_via_son=1), "cucu_laki", "cucu perempuan"),
            (Heirs(full_brothers=2), "saudara_laki_kandung", "saudari kandung"),
            (Heirs(paternal_brothers=1), "saudara_laki_seayah", "saudari seayah"),
        ],
    )
    def test_no_class_mentions_a_female_co_heir_who_is_absent(self, heirs, male, absent_female):
        assert absent_female not in reasons(heirs)[male].lower()

    def test_the_split_IS_described_when_the_co_heir_is_present(self):
        r = reasons(Heirs(husband=True, sons=2, daughters=1))
        assert "Anak perempuan" in r["anak_laki"]
        assert "2:1" in r["anak_laki"]


class TestNoMachineIdentifiersInProse:
    """Relation keys are snake_case; they must never reach a sentence a user reads."""

    # Only keys containing an underscore. Single-word keys like "ayah" and "ibu" are
    # ordinary Indonesian words that legitimately appear in prose, so matching on them
    # produces false positives rather than findings.
    KEYS = [r.label_id for r in Relation if "_" in r.label_id]

    @pytest.mark.parametrize(
        "heirs",
        [
            Heirs(husband=True, sons=2, daughters=1),
            Heirs(sons=1, full_brothers=2, father=True),
            Heirs(wives=1, daughters=2, father=True, mother=True),
            Heirs(mother=True, daughters=1),
            Heirs(husband=True, full_sisters=2),
            Heirs(daughters=1, full_sisters=1),
        ],
    )
    def test_shares_blocked_and_steps_are_free_of_relation_keys(self, heirs):
        for ruleset in (Ruleset.KHI, Ruleset.SYAFII):
            result = calculate(CalculationInput(heirs=heirs, ruleset=ruleset))
            prose = (
                [s.reason for s in result.shares]
                + [b.reason for b in result.blocked]
                + [s.detail for s in result.steps]
                + [s.title for s in result.steps]
                + list(result.notes)
            )
            for text in prose:
                for key in self.KEYS:
                    # "saudara_seibu" etc. — an underscore is the giveaway; no display
                    # name contains one.
                    assert key not in text, f"machine key {key!r} leaked into: {text!r}"


class TestArithmeticIsShown:
    """A ratio is not a derivation. The reader needs the head count that turns 2:1 into
    an actual fraction."""

    def test_the_asabah_head_count_is_spelled_out(self):
        r = reasons(Heirs(husband=True, sons=2, daughters=1))["anak_laki"]
        # residue 3/4 over 2*2+1 = 5 parts; sons take 4.
        assert "3/4" in r
        assert "5 bagian" in r
        assert "2×2 + 1×1" in r
        assert "4 bagian" in r


class TestDisplayNamesStayInSyncWithTheUI:
    def test_engine_display_matches_the_web_layer_labels(self):
        """The engine names relations in its own prose; faraid_web names them in the UI.
        Two spellings of the same heir on one screen would be its own comprehension bug."""
        from faraid_web.labels import RELATION_LABELS

        for relation in Relation:
            assert relation.display == RELATION_LABELS["id"][relation.label_id]
