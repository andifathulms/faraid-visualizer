# CLAUDE.md — Faraid Visualizer build instructions

Read PRD.md fully before writing any code. This project's correctness bar is higher
than usual — treat the rule engine like you'd treat a financial ledger, not a typical
CRUD feature. When in doubt about a fiqh rule, stop and ask rather than guessing or
"reframing" ambiguous input into something the engine can handle — an unhandled edge
case should surface as an explicit error to the user ("this configuration isn't
supported yet"), never a silently wrong number.

## Stack

- Backend: Django + DRF (matches existing stack — reuse patterns from NusaPattern's
  rule-based findings engine as the closest prior art: deterministic, no ML).
- Rule engine: plain Python, isolated as its own package (`faraid_engine/`) with zero
  Django dependency — must be independently unit-testable and eventually reusable
  outside the web app (e.g. a future API product).
- Frontend: Next.js. Tree/derivation visualization via a diagramming library (D3 or
  React Flow — React Flow already used in Sanad, prefer reuse of that familiarity).
- DB: PostgreSQL — mainly for storing the citation/reference tables and the validation
  test bank, not for calculation state (calculations are stateless/pure functions).

## Build order (do not reorder — later steps depend on earlier ones being correct)

1. **Citation & reference data layer first.** Build the `sources` table/fixtures:
   every rule in the engine references a `source_id`. Populate real citations (Qur'an
   ayat text reference — not full ayat text, just surah:ayah pointer; KHI pasal
   numbers; named book+author for classical rules). Do not write engine logic before
   this exists — the PRD is explicit that uncited rules don't ship.

2. **Rule engine core, Syafi'i/KHI only, no UI.** Implement the pipeline from PRD §5.2
   as pure functions: `deduct_debts`, `apply_hajb`, `compute_furud`, `compute_asabah`,
   `apply_aul`, `apply_radd`, `resolve_dzawil_arham`. Each returns a structured result
   with `{heir, share, rule_applied, source_id}` — never just a number.

3. **Validation test bank.** Before touching UI, encode the ≥50 worked examples from
   PRD §6 as test fixtures and get 100% pass rate on Syafi'i/KHI. This is the gate —
   do not proceed to step 4 until this is green. If you (Claude Code) cannot verify a
   worked example's expected answer independently, flag it to the user rather than
   trusting an unsourced fixture.

4. **KHI-vs-classical-Syafi'i divergence tests specifically** — PRD §4.1 cases
   (ahli waris pengganti, dzawil arham routing, harta bersama toggle). These are the
   highest-risk area; write these as their own explicit test file, not folded into
   general fixtures, so they're easy to audit later.

5. **API layer** — expose the engine via DRF, one endpoint per mode, returning the
   full structured derivation (not just final shares) so the frontend can render the
   step-by-step view.

6. **Frontend: input form** — heir capture UI per PRD §5.1. Validate input server-side
   too (never trust client-side-only validation for something feeding a legal
   calculation).

7. **Frontend: derivation visualization** — tree/flow view showing hajb exclusions,
   furud assignment, asabah distribution, with citations as hover/click footnotes.
   Personal mode: collapsed by default, "why?" expanders. Professional mode: fully
   expanded, exportable.

8. **Hanafi/Maliki/Hanbali rule sets** — only after step 4 is fully green. Ship behind
   a "Beta" badge per PRD §4. Do not remove the badge without an equivalent validation
   pass for each madhab.

9. **PDF export (Professional mode)** — full derivation + citations, matches PRD §7.

## Guardrails while building

- Never let the engine fall through to a default/guessed rule when heir configuration
  doesn't match a known pattern — raise `UnsupportedConfiguration` explicitly.
- Do not add a new madhab, a new edge case (e.g. khuntsa/mafqud/haml), or a new mode
  without adding source citations and test fixtures in the same PR — no "we'll cite it
  later."
- If you (Claude Code) are asked to add a feature that would require inventing a fiqh
  rule without a citable source, stop and ask the user rather than proceeding with a
  plausible-sounding guess.
- Every disclaimer string is a product requirement, not boilerplate — don't let a
  refactor accidentally drop it from a code path.

## Definition of done for v1 launch

- Syafi'i + KHI: 100% pass on validation test bank, all rules cited, both modes
  functional, PDF export working.
- Hanafi/Maliki/Hanbali: implemented and clearly marked Beta, not blocking v1 launch.
- No AI/LLM anywhere in the calculation path (PRD §7) — verify this explicitly before
  calling v1 done, e.g. grep the engine package for any model-call imports.
