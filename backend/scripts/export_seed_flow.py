"""Export the pre-authored seed-case derivation as static JSON.

DESIGN.md build order step 4: the result pane's before-first-calculation state shows a
static EstateFlow of the seeded case (husband + 2 sons + 1 daughter, KHI) so it renders
before Pyodide has even started downloading. Hand-typing that JSON would repeat the exact
mistake CLAUDE.md and export_reference_data.py both refuse — a snapshot that can silently
drift from what the engine actually computes. So this, like the references page, is
generated from a real calculate_payload() call, not authored by hand.

Must match EXAMPLE_CASE in frontend/components/WorkedExample.tsx, the seed in
frontend/app/page.tsx, and EXAMPLE in faraid_web/tests/test_worked_example.py — the same
case must produce the same figures wherever it appears. Run:

    python scripts/export_seed_flow.py

faraid_web/tests/test_seed_flow_export.py fails if the committed file is stale.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from faraid_web.service import calculate_payload  # noqa: E402

OUT = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "lib"
    / "generated"
    / "seed-flow.json"
)

LANGS = ("id", "en")

# Identical to EXAMPLE in faraid_web/tests/test_worked_example.py, minus `lang` — the
# derivation's labels/reasons are localized server-side (lib/i18n.tsx's own header
# comment), so a visitor with English selected before the engine has even started
# downloading must not see Indonesian heir labels in the static preview. Both languages
# ship in one file, the same pattern reference-data.json already uses for gap text.
SEED_CASE = {
    "heirs": {"husband": True, "sons": 2, "daughters": 1},
    "ruleset": "khi",
    "estate": {"gross_value": "120000000", "debts": "20000000"},
}


def build() -> dict:
    return {lang: calculate_payload({**SEED_CASE, "lang": lang}) for lang in LANGS}


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
