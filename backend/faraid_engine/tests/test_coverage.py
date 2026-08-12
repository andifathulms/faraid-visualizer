"""The known-gaps registry must describe the engine, not the engine of six months ago.

A list of limitations shown to users is a claim, and an out-of-date claim here is worse
than none: it would tell someone a doctrine is missing after it shipped, or — far worse —
keep silent about one that never did. So every RAISES entry is exercised against a real
configuration and asserted to actually raise, and the SILENT entry is asserted to produce
a clean result (which is precisely why it needs disclosing).
"""

from __future__ import annotations

import pytest

from faraid_engine import (
    CalculationInput,
    Heirs,
    Representative,
    Ruleset,
    UnsupportedConfiguration,
    calculate,
)
from faraid_engine.coverage import KNOWN_GAPS, GapKind, gaps_for
from faraid_engine.heirs import Relation
from faraid_engine.rulesets import get_config
from faraid_engine.sources import get_source

ALL_RULESETS = tuple(Ruleset)


class TestRegistryIntegrity:
    def test_every_gap_cites_a_registered_source(self):
        """Same bar as a rule: an uncited gap does not ship (PRD §5.3)."""
        for gap in KNOWN_GAPS:
            assert get_source(gap.source_id).reference

    def test_keys_are_unique(self):
        keys = [g.key for g in KNOWN_GAPS]
        assert len(keys) == len(set(keys))

    def test_every_rule_set_resolves_a_gap_list(self):
        for rs in ALL_RULESETS:
            gaps_for(get_config(rs))  # must not raise

    def test_khi_209_is_registered_but_never_fired_by_a_rule(self):
        """It cites a doctrine the engine declines to implement, not one it applies.

        If a rule ever starts citing it, wasiat wajibah has shipped and its registry entry
        must move out of the gap list — this test is the tripwire for that.
        """
        for rs in ALL_RULESETS:
            assert "khi-209" not in get_config(rs).sources.values()


class TestRaisingGapsActuallyRaise:
    """Each RAISES entry, exercised. If one of these stops raising, the doctrine has been
    implemented and its registry entry is now a lie."""

    def test_jadd_muadda_grandfather_with_both_sibling_classes(self):
        """Full SISTERS with paternal brothers — a full brother would block the paternal
        class outright by hajb, so both classes only reach muqasama together this way."""
        with pytest.raises(UnsupportedConfiguration):
            calculate(CalculationInput(
                heirs=Heirs(paternal_grandfather=True, full_sisters=1, paternal_brothers=1),
                ruleset=Ruleset.SYAFII,
            ))

    def test_jadd_akdariyya_grandfather_with_sisters_and_a_spouse(self):
        with pytest.raises(UnsupportedConfiguration):
            calculate(CalculationInput(
                heirs=Heirs(husband=True, paternal_grandfather=True, full_sisters=1),
                ruleset=Ruleset.SYAFII,
            ))

    def test_jadd_with_descendant(self):
        """A daughter, not a son: a son blocks the siblings entirely, which routes away
        from al-jadd wa al-ikhwah before the guard is reached."""
        with pytest.raises(UnsupportedConfiguration):
            calculate(CalculationInput(
                heirs=Heirs(paternal_grandfather=True, full_brothers=1, daughters=1),
                ruleset=Ruleset.SYAFII,
            ))

    def test_representation_beyond_a_predeceased_child(self):
        with pytest.raises(UnsupportedConfiguration):
            calculate(CalculationInput(
                heirs=Heirs(
                    sons=1,
                    representatives=(Representative(Relation.FULL_BROTHER, sons=1, daughters=0),),
                ),
                ruleset=Ruleset.KHI,
            ))


class TestUncapturableGap:
    def test_no_dzawil_arham_relation_exists_in_the_input_model(self):
        """The gap is the capture, not the routing.

        Every Relation the model accepts is an ashabul furud or asabah slot, so a case
        whose only heirs are distant kindred cannot be entered at all — the user finds no
        field for a maternal grandfather or a daughter's children and gets no error,
        because nothing was submitted. Naming that in the registry is the only way it
        reaches them.
        """
        slots = {r.value for r in Relation}
        assert not (slots & {
            "maternal_grandfather",
            "daughters_children",
            "sisters_children",
            "maternal_uncle",
            "maternal_aunt",
        })

    def test_it_is_registered_as_uncapturable(self):
        gap = next(g for g in KNOWN_GAPS if g.key == "dzawil_arham_capture")
        assert gap.kind is GapKind.UNCAPTURABLE


class TestSilentGapIsGenuinelySilent:
    def test_a_case_needing_wasiat_wajibah_returns_a_clean_result(self):
        """The reason this gap must be disclosed rather than left to raise.

        The engine has no way to know an adopted child exists — the heir model does not
        capture one — so it produces a complete, fully cited answer that simply omits KHI
        Pasal 209. Nothing is malformed, so nothing raises, so nothing warns.
        """
        result = calculate(CalculationInput(heirs=Heirs(wives=1, sons=1), ruleset=Ruleset.KHI))
        assert result.shares
        assert not any("209" in n for n in result.notes)

    def test_it_is_registered_as_silent(self):
        gap = next(g for g in KNOWN_GAPS if g.key == "wasiat_wajibah")
        assert gap.kind is GapKind.SILENT


class TestApplicability:
    def test_muqasama_gaps_only_apply_where_a_grandfather_competes(self):
        """KHI and Hanafi have the grandfather block siblings outright, so al-jadd wa
        al-ikhwah is unreachable there and listing its gaps would be noise."""
        for rs in (Ruleset.KHI, Ruleset.HANAFI):
            keys = {g.key for g in gaps_for(get_config(rs))}
            assert "jadd_muadda" not in keys
        for rs in (Ruleset.SYAFII, Ruleset.MALIKI, Ruleset.HANBALI):
            keys = {g.key for g in gaps_for(get_config(rs))}
            assert "jadd_muadda" in keys

    def test_khi_only_gaps_are_khi_only(self):
        khi = {g.key for g in gaps_for(get_config(Ruleset.KHI))}
        syafii = {g.key for g in gaps_for(get_config(Ruleset.SYAFII))}
        assert {"wasiat_wajibah", "representation_scope"} <= khi
        assert not ({"wasiat_wajibah", "representation_scope"} & syafii)

    def test_dzawil_arham_capture_applies_everywhere(self):
        for rs in ALL_RULESETS:
            assert "dzawil_arham_capture" in {g.key for g in gaps_for(get_config(rs))}
