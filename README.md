<div align="center">

# Faraid Visualizer

**An Islamic inheritance calculator that shows _why_ each share is what it is.**

Every rule it applies is traceable to a cited source — Qur'an ayah, hadith, KHI pasal, or a
named classical fiqh reference. If a rule can't be cited, it doesn't ship.

[![Deploy](https://github.com/andifathulms/faraid-visualizer/actions/workflows/deploy.yml/badge.svg)](https://github.com/andifathulms/faraid-visualizer/actions/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/tests-158%20passing-brightgreen)](#testing)
[![Sources](https://img.shields.io/badge/cited%20sources-34-0f6d51)](backend/faraid_engine/sources.py)
[![No AI in calculation](https://img.shields.io/badge/calculation%20path-no%20AI-6b46c1)](#correctness-principles-non-negotiable)

**[→ Open the calculator](https://andifathulms.github.io/faraid-visualizer/)**

</div>

---

## What it does

Most faraid calculators hand you a number. This one hands you the derivation: which heirs
were blocked and by whom, which fixed shares (furud) were assigned, how the residue
(asabah) was split, whether 'aul or radd applied — each step annotated with the rule that
fired and the source it comes from.

| | |
|---|---|
| **Two rule sets, side by side** | KHI (Indonesian state law) and classical Syafi'i are modeled as *separate* rule sets, not variants. Compare the same heirs under both and see exactly where they diverge. |
| **Two modes** | *Personal* — plain language with "why?" expanders. *Professional* — full derivation, citations, PDF export. |
| **Bilingual** | Bahasa Indonesia and English, including the exported PDF. |
| **Honest about its limits** | An unhandled configuration raises an explicit "not supported" error. It never guesses. |

## Runs entirely in your browser

The deployed site is fully static — there is no backend, no account, and **no inheritance
data ever leaves the device**.

That is not a rewrite of the rule engine in JavaScript. The browser downloads
[Pyodide](https://pyodide.org) (CPython compiled to WebAssembly) and executes the *same*
`faraid_engine` Python package the API runs, validated by the same test bank. A second
implementation in another language would need its own validation pass and the two would
inevitably drift — so there is only one engine.

<details>
<summary><b>What that costs, honestly</b></summary>

<br>

The page itself loads instantly; the engine downloads in the background while you are
entering heirs, which normally takes longer than the download does.

| | Size | When |
|---|---|---|
| Page shell | ~150 kB | Immediately |
| Python runtime + engine | ~13 MB | Background, on first visit only (then cached) |
| PDF renderer | ~2.9 MB | Only if you export a PDF |

Measured locally: engine ready ~1s, first calculation ~2s, subsequent calculations ~0.4s.
Over a real network the first visit is realistically a few seconds; repeat visits are
served from cache. It also uses ~50–100 MB of RAM, which is unremarkable on a desktop but
worth knowing on an older phone.

</details>

## Correctness principles (non-negotiable)

- **No AI/LLM anywhere in the calculation path.** The engine is a deterministic rule
  system. This is enforced on every deploy by a CI check, not just by convention.
- **The engine never guesses.** An unhandled heir configuration raises
  `UnsupportedConfiguration` — never a silently wrong number.
- **KHI and classical Syafi'i are separate rule sets**, not variants of one another.
- **Uncited rules don't ship.** Every rule carries a `source_id` resolving to a real
  citation.
- Tier 2 madhabs (Hanafi/Maliki/Hanbali) ship only behind a **Beta** badge.

> [!WARNING]
> This is an educational tool, not a fatwa or a legal ruling. For a binding estate
> division, consult an ustadz, notary, or the Pengadilan Agama.

## Architecture

```
backend/
  faraid_engine/     Pure-Python rule engine. ZERO Django dependency.
    sources.py       Citation registry — every rule references a source_id.
    heirs.py         Heir domain model & input structures.
    results.py       Structured results {heir, share, rule_applied, source_id}.
    pipeline.py      PRD §5.2 orchestrator.
    rules/           hajb, furud, asabah, 'aul, radd, dzawil arham,
                     jadd-wal-ikhwah, representation, debts.
    rulesets/        KHI and classical Syafi'i, modeled separately.
    tests/           Validation test bank + KHI-vs-Syafi'i divergence tests.

  faraid_web/        Presentation & application layer. Also ZERO Django dependency.
    validate.py      The single input validator (server AND browser).
    serialize.py     Engine result -> the wire format both deployments return.
    labels.py        Bilingual labels, disclaimers, PDF headings.
    explain.py       English derivation prose, from structured fields.
    pdf.py           Professional-mode PDF (reportlab).
    bridge.py        JSON entrypoint the browser calls across the Pyodide boundary.

  api/               Django + DRF. Transport only: HTTP status mapping.

frontend/            Next.js, exported as a static site.
  lib/engine.ts      Boots Pyodide and runs faraid_web in the browser.
  scripts/           Build-time bundling of the Python sources + Pyodide runtime.
```

The split is what makes the static build possible: `faraid_engine` and `faraid_web` are
Django-free by construction, so the browser can run them unchanged. Everything
Django-specific stays in `api/`.

**Both deployments produce byte-identical results** — same validation, same wording, same
citations — because they run the same Python.

## Development

```bash
# Backend (API, admin, and the reference implementation)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_sources
.venv/bin/python manage.py seed_validation_bank
.venv/bin/python manage.py runserver              # :8000

# Frontend (static site — bundles the engine from ../backend automatically)
cd frontend
npm install
npm run dev                                       # :3000
npm run build                                     # -> out/
```

Or the whole stack, including Postgres:

```bash
docker compose up --build -d
```

### Testing

```bash
cd backend
.venv/bin/python -m pytest          # 141 tests, Django-free
.venv/bin/python manage.py test api #  17 tests, HTTP contract
```

The suite is the ship gate, not a formality:

- **62** worked examples in the validation test bank (PRD §6)
- **10** KHI-vs-classical-Syafi'i divergence cases, deliberately in their own file so
  they stay easy to audit
- **16** Beta-madhab cases
- **26** validator cases, covering the 400-vs-422 split — a malformed payload must never
  be reported to a user as "this inheritance case is unsupported"
- plus bridge, jadd-wal-ikhwah, and API contract tests

### API endpoints

The static site needs none of these, but the Django API remains the reference
implementation and the basis for a future API product.

| Method | Path | |
|---|---|---|
| `POST` | `/api/calculate/personal/` | Full derivation, Personal mode |
| `POST` | `/api/calculate/professional/` | Full derivation, Professional mode |
| `POST` | `/api/calculate/professional/pdf/` | PDF with full citation trail |
| `POST` | `/api/compare/` | Same heirs across rule sets |
| `GET` | `/api/sources/` | Citation registry |
| `GET` | `/api/health/` | |

## Status

Tier 1 (KHI + Syafi'i): 100% pass on the validation test bank — the v1 gate.
Tier 2 (Hanafi/Maliki/Hanbali): implemented, clearly marked **Beta**; the badge stays
until a ≥30-example validation pass per madhab.

Known limits, surfaced as explicit errors rather than approximations: the intricate
akdariyya/mu'adda sub-cases of al-jadd wa al-ikhwah, and dzawil arham routing beyond what
KHI covers.

See [PRD.md](PRD.md) for the product spec and [CLAUDE.md](CLAUDE.md) for build
instructions.
