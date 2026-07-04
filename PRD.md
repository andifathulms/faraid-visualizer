# PRD — Faraid Visualizer

## 1. Problem

Islamic inheritance (faraid) causes real family disputes in Indonesia, mostly because
almost nobody outside pesantren-trained ustadz actually understands the calculation.
Existing calculators online are either (a) too simplified to be trustworthy, (b) locked
to one madhab without saying so, or (c) black boxes that give a number with no
derivation. None visualize *why* a share is what it is — which is exactly the thing that
prevents disputes: people accept an outcome they can see reasoned out, not one they're
just told.

## 2. Non-negotiable design principle

**This is a prescriptive tool. Wrong output has real consequences.** Every single rule
applied in a calculation must be traceable to a cited source (Qur'an ayat, hadith,
KHI pasal, or a named classical/contemporary fiqh reference). If a rule can't be cited,
it doesn't ship. The product's trustworthiness *is* the product — more important than
scope, madhab coverage, or UI polish.

## 3. Users & modes

Single app, two modes via toggle:

- **Personal mode** (default): informal language, simplified derivation view,
  prominent "this is educational, not a legal ruling — consult an ustadz/notaris/PPAIW
  for actual estate division" disclaimer on every result.
- **Professional mode**: for ustadz, notaris, PPAIW, Pengadilan Agama staff. Full
  step-by-step derivation chain (hajb → furud → 'aul/radd → asabah → dzawil arham),
  every intermediate value shown, every rule cited inline, exportable as PDF with
  citations, still carries a disclaimer but assumes the user knows what they're
  looking at.

## 4. Scope — Madhab coverage (phased trust model)

User selects a legal basis before entering heirs:

| Tier | Basis | v1 status |
|---|---|---|
| 1 | **KHI (Kompilasi Hukum Islam)** — Indonesian state law, Inpres No. 1/1991, Buku II | **Fully implemented, fully tested.** Default for Indonesian users. |
| 1 | **Syafi'i classical fiqh** (undiluted, no KHI state-law additions) | **Fully implemented, fully tested.** Shown as distinct from KHI — see §5. |
| 2 | Hanafi | Implemented, marked **"Beta — under scholarly validation"** until cross-checked against ≥30 known worked examples. |
| 2 | Maliki | Same beta gate as Hanafi. |
| 2 | Hanbali | Same beta gate as Hanafi. |

Do not ship Tier 2 rule sets without the beta label. Silent reuse of Syafi'i logic
under a different madhab label is the one failure mode we are explicitly designing
against.

### 4.1 KHI vs. classical Syafi'i — must be modeled as separate rule sets, not variants

This is the most important domain nuance in the whole product. They are close but
diverge on load-bearing points:

- **Ahli waris pengganti (KHI Pasal 185):** if an heir who would have inherited dies
  before the deceased, KHI lets their children step into their share (representation /
  per-stirpes-like). Classical Syafi'i fiqh has **no such concept** — a grandchild
  inherits (if at all) on their own standing as asabah bi nafsihi or dzawil arham, not
  as a substitute for a deceased parent, and typically gets less or nothing where KHI
  would give more.
- **Dzawil arham routing when no ashabul furud/asabah exist:** Syafi'i and Maliki
  historically route the remainder to baitul mal; Hanafi and Hanbali distribute to
  dzawil arham directly. KHI's practical application in Pengadilan Agama today
  generally favors distributing to dzawil arham/spouse via radd rather than baitul mal,
  since a functioning baitul mal claim mechanism doesn't exist in practice — this must
  be flagged to the user as a KHI-practice note, cited to case law commentary, not
  presented as classical Syafi'i doctrine.
- **Harta bersama (marital community property, Indonesian civil law concept):** KHI
  practice deducts the surviving spouse's harta bersama share (typically 1/2 of joint
  assets) *before* faraid is applied to the remainder — this does not exist in classical
  fiqh at all. Must be an explicit optional step, off by default in "classical Syafi'i"
  mode, promptable in KHI mode.

## 5. Core domain model

### 5.1 Heir input

Capture: spouse (max 1 wife input for husband's estate; up to 4 for wife's/husband's
plural marriage, mindful this is realistic in Indonesia), children (sons/daughters,
count only — names not needed for calculation), parents (living/deceased), grandparents
(paternal/maternal, living/deceased), siblings (full/paternal/maternal, count + sex),
grandchildren (only relevant if child predeceased — needed for KHI pengganti and
classical asabah bi ghairihi rules).

### 5.2 Calculation pipeline (must be run in this order, each step logged with citations)

1. **Debts & funeral costs deduction** — estate is netted first (cite: consensus, Fiqh
   al-Mawarits ordering; KHI Pasal 175/176 for the Indonesian sequence: funeral costs →
   debts → wasiat (max 1/3) → faraid).
2. **Harta bersama deduction** (KHI mode only, optional toggle) — see §4.1.
3. **Hajb (blocking)** — determine which heirs are excluded by closer heirs. Must
   render as an explicit "blocked because X" list, not silently drop heirs.
4. **Furud muqaddarah (fixed shares)** — assign Qur'anic fractions (1/2, 1/4, 1/8, 2/3,
   1/3, 1/6) to ashabul furud per the active rule set.
5. **Asabah (residuary)** — distribute remainder, applying 2:1 male:female ratio where
   applicable (asabah bi nafsihi, bi ghairihi, ma'a ghairihi — all three types must be
   modeled distinctly).
6. **'Aul** — if fixed shares exceed 1, proportionally reduce (only pokok masalah 6→7-10
   and 12→13/15/17 and 27→ variants are valid 'aul cases; the engine should only ever
   reach these specific ratios — if it produces an 'aul case outside them, that's a bug,
   not a new case).
7. **Radd** — if fixed shares total < 1 and no asabah exist, redistribute surplus
   proportionally to ashabul furud (spouse excluded from radd in majority Sunni view;
   flag this as a rule-set-dependent point, cite specifically).
8. **Dzawil arham** — only reached if no ashabul furud/asabah exist at all; routing
   depends on active madhab per §4.1.

### 5.3 Citation requirement per rule

Every rule fired in the pipeline must carry a `source` field: either a Qur'an ayat
reference (e.g. QS An-Nisa 4:11), a hadith reference with narrator, a KHI pasal number,
or a named classical reference (e.g. Fiqh al-Mawarits, al-Fiqh al-Islami wa Adillatuhu
by Wahbah az-Zuhaili — used only for cross-checking rule content, never for reproducing
its text). The UI renders these as inline footnotes in Professional mode and as a
collapsible "why?" in Personal mode.

## 6. Validation strategy

Before Tier 1 launch: compile a bank of ≥50 worked examples with known correct answers,
sourced from published fiqh mawaris textbooks and KHI commentary (not invented by us),
covering: simple cases (spouse+children only), each 'aul ratio, each radd scenario,
dzawil arham-only scenarios, and at least 10 KHI-vs-classical-Syafi'i divergence cases
specifically testing ahli waris pengganti. The engine must reproduce 100% of these
before Tier 1 is marked non-beta. This test bank is a first-class deliverable, not an
afterthought — treat it like the "sanad database" was for Sanad.

## 7. Non-functional requirements

- **Disclaimer is non-skippable** on first calculation per session, both modes.
- **No AI/LLM in the calculation path.** This must be a deterministic rule engine,
  same as NusaPattern's approach — a probabilistic model has no place deciding who
  gets what share of an inheritance. AI may assist only with natural-language
  explanation of an already-deterministically-computed result, clearly separated in
  the architecture.
- Multi-language: Bahasa Indonesia primary, English secondary.
- Professional mode PDF export must include full citation trail — this is the artifact
  a notaris/PPAIW would actually attach to a case file.

## 8. Explicit non-goals for v1

- No legal-binding document generation (surat keterangan waris) — output is advisory
  only, even in Professional mode.
- No Syiah Ja'fari fiqh (materially different heir structure) — separate future project
  if pursued, not a mode toggle on this engine.
- No wasiat wajibah automation (KHI Pasal 209, adopted-child bequest) — flag as a known
  gap, out of scope until Tier 1 is validated.
