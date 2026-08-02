"""Tests for the wire format's derived money fields.

``per_head_amount`` exists so the UI never divides money itself. It is presentation-only
— it introduces no fiqh rule and changes no share — but it is money on a screen, so it
gets the same treatment as the rest of the ledger: exact Decimal arithmetic, and a test
that pins it to the group amount it must agree with.
"""

from __future__ import annotations

from decimal import Decimal

from faraid_web.service import calculate_payload

ESTATE = {"gross_value": "5000000000", "debts": "400000000"}


def shares_by_relation(payload: dict) -> dict:
    return {s["label_id"]: s for s in calculate_payload(payload)["shares"]}


class TestPerHeadAmount:
    def test_reconciles_with_the_group_amount(self):
        """per_head × count must agree with the group amount to within rounding.

        Both are quantized independently from the same exact rational, so they need not be
        equal: each is at most half a cent from its true value, bounding the disagreement
        at 0.005 × (count + 1). 2 daughters of a 16/27 group under 'aul is precisely such a
        case — 2725925925.925… rounds up while its half rounds down — so this pins the
        tolerance rather than pretending the figures always match exactly.
        """
        shares = shares_by_relation(
            {
                "heirs": {"wives": 1, "daughters": 2, "father": True, "mother": True},
                "ruleset": "khi",
                "estate": ESTATE,
            }
        )
        daughters = shares["anak_perempuan"]
        count = daughters["count"]
        assert count == 2
        drift = abs(Decimal(daughters["per_head_amount"]) * count - Decimal(daughters["amount"]))
        assert drift <= Decimal("0.005") * (count + 1)

    def test_is_exact_when_the_group_divides_evenly(self):
        shares = shares_by_relation(
            {"heirs": {"daughters": 2}, "ruleset": "khi", "estate": {"gross_value": "600"}}
        )
        daughters = shares["anak_perempuan"]
        assert Decimal(daughters["per_head_amount"]) * 2 == Decimal(daughters["amount"])

    def test_matches_the_per_head_fraction(self):
        """The money must be derived from the engine's own per_head fraction."""
        shares = shares_by_relation(
            {"heirs": {"sons": 3}, "ruleset": "khi", "estate": {"gross_value": "900"}}
        )
        sons = shares["anak_laki"]
        assert sons["per_head"]["numerator"] == 1
        assert sons["per_head"]["denominator"] == 3
        assert Decimal(sons["per_head_amount"]) == Decimal("300.00")

    def test_single_heir_per_head_equals_amount(self):
        shares = shares_by_relation(
            {"heirs": {"husband": True, "daughters": 1}, "ruleset": "khi", "estate": ESTATE}
        )
        husband = shares["suami"]
        assert husband["count"] == 1
        assert husband["per_head_amount"] == husband["amount"]

    def test_omitted_estate_serializes_as_zero_not_null(self):
        """Documents existing behaviour: an omitted estate becomes a zero estate.

        ``amount`` is therefore "0.00" and never None in practice, so a truthiness check on
        it does NOT mean "the user entered an estate". Presentation layers must decide that
        from ``net_divisible`` instead — the UI does exactly that, and this test exists so a
        future change here is a deliberate one.
        """
        result = calculate_payload({"heirs": {"sons": 2}, "ruleset": "khi"})
        assert result["estate"]["net_divisible"] == "0.00"
        son = {s["label_id"]: s for s in result["shares"]}["anak_laki"]
        assert son["amount"] == "0.00"
        assert son["per_head_amount"] == "0.00"

    def test_present_for_every_share(self):
        shares = calculate_payload(
            {
                "heirs": {"wives": 1, "daughters": 2, "father": True, "mother": True},
                "ruleset": "khi",
                "estate": ESTATE,
            }
        )["shares"]
        assert shares
        for s in shares:
            assert "per_head_amount" in s
