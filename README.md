# Faraid Visualizer

A **prescriptive** Islamic inheritance (faraid) calculator that shows *why* each share is
what it is. Every rule applied is traceable to a cited source (Qur'an ayat, hadith, KHI
pasal, or a named classical fiqh reference). If a rule can't be cited, it doesn't ship.

See [PRD.md](PRD.md) for the product spec and [CLAUDE.md](CLAUDE.md) for build instructions.

## Architecture

```
backend/
  faraid_engine/      # Pure-Python rule engine. ZERO Django dependency.
                      # Independently unit-testable, reusable outside the web app.
    sources.py        # Citation registry — every rule references a source_id.
    heirs.py          # Heir domain model & input structures.
    results.py        # Structured result types {heir, share, rule_applied, source_id}.
    exceptions.py     # UnsupportedConfiguration and friends.
    pipeline.py       # PRD §5.2 pipeline orchestrator.
    rules/            # deduct_debts, harta_bersama, apply_hajb, compute_furud,
                      # compute_asabah, apply_aul, apply_radd, resolve_dzawil_arham.
    rulesets/         # KHI and classical Syafi'i rule sets (modeled separately).
    tests/            # Validation test bank (PRD §6) + KHI-vs-Syafi'i divergence tests.
  faraid_api/         # Django + DRF wrapper exposing the engine (calculations are
                      # stateless pure functions; DB stores citations & the test bank).
frontend/             # Next.js UI — input form + derivation visualization (React Flow).
```

## Correctness principles (non-negotiable)

- **No AI/LLM anywhere in the calculation path.** The engine is a deterministic rule
  system. AI may only assist with natural-language explanation of an already-computed
  result, architecturally separated.
- The engine never falls through to a default/guessed rule. An unhandled heir
  configuration raises `UnsupportedConfiguration`, never a silently wrong number.
- KHI and classical Syafi'i are **separate rule sets**, not variants of one another.
- Tier 2 madhabs (Hanafi/Maliki/Hanbali) ship only behind a "Beta" badge.

## Development status

Built in the CLAUDE.md build order. Tier 1 (KHI + Syafi'i) is the v1 gate: 100% pass on
the validation test bank before any UI work is trusted.

## Running the engine tests

```bash
cd backend
python -m pytest faraid_engine/tests -v
```
