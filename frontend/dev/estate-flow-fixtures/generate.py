"""Generate EstateFlow's standalone fixtures from the real engine.

Calls `faraid_web.service.calculate_payload` — the exact function the DRF endpoint and
the in-browser Pyodide bridge both call — so every value these fixtures carry is a real,
already-serialized derivation, not hand-typed. No new heir types, no invented shares, no
change to faraid_engine/ or the citation registry.

Run from backend/ with the project venv active:
    python ../frontend/dev/estate-flow-fixtures/generate.py

One exception: `dzawil_arham` is NOT a calculate() result. `resolve_dzawil_arham()` can
only fire when every present heir produced zero furud/asabah award and residue > 0 — and
every Relation the v1 heir model captures (PRD §5.1) is furud- or asabah-eligible, so no
valid input reaches it (confirmed by reading derive.py/dzawil_arham.py and by exhaustively
running calculate() over every single/paired heir-type combination across all five
rulesets: zero UnsupportedConfiguration raises of any kind). Building a fixture that
fires it would mean inventing heir types the engine does not have, which is out of scope
here and is exactly what CLAUDE.md says to stop and ask about rather than guess. So that
fixture is a hand-assembled envelope carrying dzawil_arham.py's own real, already-written
refusal message — not a computed distribution — clearly flagged `"synthetic": true`.
"""

from __future__ import annotations

import json
from pathlib import Path

from faraid_engine.rulesets import get_config
from faraid_web.service import calculate_payload, compare_payload

OUT = Path(__file__).parent

MONEY = {"gross_value": "480000000", "funeral_costs": "8000000", "debts": "20000000"}


def gen(name: str, heirs: dict, ruleset: str, *, estate: dict | None = None) -> None:
    payload = {"heirs": heirs, "ruleset": ruleset, "mode": "professional", "lang": "id"}
    if estate is not None:
        payload["estate"] = estate
    result = calculate_payload(payload)
    (OUT / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {name}.json  (pokok_masalah={result['pokok_masalah']}, "
          f"aul_base={result['aul_base']}, radd={result['radd_applied']}, "
          f"blocked={len(result['blocked'])})")


def gen_compare(name: str, heirs: dict, estate: dict, *, apply_harta_bersama: bool = False) -> None:
    """DESIGN.md §7 (shared scale, divergence-linked gold line) needs a compare_payload()
    fixture — a full ComparisonEntry list, not a single CalculationResult — for the case
    where KHI and Syafi'i genuinely produce different net_divisible amounts from the same
    input (harta bersama is KHI-only)."""
    payload = {"heirs": heirs, "ruleset": "khi", "mode": "professional", "lang": "id",
               "estate": estate, "apply_harta_bersama": apply_harta_bersama}
    result = compare_payload(payload, ["khi", "syafii"])
    (OUT / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    nets = [e["result"]["estate"]["net_divisible"] for e in result["comparison"] if e["ok"]]
    print(f"wrote {name}.json  (net_divisible per column: {nets})")


def gen_dzawil_arham_refusal() -> None:
    """Hand-assembled — see module docstring. Not a calculate() result."""
    config = get_config("khi")
    message = (
        "Only dzawil arham (distant kindred) would inherit here, but dzawil arham heir "
        "capture is not implemented in v1 (PRD §5.1 scope). This configuration cannot be "
        "resolved without inventing a distribution — please consult an ustadz/PPAIW. "
        f"(routing basis: {config.source_for('dzawil_arham')})"
    )
    out = {
        "synthetic": True,
        "synthetic_reason": (
            "No heir input in the v1 model reaches faraid_engine.rules.dzawil_arham."
            "resolve_dzawil_arham() — every modeled Relation is furud- or asabah-eligible, "
            "so awards is never empty for a validated, non-empty heir set. This envelope "
            "exists only to exercise EstateFlow's refused/unsupported render path with the "
            "engine's own real error text, not a computed distribution."
        ),
        "kind": "unsupported",
        "error": "UnsupportedConfiguration",
        "detail": message,
    }
    (OUT / "dzawil_arham.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print("wrote dzawil_arham.json  (synthetic refusal, not a computed case)")


def main() -> None:
    # Blocked-heir case (grandfather blocked by father), with an estate entered so the
    # terminal segments carry rupiah amounts (DESIGN.md §5.2).
    gen("blocked_grandfather", {"father": True, "paternal_grandfather": True, "sons": 1},
        "khi", estate=MONEY)

    # 'Aul — every valid base (PRD §5.2 step 6). All Syafi'i except 15/27, per test_bank.py.
    gen("aul_6_7", {"husband": True, "full_sisters": 1, "maternal_siblings": 1}, "syafii",
        estate=MONEY)
    gen("aul_6_8", {"husband": True, "full_sisters": 2, "maternal_siblings": 1}, "syafii")
    gen("aul_6_9", {"husband": True, "full_sisters": 2, "maternal_siblings": 2}, "syafii")
    gen("aul_6_10", {"husband": True, "mother": True, "full_sisters": 2, "maternal_siblings": 2},
        "syafii")
    gen("aul_12_13", {"wives": 1, "full_sisters": 2, "mother": True}, "syafii")
    gen("aul_12_15", {"husband": True, "daughters": 3, "father": True, "mother": True}, "khi")
    gen("aul_12_17", {"wives": 1, "mother": True, "full_sisters": 2, "maternal_siblings": 2},
        "syafii")
    gen("aul_24_27", {"wives": 1, "daughters": 2, "father": True, "mother": True}, "khi")

    # Radd with spouse exclusion (PRD §5.2 step 7 — spouse excluded from radd, flagged).
    gen("radd_spouse_excluded", {"wives": 1, "mother": True, "daughters": 1}, "khi",
        estate=MONEY)

    # Dzawil arham — see gen_dzawil_arham_refusal().
    gen_dzawil_arham_refusal()

    # Compare mode, shared scale (DESIGN.md §7): KHI separates 20M of harta bersama that
    # Syafi'i never does, so net_divisible genuinely differs (80M vs 100M) from the same
    # gross estate — the case a shared trunk scale exists to render honestly.
    gen_compare("compare_hb_divergence", {"wives": 1, "sons": 1, "daughters": 1},
                {"gross_value": "120000000", "debts": "20000000", "joint_assets": "40000000"},
                apply_harta_bersama=True)


if __name__ == "__main__":
    main()
