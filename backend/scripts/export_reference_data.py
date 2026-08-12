"""Export the citation registry and the coverage registry as static JSON.

The references page is a plain static page on a site with no server. It must not boot the
9 MB WebAssembly runtime just to list 35 rows, and it must not restate the registries by
hand — a hand-written copy of a citation list is precisely the "we'll keep it in sync"
promise this project otherwise refuses to make.

So the page is generated from the registries. Run:

    python scripts/export_reference_data.py

``faraid_web/tests/test_reference_export.py`` fails if the committed file is stale, so a
new source or a new gap cannot ship without the page that documents it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from faraid_engine import Ruleset  # noqa: E402
from faraid_web.serialize import serialize_gaps  # noqa: E402
from faraid_web.service import sources_payload  # noqa: E402

OUT = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "lib"
    / "generated"
    / "reference-data.json"
)

LANGS = ("id", "en")


def build() -> dict:
    return {
        "_generated_by": "backend/scripts/export_reference_data.py",
        "sources": sources_payload()["sources"],
        # Gaps carry localized prose, and the page has no engine to ask at runtime, so
        # both languages ship. The set is tiny.
        "gaps": {
            lang: {rs.value: serialize_gaps(rs.value, lang) for rs in Ruleset}
            for lang in LANGS
        },
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
