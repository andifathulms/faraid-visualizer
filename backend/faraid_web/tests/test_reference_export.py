"""The references page must describe the registries, not a snapshot of them.

The page is static JSON generated from sources.py and coverage.py, which means it can go
stale — and a stale citation list on a tool whose entire proposition is citability is a
worse failure than not having the page. This test is the gate: add a source or a gap
without regenerating, and the suite goes red.
"""

from __future__ import annotations

import json

import pytest

from scripts.export_reference_data import OUT, build


def test_committed_reference_data_is_current():
    if not OUT.exists():  # pragma: no cover - only before the first export
        pytest.fail(
            f"{OUT} is missing. Run: python scripts/export_reference_data.py"
        )
    committed = json.loads(OUT.read_text(encoding="utf-8"))
    assert committed == build(), (
        "The generated reference data is stale — a source or coverage gap changed. "
        "Run: python scripts/export_reference_data.py"
    )


def test_export_covers_every_rule_set():
    data = build()
    for lang in ("id", "en"):
        assert set(data["gaps"][lang]) == {"khi", "syafii", "hanafi", "maliki", "hanbali"}


def test_every_exported_gap_carries_a_citation():
    data = build()
    for per_ruleset in data["gaps"].values():
        for gaps in per_ruleset.values():
            for gap in gaps:
                assert gap["source"]["reference"]
                assert gap["title"]


def test_quran_and_hadith_are_pointers_not_text():
    """PRD §5.3: never reproduce ayat or matn. The references page is the one surface
    where that constraint is easiest to breach, so it is asserted at the data layer."""
    data = build()
    for src in data["sources"]:
        if src["type"] in ("quran", "hadith"):
            # A pointer, a short reference and an editorial note — never a passage.
            assert len(src["pointer"]) <= 40
            assert len(src["reference"]) <= 120
