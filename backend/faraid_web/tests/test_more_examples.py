"""The additional worked examples on the landing page must be what the engine computes.

Same contract as test_worked_example.py: the copy is hardcoded in the frontend so it
renders before Pyodide has downloaded, which means it can drift. Every figure and every
claim these examples make is pinned here, so a rule change that moves them turns the suite
red instead of leaving the landing page teaching arithmetic the app does not produce.
"""

from __future__ import annotations

from decimal import Decimal

from faraid_web.service import calculate_payload

# Must match EXTRA_EXAMPLES in frontend/components/MoreExamples.tsx.
CASE_B = {
    "heirs": {"wives": 1, "sons": 1, "daughters": 2},
    "ruleset": "khi",
    "estate": {"gross_value": "200000000"},
    "lang": "id",
}
CASE_C = {
    "heirs": {"father": True, "mother": True, "daughters": 1},
    "ruleset": "khi",
    "estate": {"gross_value": "120000000"},
    "lang": "id",
}


def shares(payload: dict) -> dict[str, dict]:
    return {s["label_id"]: s for s in calculate_payload(payload)["shares"]}


class TestCaseB:
    """Wife, one son, two daughters — the commonest shape of a real Indonesian estate."""

    def test_wife_takes_one_eighth(self):
        w = shares(CASE_B)["istri"]
        assert w["share"]["text"] == "1/8"
        assert Decimal(w["amount"]) == Decimal("25000000.00")

    def test_son_and_daughters_split_the_residue_two_to_one(self):
        s = shares(CASE_B)
        assert s["anak_laki"]["share"]["text"] == "7/16"
        assert Decimal(s["anak_laki"]["amount"]) == Decimal("87500000.00")
        # Two daughters share the same total, so each gets half of it.
        assert s["anak_perempuan"]["share"]["text"] == "7/16"
        assert Decimal(s["anak_perempuan"]["amount"]) == Decimal("87500000.00")
        assert Decimal(s["anak_perempuan"]["per_head_amount"]) == Decimal("43750000.00")

    def test_the_head_count_quoted_in_the_copy(self):
        """"Sisa 7/8 dibagi 4 bagian (1×2 + 2×1)" — the engine's own figures."""
        step = next(s for s in calculate_payload(CASE_B)["steps"] if s["step"] == "asabah")
        assert step["data"] == {"residue": "7/8", "units": 4, "males": 1, "females": 2}

    def test_it_all_adds_up(self):
        r = calculate_payload(CASE_B)
        assert sum(Decimal(s["amount"]) for s in r["shares"]) == Decimal(
            r["estate"]["net_divisible"]
        )


class TestCaseC:
    """Father, mother, one daughter — and the reason this case is worth showing: the
    father takes a fixed share AND the leftover, which no other example demonstrates."""

    def test_daughter_takes_one_half(self):
        d = shares(CASE_C)["anak_perempuan"]
        assert d["share"]["text"] == "1/2"
        assert Decimal(d["amount"]) == Decimal("60000000.00")

    def test_mother_takes_one_sixth(self):
        m = shares(CASE_C)["ibu"]
        assert m["share"]["text"] == "1/6"
        assert Decimal(m["amount"]) == Decimal("20000000.00")

    def test_father_takes_one_sixth_plus_the_residue(self):
        f = shares(CASE_C)["ayah"]
        assert f["share"]["text"] == "1/3"
        assert Decimal(f["amount"]) == Decimal("40000000.00")
        # The claim the copy makes: this is 1/6 fixed + 1/6 left over, not a plain 1/3.
        assert f["rule_applied"].startswith("furud+asabah")

    def test_nobody_is_blocked(self):
        assert calculate_payload(CASE_C)["blocked"] == []

    def test_it_all_adds_up(self):
        r = calculate_payload(CASE_C)
        assert sum(Decimal(s["amount"]) for s in r["shares"]) == Decimal(
            r["estate"]["net_divisible"]
        )


def test_both_cases_cite_only_registered_sources():
    """Every citation the copy prints has to resolve, like any other rule in the app."""
    for payload in (CASE_B, CASE_C):
        srcs = calculate_payload(payload)["sources"]
        assert srcs
        for sid, src in srcs.items():
            assert src["reference"], sid
