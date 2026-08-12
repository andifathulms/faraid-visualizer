"""The worked example on the landing page must be what the engine actually computes.

The example is hardcoded in the frontend on purpose — it has to render before Pyodide has
finished downloading, which is the whole window in which a first-time visitor decides
whether to wait. Hardcoded means it can drift, and an example that teaches figures the app
does not produce is worse than no example: it is the app contradicting itself at the exact
moment it is asking to be trusted.

So the figures are pinned here. If a rule change moves them, this fails and the copy in
components/WorkedExample.tsx has to be updated with it.
"""

from __future__ import annotations

from decimal import Decimal

from faraid_web.service import calculate_payload

# Must match EXAMPLE_CASE in frontend/components/WorkedExample.tsx and the seed in
# frontend/app/page.tsx.
EXAMPLE = {
    "heirs": {"husband": True, "sons": 2, "daughters": 1},
    "ruleset": "khi",
    "estate": {"gross_value": "120000000", "debts": "20000000"},
    "lang": "id",
}


def result() -> dict:
    return calculate_payload(EXAMPLE)


def by_label(r: dict) -> dict[str, dict]:
    return {s["label_id"]: s for s in r["shares"]}


class TestTheFiguresInTheCopy:
    def test_the_divisible_estate_is_100_million(self):
        """Stage 1: 120,000,000 − 20,000,000 debt."""
        assert Decimal(result()["estate"]["net_divisible"]) == Decimal("100000000.00")

    def test_husband_takes_one_quarter_and_25_million(self):
        """Stage 3, and the first line of the result box."""
        h = by_label(result())["suami"]
        assert h["share"]["text"] == "1/4"
        assert Decimal(h["amount"]) == Decimal("25000000.00")

    def test_sons_take_three_fifths_sixty_million_thirty_each(self):
        """Stage 4, and the second line of the result box."""
        s = by_label(result())["anak_laki"]
        assert s["share"]["text"] == "3/5"
        assert Decimal(s["amount"]) == Decimal("60000000.00")
        assert Decimal(s["per_head_amount"]) == Decimal("30000000.00")

    def test_daughter_takes_three_twentieths_and_15_million(self):
        d = by_label(result())["anak_perempuan"]
        assert d["share"]["text"] == "3/20"
        assert Decimal(d["amount"]) == Decimal("15000000.00")

    def test_the_amounts_sum_to_the_divisible_estate(self):
        """The example shows three round numbers adding up. They must actually add up —
        this case is deliberately chosen to have no rounding remainder to explain."""
        r = result()
        total = sum(Decimal(s["amount"]) for s in r["shares"])
        assert total == Decimal(r["estate"]["net_divisible"])


class TestTheClaimsInTheCopy:
    def test_nobody_is_blocked_in_this_case(self):
        """Stage 2 says so."""
        assert result()["blocked"] == []

    def test_a_son_really_would_block_a_sibling(self):
        """Stage 2's counterfactual — "had there been siblings, a son would block them".
        Asserted rather than asserted-by-the-copywriter."""
        r = calculate_payload({**EXAMPLE, "heirs": {**EXAMPLE["heirs"], "full_brothers": 2}})
        blocked = {b["label_id"]: b for b in r["blocked"]}
        assert "saudara_laki_kandung" in blocked
        assert blocked["saudara_laki_kandung"]["blocked_by"] == "son"

    def test_a_husband_without_children_would_take_one_half(self):
        """Stage 3's parenthetical — "without children it would be 1/2"."""
        r = calculate_payload({**EXAMPLE, "heirs": {"husband": True, "father": True}})
        assert by_label(r)["suami"]["share"]["text"] == "1/2"

    def test_the_head_count_in_stage_four_is_the_engine_s_own(self):
        """2×2 + 1×1 = 5 parts, sons taking 4 of them."""
        asabah = next(s for s in result()["steps"] if s["step"] == "asabah")
        assert asabah["data"]["units"] == 5
        assert asabah["data"]["males"] == 2
        assert asabah["data"]["females"] == 1
