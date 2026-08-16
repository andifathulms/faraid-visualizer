"""The static seed-case flow (DESIGN.md build order step 4) must be what the engine
actually computes, not a hand-typed snapshot that can drift from it.

Mirrors test_reference_export.py's staleness gate: add a rule change that moves the
seeded case's figures without regenerating, and this goes red.
"""

from __future__ import annotations

import json

import pytest

from scripts.export_seed_flow import OUT, SEED_CASE, build
from faraid_web.tests.test_worked_example import EXAMPLE


def test_seed_case_matches_the_worked_example_and_frontend_seed():
    """One case, three places it must be identical: this export, WorkedExample.tsx's
    EXAMPLE_CASE, and page.tsx's form seed — test_worked_example.py already pins the
    figures for the same request. This export ships both languages; EXAMPLE pins "id"."""
    assert {**SEED_CASE, "lang": "id"} == EXAMPLE


def test_committed_seed_flow_is_current():
    if not OUT.exists():  # pragma: no cover - only before the first export
        pytest.fail(f"{OUT} is missing. Run: python scripts/export_seed_flow.py")
    committed = json.loads(OUT.read_text(encoding="utf-8"))
    assert committed == build(), (
        "The committed seed-flow.json is stale — a rule change moved the seeded case's "
        "figures. Run: python scripts/export_seed_flow.py"
    )
