"""Tests for unprompted KHI-vs-Syafi'i divergence detection.

The detector makes a claim to the user about two bodies of law — "these agree" or "these
differ" — so both directions are pinned, on cases the engine suite already establishes as
genuine divergences (faraid_engine/tests/test_divergence.py). A false "they agree" is the
serious failure: it would restate PRD §4.1's forbidden conflation as a reassurance.
"""

from __future__ import annotations

from faraid_web.service import calculate_payload


def divergence(heirs: dict, ruleset: str = "khi", **payload) -> dict:
    out = calculate_payload({"heirs": heirs, "ruleset": ruleset, **payload})
    return out["divergence"]


class TestAgreement:
    def test_reports_same_when_both_rule_sets_divide_identically(self):
        """Wife + two sons has no KHI-specific construct in play, so the two must agree."""
        d = divergence({"wives": 1, "sons": 2})
        assert d["status"] == "same"
        assert d["rows"] == []
        assert d["harta_bersama_only"] is False

    def test_counterpart_is_the_other_tier_one_rule_set(self):
        assert divergence({"sons": 1}, "khi")["counterpart"] == "syafii"
        assert divergence({"sons": 1}, "syafii")["counterpart"] == "khi"

    def test_is_symmetric(self):
        """Whichever side the user is standing on, the same cases must be flagged."""
        for heirs in ({"wives": 1, "sons": 2}, {"husband": True}, {"mother": True, "daughters": 1}):
            assert divergence(heirs, "khi")["status"] == divergence(heirs, "syafii")["status"]


class TestDivergence:
    def test_flags_the_sole_spouse_radd_vs_baitul_mal_case(self):
        """Husband alone: KHI gives him everything by radd, classical stops at 1/2."""
        d = divergence({"husband": True}, "khi")
        assert d["status"] == "differs"
        row = next(r for r in d["rows"] if r["relation"] == "husband")
        assert row["this"]["text"] == "1"
        assert row["other"]["text"] == "1/2"

    def test_flags_ahli_waris_pengganti(self):
        """The headline PRD §4.1 case: KHI substitutes, classical Syafi'i has no such rule.

        build_input drops representatives for a classical rule set, so the counterpart run
        divides between the surviving sons alone — which is exactly the divergence, not an
        artifact of the comparison.
        """
        d = divergence(
            {"sons": 2, "representatives": [{"replacing": "son", "sons": 1, "daughters": 1}]},
            "khi",
        )
        assert d["status"] == "differs"
        moved = {r["relation"] for r in d["rows"]}
        assert "grandson_via_son" in moved or "granddaughter_via_son" in moved

    def test_reports_a_row_when_an_heir_inherits_under_only_one_rule_set(self):
        """An heir absent from one side must still appear, with a null on that side."""
        d = divergence(
            {"sons": 1, "representatives": [{"replacing": "son", "sons": 1, "daughters": 0}]},
            "khi",
        )
        assert d["status"] == "differs"
        assert any(r["this"] is None or r["other"] is None for r in d["rows"])

    def test_rows_carry_localized_labels(self):
        d = calculate_payload(
            {"heirs": {"husband": True}, "ruleset": "khi", "lang": "en"}
        )["divergence"]
        assert d["rows"][0]["label"] == "Husband"
        assert d["counterpart_label"] == "Syafi'i (classical)"


class TestHartaBersama:
    def test_same_fractions_but_flagged_because_joint_property_is_separated_first(self):
        """The fractions match; the amounts cannot, because half the joint property is
        taken out before faraid and classical fiqh has no such step (PRD §4.1).

        Reporting a bare "they agree" here would be false, so the fraction match is
        reported together with the reason the money still differs.
        """
        d = divergence(
            {"wives": 1, "sons": 1},
            "khi",
            apply_harta_bersama=True,
            estate={"gross_value": "1000", "joint_assets": "1000"},
        )
        assert d["status"] == "same"
        assert d["harta_bersama_only"] is True

    def test_not_flagged_when_harta_bersama_is_not_applied(self):
        d = divergence(
            {"wives": 1, "sons": 1}, "khi", estate={"gross_value": "1000", "joint_assets": "1000"}
        )
        assert d["harta_bersama_only"] is False


class TestUnsupportedCounterpart:
    def test_a_counterpart_that_refuses_is_itself_the_answer(self):
        """Grandfather + sisters + spouse trips the akdariyya guard under Syafi'i muqasama,
        while KHI blocks the siblings outright. "The other school cannot express this"
        is information about the two rule sets, not an error to swallow."""
        d = divergence({"husband": True, "paternal_grandfather": True, "full_sisters": 1}, "khi")
        assert d["status"] in {"differs", "unsupported"}
        if d["status"] == "unsupported":
            assert d["detail"]


class TestScope:
    def test_beta_rule_sets_have_no_counterpart(self):
        """Pairing a Beta rule set against a validated one would invite the user to read a
        Beta disagreement as evidence about KHI, so nothing is reported at all."""
        for ruleset in ("hanafi", "maliki", "hanbali"):
            assert divergence({"wives": 1, "sons": 2}, ruleset) is None

    def test_comparison_entries_do_not_carry_a_nested_divergence(self):
        """The side-by-side view IS the comparison; detecting divergence inside it would
        be recursive noise."""
        from faraid_web.service import compare_payload

        out = compare_payload({"heirs": {"husband": True}, "ruleset": "khi"}, ["khi", "syafii"])
        for entry in out["comparison"]:
            assert "divergence" not in entry.get("result", {})
