"""Tests for the browser bridge.

This is the entire API surface of the static deployment — if it is wrong, the deployed
calculator is wrong, and there is no server-side log to notice. The properties that
matter most are that errors never escape as exceptions (they would lose their type
crossing into JavaScript) and that the error *kinds* stay distinct, so an unsupported
fiqh configuration can never be rendered as a wrong number.
"""

from __future__ import annotations

import base64
import json

import pytest

from faraid_web.bridge import dispatch
from faraid_web.service import calculate_payload

HEIRS_AUL = {"husband": True, "daughters": 3, "father": True, "mother": True}


def call(action: str, **request) -> dict:
    return json.loads(dispatch(action, json.dumps(request)))


class TestCalculate:
    def test_returns_full_derivation(self):
        res = call("calculate", payload={"heirs": HEIRS_AUL, "ruleset": "khi"})
        assert res["ok"] is True
        body = res["data"]
        assert body["aul_base"] == 15
        assert body["shares"] and body["steps"] and body["disclaimer"]
        assert {s["source_id"] for s in body["shares"]} <= set(body["sources"])

    def test_mode_override_is_honoured(self):
        res = call("calculate", payload={"heirs": {"sons": 1}}, mode_override="professional")
        assert res["data"]["mode"] == "professional"

    def test_matches_the_non_bridge_path(self):
        """The bridge must be a pure transport wrapper, not a second code path."""
        payload = {"heirs": {"wives": 1, "sons": 1, "daughters": 1}, "ruleset": "khi", "lang": "en"}
        assert call("calculate", payload=payload)["data"] == calculate_payload(payload)


class TestErrorsAreReturnedNotRaised:
    @pytest.mark.parametrize(
        "payload,kind,error",
        [
            ({"heirs": {"wives": 9}}, "invalid_input", "InvalidInput"),
            ({"heirs": {"husband": True, "wives": 1}}, "unsupported", "InvalidHeirInput"),
            (
                {
                    "heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1},
                    "ruleset": "syafii",
                },
                "unsupported",
                "UnsupportedConfiguration",
            ),
            ({"heirs": {}}, "unsupported", "InvalidHeirInput"),
        ],
    )
    def test_error_kinds_stay_distinct(self, payload, kind, error):
        res = call("calculate", payload=payload)
        assert res["ok"] is False
        assert res["kind"] == kind
        assert res["error"] == error
        assert res["detail"]

    def test_unknown_action_is_rejected(self):
        res = call("teleport", payload={})
        assert res["ok"] is False and res["error"] == "UnknownAction"

    def test_malformed_json_is_rejected(self):
        res = json.loads(dispatch("calculate", "{not json"))
        assert res["ok"] is False and res["error"] == "MalformedJSON"

    def test_every_response_is_json_serializable(self):
        """Anything non-serializable here would surface in the browser as a crash."""
        for payload in ({"heirs": {"wives": 9}}, {"heirs": HEIRS_AUL}, {"heirs": {}}):
            json.loads(dispatch("calculate", json.dumps({"payload": payload})))


class TestCompare:
    def test_reports_divergence_and_per_ruleset_errors(self):
        res = call(
            "compare",
            payload={"heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1}},
            rulesets=["khi", "syafii"],
        )
        by = {c["ruleset"]: c for c in res["data"]["comparison"]}
        assert by["khi"]["ok"] is True
        assert by["syafii"]["ok"] is False
        assert by["syafii"]["error"] == "UnsupportedConfiguration"

    def test_defaults_to_khi_vs_syafii(self):
        res = call("compare", payload={"heirs": {"husband": True}})
        assert [c["ruleset"] for c in res["data"]["comparison"]] == ["khi", "syafii"]


class TestPdf:
    def test_returns_base64_pdf(self):
        res = call("pdf", payload={"heirs": HEIRS_AUL, "ruleset": "khi"})
        assert res["ok"] is True
        raw = base64.b64decode(res["data"]["pdf_base64"])
        assert raw.startswith(b"%PDF")
        assert len(raw) > 1500

    def test_rejects_unsupported_configuration(self):
        res = call(
            "pdf",
            payload={
                "heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1},
                "ruleset": "syafii",
            },
        )
        assert res["ok"] is False and res["kind"] == "unsupported"


class TestSources:
    def test_lists_the_citation_registry(self):
        res = call("sources")
        assert res["data"]["count"] == 34
        assert all({"id", "reference", "pointer"} <= set(s) for s in res["data"]["sources"])
