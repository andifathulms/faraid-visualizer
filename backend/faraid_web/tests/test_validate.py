"""Tests for the pure input validator.

These run with no Django settings — that is the point of :mod:`faraid_web`. The same
validation runs server-side in DRF and client-side under Pyodide, so a gap here is a gap
in both deployments at once.

The critical property under test is the 400/422 split: a malformed *payload* must never
be confused with an impossible *fiqh configuration*. Collapsing the two would let a
client bug surface to the user as "this inheritance case is unsupported", which is a lie.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from faraid_engine import InvalidHeirInput, Mode, Relation, Ruleset, calculate
from faraid_web import InvalidInput, build_input, calculate_payload, validate_payload


class TestShapeValidation:
    def test_defaults_are_applied(self):
        data = validate_payload({"heirs": {"sons": 1}})
        assert data["ruleset"] == Ruleset.KHI.value
        assert data["mode"] == Mode.PERSONAL.value
        assert data["lang"] == "id"
        assert data["apply_harta_bersama"] is False
        assert data["heirs"]["daughters"] == 0
        assert data["estate"]["gross_value"] == Decimal("0")

    def test_unknown_keys_are_ignored(self):
        # DRF's historical behaviour, preserved so older clients keep working.
        data = validate_payload({"heirs": {"sons": 1, "cousins": 3}, "nonsense": True})
        assert "cousins" not in data["heirs"]

    @pytest.mark.parametrize(
        "payload",
        [
            {"heirs": {"wives": 9}},  # above the 4-wife cap
            {"heirs": {"sons": -1}},
            {"heirs": {"sons": "abc"}},
            {"heirs": {"sons": 999}},  # above MAX_COUNT
            {"heirs": "not-an-object"},
            {"heirs": {"sons": 1}, "ruleset": "jafari"},
            {"heirs": {"sons": 1}, "mode": "expert"},
            {"heirs": {"sons": 1}, "lang": "fr"},
            {"heirs": {"sons": 1}, "estate": {"debts": -5}},
            {"heirs": {"sons": 1}, "estate": {"gross_value": "not-money"}},
            {"heirs": {"representatives": [{"replacing": "uncle"}]}},
            {"heirs": {"representatives": "nope"}},
            "not-an-object",
        ],
    )
    def test_malformed_payloads_raise_invalid_input(self, payload):
        with pytest.raises(InvalidInput):
            validate_payload(payload)

    def test_invalid_input_carries_field_errors(self):
        with pytest.raises(InvalidInput) as exc:
            validate_payload({"heirs": {"wives": 9}})
        assert "wives" in exc.value.errors

    def test_string_numerals_and_booleans_are_coerced(self):
        data = validate_payload({"heirs": {"sons": "2", "father": "true"}})
        assert data["heirs"]["sons"] == 2
        assert data["heirs"]["father"] is True

    def test_money_is_quantized_to_two_places(self):
        data = validate_payload({"heirs": {"sons": 1}, "estate": {"gross_value": "100.005"}})
        assert data["estate"]["gross_value"] == Decimal("100.00")


class TestFiqhErrorsStayDistinct:
    """Shape-valid but impossible configurations must reach the engine, not the validator."""

    def test_husband_and_wives_is_an_engine_error_not_a_shape_error(self):
        payload = {"heirs": {"husband": True, "wives": 1}}
        validate_payload(payload)  # shape is fine — must not raise here
        with pytest.raises(InvalidHeirInput):
            calculate_payload(payload)

    def test_no_heirs_is_an_engine_error(self):
        with pytest.raises(InvalidHeirInput):
            calculate_payload({"heirs": {}})


class TestKhiOnlyOptionsAreDropped:
    """Harta bersama and ahli waris pengganti are KHI-only constructs (PRD §4.1)."""

    def test_representatives_dropped_for_classical_rulesets(self):
        data = validate_payload(
            {"heirs": {"sons": 2, "representatives": [{"replacing": "son", "sons": 1}]}}
        )
        khi = build_input(data, ruleset_override="khi")
        syafii = build_input(data, ruleset_override="syafii")
        assert khi.heirs.representatives
        assert syafii.heirs.representatives == ()

    def test_harta_bersama_only_applies_under_khi(self):
        data = validate_payload({"heirs": {"husband": True}, "apply_harta_bersama": True})
        assert build_input(data, ruleset_override="khi").apply_harta_bersama is True
        assert build_input(data, ruleset_override="syafii").apply_harta_bersama is False

    def test_representative_relation_is_typed(self):
        data = validate_payload(
            {"heirs": {"sons": 1, "representatives": [{"replacing": "daughter", "daughters": 2}]}}
        )
        rep = build_input(data).heirs.representatives[0]
        assert rep.replacing is Relation.DAUGHTER
        assert rep.daughters == 2


class TestServiceLayer:
    def test_mode_override_wins_over_payload(self):
        payload = {"heirs": {"sons": 1}, "mode": "personal"}
        assert calculate_payload(payload, mode_override="professional")["mode"] == "professional"

    def test_serialized_result_bundles_every_cited_source(self):
        body = calculate_payload({"heirs": {"husband": True, "daughters": 3, "father": True, "mother": True}})
        cited = {s["source_id"] for s in body["shares"]}
        assert cited <= set(body["sources"])
        assert body["disclaimer"]

    def test_matches_direct_engine_call(self):
        """The payload path must not diverge from calling the engine directly."""
        payload = {"heirs": {"wives": 1, "sons": 1, "daughters": 1}, "ruleset": "khi"}
        via_payload = calculate_payload(payload)
        direct = calculate(build_input(validate_payload(payload)))
        assert via_payload["pokok_masalah"] == direct.pokok_masalah
        assert [s["share"]["text"] for s in via_payload["shares"]] == [
            f"{s.share.numerator}/{s.share.denominator}" if s.share.denominator != 1
            else str(s.share.numerator)
            for s in direct.shares
        ]
