"""API-layer tests (run via `python manage.py test api`).

Kept separate from the engine's pytest bank so the engine stays testable with zero Django
dependency (CLAUDE.md). These cover HTTP contract: mode pinning, full derivation payload,
citation bundling, and error mapping for unsupported/invalid input.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.test import APITestCase


class CalculateEndpointTests(APITestCase):
    def test_personal_endpoint_pins_mode_and_returns_full_derivation(self):
        payload = {
            "heirs": {"husband": True, "daughters": 3, "father": True, "mother": True},
            "ruleset": "khi",
            "mode": "professional",  # should be overridden by the endpoint
        }
        res = self.client.post("/api/calculate/personal/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertEqual(body["mode"], "personal")
        self.assertEqual(body["aul_base"], 15)
        self.assertTrue(body["shares"])
        self.assertTrue(body["steps"])
        self.assertTrue(body["disclaimer"])
        # Every cited source_id must be resolved in the bundle.
        cited = {s["source_id"] for s in body["shares"]}
        self.assertTrue(cited <= set(body["sources"].keys()))

    def test_professional_endpoint_pins_mode(self):
        res = self.client.post(
            "/api/calculate/professional/",
            {"heirs": {"sons": 1}, "ruleset": "syafii"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["mode"], "professional")

    def test_unsupported_configuration_returns_422(self):
        res = self.client.post(
            "/api/calculate/personal/",
            {"heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1}, "ruleset": "syafii"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(res.json()["error"], "UnsupportedConfiguration")

    def test_beta_madhab_returns_200_with_beta_flag(self):
        res = self.client.post(
            "/api/calculate/personal/", {"heirs": {"sons": 1}, "ruleset": "hanafi"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertTrue(body["beta"])
        self.assertTrue(any("BETA" in n for n in body["notes"]))

    def test_maliki_no_radd_diverges_from_hanbali(self):
        heirs = {"mother": True, "daughters": 2}
        maliki = self.client.post(
            "/api/calculate/personal/", {"heirs": heirs, "ruleset": "maliki"}, format="json"
        ).json()
        daughters = next(s for s in maliki["shares"] if s["relation"] == "daughter")
        self.assertEqual(daughters["share"]["text"], "2/3")  # Maliki: no radd

    def test_invalid_heirs_returns_422(self):
        res = self.client.post(
            "/api/calculate/personal/",
            {"heirs": {"husband": True, "wives": 1}, "ruleset": "khi"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(res.json()["error"], "InvalidHeirInput")

    def test_bad_input_shape_returns_400(self):
        res = self.client.post(
            "/api/calculate/personal/", {"heirs": {"wives": 9}, "ruleset": "khi"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_representation_divergence_over_api(self):
        payload = {
            "heirs": {"sons": 2, "representatives": [{"replacing": "son", "sons": 1, "daughters": 1}]},
            "ruleset": "khi",
        }
        res = self.client.post("/api/calculate/personal/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        shares = {s["relation"]: s["share"]["text"] for s in res.json()["shares"]}
        self.assertEqual(shares["grandson_via_son"], "2/9")
        self.assertEqual(shares["granddaughter_via_son"], "1/9")


class PdfExportTests(APITestCase):
    def test_professional_pdf_returned(self):
        res = self.client.post(
            "/api/calculate/professional/pdf/",
            {"heirs": {"husband": True, "daughters": 3, "father": True, "mother": True}, "ruleset": "khi"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("attachment", res["Content-Disposition"])
        self.assertTrue(res.content.startswith(b"%PDF"))
        self.assertGreater(len(res.content), 1500)

    def test_pdf_export_rejects_unsupported(self):
        res = self.client.post(
            "/api/calculate/professional/pdf/",
            {"heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1}, "ruleset": "syafii"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)


class CompareEndpointTests(APITestCase):
    def test_compare_khi_vs_syafii_shows_divergence(self):
        # Sole husband: KHI radd → all to husband; Syafi'i → 1/2 + baitul mal.
        res = self.client.post(
            "/api/compare/", {"heirs": {"husband": True}, "rulesets": ["khi", "syafii"]}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        by = {c["ruleset"]: c for c in res.json()["comparison"]}
        khi = next(s for s in by["khi"]["result"]["shares"] if s["relation"] == "husband")
        syafii = next(s for s in by["syafii"]["result"]["shares"] if s["relation"] == "husband")
        self.assertEqual(khi["share"]["text"], "1")
        self.assertEqual(syafii["share"]["text"], "1/2")

    def test_compare_reports_unsupported_per_ruleset(self):
        # Grandfather + siblings: handled under KHI, but mu'adda raises under Syafi'i.
        res = self.client.post(
            "/api/compare/",
            {"heirs": {"paternal_grandfather": True, "full_sisters": 1, "paternal_brothers": 1}, "rulesets": ["khi", "syafii"]},
            format="json",
        )
        by = {c["ruleset"]: c for c in res.json()["comparison"]}
        self.assertTrue(by["khi"]["ok"])
        self.assertFalse(by["syafii"]["ok"])
        self.assertEqual(by["syafii"]["error"], "UnsupportedConfiguration")

    def test_compare_drops_khi_only_options_for_classical(self):
        # Representatives are KHI-only; comparison should still succeed on the Syafi'i side.
        res = self.client.post(
            "/api/compare/",
            {"heirs": {"sons": 2, "representatives": [{"replacing": "son", "sons": 1, "daughters": 1}]},
             "rulesets": ["khi", "syafii"]},
            format="json",
        )
        by = {c["ruleset"]: c for c in res.json()["comparison"]}
        self.assertTrue(by["khi"]["ok"] and by["syafii"]["ok"])


class SourcesEndpointTests(APITestCase):
    def test_sources_listed(self):
        res = self.client.get("/api/sources/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["count"], 34)
