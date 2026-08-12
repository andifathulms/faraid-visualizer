"""Tests for the counterfactual sensitivity analysis.

Every cell is a real derivation, so the risk is not arithmetic — it is the classification.
Telling someone an heir changes nothing when they do is the failure that matters: it would
send a family into a meeting having ruled out the very person the argument is about. So
both classifications are pinned on cases with a known hajb structure.
"""

from __future__ import annotations

from faraid_web.service import sensitivity_payload


def analyze(heirs: dict, ruleset: str = "khi", lang: str = "id") -> dict:
    return sensitivity_payload({"heirs": heirs, "ruleset": ruleset, "lang": lang})


def rows(result: dict, bucket: str) -> dict[str, dict]:
    return {f"{r['direction']}:{r['slot']}": r for r in result[bucket]}


class TestInertHeirsAreNamedWithTheirBlocker:
    def test_a_son_makes_the_whole_collateral_line_inert(self):
        """The insight a single result cannot give.

        With a son present, adding a brother, a sister or a grandchild changes nothing —
        they are blocked. The result view shows who *was* blocked in the case as entered;
        it never shows that these slots are inert, which is what someone actually needs
        before "but what about so-and-so?" comes up.
        """
        r = analyze({"husband": True, "sons": 2, "daughters": 1})
        inert = rows(r, "inert")
        for slot in (
            "full_brothers", "full_sisters", "paternal_brothers", "paternal_sisters",
            "grandsons_via_son", "granddaughters_via_son",
        ):
            entry = inert[f"add:{slot}"]
            assert entry["status"] == "no_change"
            assert entry["changed"] == []
            # Named, not left to be inferred — this is the hajb structure made visible.
            assert entry["blocked_by"] == "Anak laki-laki"
            assert entry["blocked_reason_source"]

    def test_maternal_siblings_are_blocked_by_a_descendant_too(self):
        r = analyze({"daughters": 1, "mother": True})
        assert rows(r, "inert")["add:maternal_siblings"]["blocked_by"] is not None


class TestLoadBearingHeirs:
    def test_adding_a_father_redistributes(self):
        r = analyze({"husband": True, "sons": 2, "daughters": 1})
        entry = rows(r, "changing")["add:father"]
        assert entry["status"] == "changes"
        moved = {c["relation"] for c in entry["changed"]}
        assert "father" in moved and "son" in moved

    def test_removing_an_heir_who_is_present_changes_the_division(self):
        r = analyze({"husband": True, "sons": 2, "daughters": 1})
        entry = rows(r, "changing")["remove:husband"]
        husband = next(c for c in entry["changed"] if c["relation"] == "husband")
        assert husband["from"]["text"] == "1/4"
        assert husband["to"] is None  # no longer an heir at all

    def test_a_new_heir_appears_with_no_prior_share(self):
        r = analyze({"daughters": 1})
        entry = rows(r, "changing")["add:sons"]
        son = next(c for c in entry["changed"] if c["relation"] == "son")
        assert son["from"] is None and son["to"] is not None


class TestContradictoryPerturbationsAreSkipped:
    def test_does_not_offer_a_husband_alongside_wives(self):
        """Swapping a husband for a wife is a different family, not a perturbation of
        this one — and the engine would reject it as contradictory input."""
        r = analyze({"wives": 1, "sons": 1})
        assert "add:husband" not in rows(r, "changing")
        assert "add:husband" not in rows(r, "inert")
        assert "add:husband" not in rows(r, "refused")

    def test_does_not_offer_wives_alongside_a_husband(self):
        r = analyze({"husband": True, "sons": 1})
        for bucket in ("changing", "inert", "refused"):
            assert "add:wives" not in rows(r, bucket)


class TestRefusals:
    def test_a_hypothetical_the_engine_declines_is_reported_not_hidden(self):
        """Under classical Syafi'i, adding a grandfather to a case with siblings and a
        descendant trips a documented guard. The same refusal the product makes
        everywhere else, surfaced here rather than silently dropped."""
        r = analyze({"paternal_grandfather": True, "full_brothers": 1}, ruleset="syafii")
        refused = rows(r, "refused")
        assert refused, "expected at least one declined hypothetical"
        assert all(x["detail"] for x in refused.values())
        assert all(x["status"] in {"unsupported", "engine_error"} for x in refused.values())

    def test_every_perturbation_lands_in_exactly_one_bucket(self):
        r = analyze({"husband": True, "sons": 2, "daughters": 1})
        keys = [
            f"{x['direction']}:{x['slot']}"
            for bucket in ("changing", "inert", "refused")
            for x in r[bucket]
        ]
        assert len(keys) == len(set(keys))
        assert r["counts"] == {b: len(r[b]) for b in ("changing", "inert", "refused")}


class TestGeneralShape:
    def test_harta_bersama_is_not_treated_as_a_moving_share(self):
        """It is a pre-faraid separation, so it must not make every perturbation look
        like it changed the division."""
        out = sensitivity_payload({
            "heirs": {"wives": 1, "sons": 1},
            "ruleset": "khi",
            "apply_harta_bersama": True,
            "estate": {"gross_value": "1000", "joint_assets": "1000"},
        })
        assert out["inert"], "expected some slots to remain inert"

    def test_labels_are_localized(self):
        r = analyze({"husband": True, "sons": 1}, lang="en")
        assert rows(r, "changing")["remove:husband"]["label"] == "Husband"
