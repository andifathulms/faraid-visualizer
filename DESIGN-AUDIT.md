# FaraidVisualizer — Design Audit

Factual inventory of the codebase as it stands. No recommendations.

## 1. What this app is

FaraidVisualizer is a free, single-page Islamic-inheritance (faraid) calculator for an
Indonesian audience, aimed at two user groups via a mode toggle: "Personal" (families,
informal language, simplified derivation) and "Professional" (ustadz/notaris/PPAIW/
Pengadilan Agama staff, full step-by-step derivation with citations and PDF export). Per
PRD.md §1–2, the product's stated differentiator is that it shows *why* each heir gets
their share — every rule fired carries a citation (Qur'an ayat pointer, hadith, KHI
pasal, or named classical fiqh reference) — rather than returning a bare number.

The core object is the **derivation of a single calculation result**: an ordered
pipeline (debt deduction → harta bersama deduction → hajb/blocking → furud → asabah →
'aul/radd → dzawil arham) applied to a user-entered set of heirs and an optional estate
value, producing a list of shares each traceable to a cited rule. It is rendered two
ways in [ResultView.tsx](frontend/components/ResultView.tsx) — a share list + working
table (default) — and, via a toggle, as a node/edge graph in
[DerivationFlow.tsx](frontend/components/DerivationFlow.tsx) built on React Flow.

## 2. Stack & constraints

- **Frontend framework**: Next.js 14.2.5 (App Router), React 18.3.1, TypeScript 5.5.3.
- **Build/deploy**: `next build` with `output: "export"` — a fully static site, no
  server at runtime ([next.config.js](frontend/next.config.js)). Deployed to GitHub
  Pages under a repo subpath (`basePath` set from `NEXT_PUBLIC_BASE_PATH`,
  `trailingSlash: true`), per `SITE_URL = "https://andifathulms.github.io/faraid-visualizer"`
  in [lib/site.ts](frontend/lib/site.ts). A GitHub Actions workflow
  ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) exists for this.
- **Rule engine execution**: there is a full Django + DRF backend in `backend/`
  (`faraid_engine/`, `faraid_web/`, `api/` — DRF views, migrations, admin), but the
  deployed frontend does **not** call it over HTTP. Per
  [lib/engine.ts](frontend/lib/engine.ts), the *same* Python packages
  (`faraid_engine`, `faraid_web`) are run client-side inside the browser via Pyodide
  (CPython compiled to WebAssembly, npm package `pyodide@314.0.3`, ~13 MB runtime + a
  separately fetched ~2.9 MB reportlab/Pillow bundle loaded on demand for PDF export).
  The frontend calls a `dispatch(action, json)` Python entrypoint
  (`faraid_web.bridge.dispatch`) for `calculate`, `compare`, `pdf`, `sensitivity`,
  `sources` actions. The Django backend appears to be the source of truth / test
  surface for the same logic, not the production request path.
- **Routing**: two static routes — `/` (main tool) and `/references/` (citation
  registry + coverage-gap listing), declared in `ROUTES` in
  [lib/site.ts](frontend/lib/site.ts) and used by
  [app/sitemap.ts](frontend/app/sitemap.ts)/[app/robots.ts](frontend/app/robots.ts).
  `robots.ts` additionally disallows crawling `/py/` and `/pyodide/` (the exported
  Python-engine and WebAssembly-runtime asset directories, which have no page content).
  No Next.js App Router `error.tsx`/error-boundary file exists anywhere under
  `frontend/app/`, and no React `componentDidCatch`/error-boundary component exists in
  `frontend/components/`. No service worker or offline-caching config was found beyond
  the PWA manifest (no `sw.js` reference in `layout.tsx`/`page.tsx`).
- **Styling**: hand-written global CSS in a single file,
  [frontend/app/globals.css](frontend/app/globals.css) (1616 lines). No CSS framework,
  no CSS-in-JS, no Tailwind. Class-name based, BEM-adjacent but not strictly BEM
  (e.g. `.card-head`, `.share-item`, `.rf-node.rf-blocked`).
- **Charts/diagram library**: `reactflow@11.11.4` — confirmed imported in
  [DerivationFlow.tsx](frontend/components/DerivationFlow.tsx) (`ReactFlow`,
  `Background`, `Controls`, `Handle`, custom `nodeTypes`). This is the only
  charting/diagramming dependency; there is no D3, Chart.js, Recharts, or similar.
  Proportional visualization elsewhere (the share breakdown bar) is a hand-rolled flex
  bar in [components/ui.tsx](frontend/components/ui.tsx) (`ProportionBar`), not a
  chart library.
- **Fonts**: `next/font/google` — Plus Jakarta Sans (weights 400/500/600/700, sans) and
  Fraunces (weights 500/600/700, serif), both declared and subset-loaded in
  [app/layout.tsx](frontend/app/layout.tsx), exposed as CSS vars `--font-sans` /
  `--font-serif`.
- **State**: no external state library — plain React `useState`/`useEffect`/`useRef` in
  [app/page.tsx](frontend/app/page.tsx). Case state (heirs, estate, ruleset, mode,
  harta bersama toggle, compare-mode) is serialized into the URL query string via
  [lib/urlstate.ts](frontend/lib/urlstate.ts) for sharing (a "Salin tautan" / copy-link
  action), using short single/double-letter query keys (e.g. `w`=wives, `gv`=gross_value,
  `hb`=harta_bersama, `cmp`=compareMode) explicitly to keep pasted links short, with
  decoded values clamped to the same limits the backend's `validate.py` enforces before
  being trusted; `writeStateToUrl`/`clearStateFromUrl` call `window.history.replaceState`
  directly rather than through Next's router, to avoid a full route re-render for an
  address-bar-only update. Separately, theme and language preferences persist to
  `localStorage` (`fv-theme`, `fv-lang`).
- **Constraints actually engineered around**: offline/static hosting (no backend calls
  in production), a WebAssembly payload that must download before first use (handled
  with a boot-status UI and a debounce-based "live recalculation" once loaded), bundle
  size (React Flow's ~45.8 KB gz is lazy-loaded via `next/dynamic` with `ssr:false`,
  only when the diagram view is opened), PWA installability
  ([public/manifest.webmanifest](frontend/public/manifest.webmanifest): standalone
  display, portrait-primary, maskable icon), reduced-motion, and bilingual output
  (Indonesian default / English, `lang` sent per-request so *result* text is
  server/engine-localized while static UI chrome is localized client-side via
  [lib/strings.ts](frontend/lib/strings.ts)/[lib/i18n.tsx](frontend/lib/i18n.tsx)).

## 3. Visual system as-built

All tokens are declared in `:root` at the top of
[globals.css](frontend/app/globals.css) (lines 17–134) and consumed via `var(--x)`
throughout the file; there is no separate design-tokens file, no Tailwind config, no
theme object in TypeScript — CSS custom properties are the single source.

### Colour

Every colour is a CSS variable; there are effectively zero raw hex literals used as
component colours outside the `:root` blocks themselves (three `:root`-scoped
definitions: light default, dark via `@media (prefers-color-scheme: dark)` scoped to
`:root:not([data-theme])`, and dark via explicit `:root[data-theme="dark"]`). Grep of
the whole file for hex literals returns 379 occurrences total, effectively all inside
those three variable-declaration blocks (each dark colour is declared twice — once for
the media-query path, once for the explicit-`data-theme` path — which is why most dark
hex values show a count of exactly 2). No hex literal outside the palette declarations
was found in the component-selector body of the file.

Palette groups, by role (light values shown; each has a matching dark redefinition):

- **Surfaces/neutrals**: `--bg #f4f1e9`, `--bg-grad-1/2`, `--surface #fffefb`,
  `--surface-2`, `--surface-inset`, `--border #e7e1d3`, `--border-strong`.
- **Text ramp** (3 ranks, each annotated with a measured contrast ratio in a comment):
  `--text #1d1c17` (14.6:1), `--text-muted #534e45` (7.1:1), `--text-faint #726b5e`
  (4.5:1, the stated floor).
- **Brand**: `--primary #0f6d51` (green, 5.4:1), `--primary-strong`, `--primary-soft`,
  `--primary-softer`, `--on-primary #ffffff`.
- **Citation colour**: `--gold #876519` / `--gold-soft #f4ecd7` — called out in a
  comment as "the citation colour — the one thing that makes this tool different from
  every other faraid calculator."
- **Semantic/category**: `--furud` (green, reuses `--primary`), `--asabah` (blue,
  `#345ea8`), `--radd` (purple, `#7a54a3`), `--dzawil` (teal, `#0c7878`), `--blocked`/
  `--danger` (red-brown, `#b24230`), `--warn` (`#8b6518`), each with a `-soft`
  background variant.
- **Per-heir chart palette**: `--heir-1` through `--heir-10`, a 10-step cycled
  categorical ramp (`colorFor()` in [ui.tsx](frontend/components/ui.tsx) does
  `index % 10`), used only as backgrounds (proportion bar segments, legend swatches),
  explicitly exempted from the 4.5:1 text-contrast floor and held to a 3:1 graphical
  floor per the file's opening comment.

Two dark-mode paths are maintained in lockstep (the media-query block and the explicit
`[data-theme="dark"]` block duplicate the same values) with a code comment flagging
they must be kept in sync by hand.

### Typography

One 9-step type scale, all in `rem`, base 16px, ratio ~1.15–1.2, declared as
`--fs-2xs` (12px) through `--fs-3xl` (36px); a comment states this scale replaced "23
ad-hoc sizes this file used to carry." Three line-height tokens (`--lh-tight` 1.2,
`--lh-snug` 1.4, `--lh-body` 1.55). Two font families, both via CSS vars:
`--sans` (Plus Jakarta Sans, UI body/most text) and `--serif` (Fraunces, used for the
wordmark, headings/hero title, modal titles, and the `.frac` fraction glyphs). A code
comment in [layout.tsx](frontend/app/layout.tsx) states the actually-used weights were
measured against the stylesheet (600×33, 700×26, 500×5 uses) to decide which font
weights to ship, and that italic Fraunces was dropped as unused. No monospace typeface
is loaded anywhere; `font-variant-numeric: tabular-nums` is used instead wherever
figures need to align (a `.maker-year` comment states this explicitly).

### Spacing, radius, shadow

- Spacing: a 4px-based ramp, `--sp-05` (2px) through `--sp-16` (64px), 12 steps total,
  with two documented half-steps (`--sp-05`, `--sp-15`) for controls that need 2px/6px.
- Border radius: 5 steps, `--radius-xs` (8px) through `--radius-xl` (26px), plus a few
  hardcoded one-off radii inline in component-specific rules (e.g. `.brand-mark
  border-radius: 12px`, `.modal-emblem border-radius: 15px`, `.rf-node border-radius:
  12px`) — these three are the only radius values in the file not drawn from the
  `--radius-*` ramp.
- Shadow: 4 tokens, `--shadow-sm/md/lg` (layered `rgba` box-shadows) and `--ring` (a
  3px `box-shadow` focus ring at 18%/28% opacity of `--primary`), each with a distinct
  dark-mode redefinition (dark shadows use plain black at higher opacity rather than
  the light mode's colour-tinted values).

All of the above are centralised in the single `:root` block at the top of
[globals.css](frontend/app/globals.css); the rest of the file (component rules)
consumes them exclusively via `var()`, per the file's own opening comment ("No rule in
this file sets a raw font-size, and padding/margin/gap values come off the 4px spacing
ramp"). No separate JS/TS token file mirrors these values for use in components — the
one place components read a raw colour value in JS is `colorFor()` in
[ui.tsx](frontend/components/ui.tsx), which returns the string `var(--heir-N)` (a CSS
var reference, not a resolved colour).

### Dark mode

Full dark theme, not partial: every token in `:root` has a dark counterpart. Two
trigger paths — OS-level `prefers-color-scheme: dark` (applies automatically when no
explicit user choice is stored) and an explicit three-state toggle
(System/Light/Dark) in [lib/theme.tsx](frontend/lib/theme.tsx) that stamps
`data-theme` on `<html>` and persists to `localStorage` under key `fv-theme`. A
blocking inline script in the `<head>` (`THEME_INIT_SCRIPT`, defined in
[lib/theme.tsx](frontend/lib/theme.tsx), injected in
[layout.tsx](frontend/app/layout.tsx)) reads that key before hydration to avoid a
flash of the wrong theme. `viewport.themeColor` in `layout.tsx` also switches between
`#f4f1e9` (light) and `#121310` (dark) via `prefers-color-scheme` media matchers (this
one is not wired to the explicit toggle, only to OS preference).

## 4. Screen & component inventory

### Routes

- **`/`** ([app/page.tsx](frontend/app/page.tsx), 605 lines, client component): the
  tool. Top to bottom: sticky app bar (wordmark link, references link, theme toggle,
  language segmented control) → hero (`h1` + lede + 3-point value-prop list) → two-pane
  `<main>` grid (sticky input form card on the left, result pane on the right) → static
  "More worked cases" article section below the tool
  ([MoreExamples.tsx](frontend/components/MoreExamples.tsx)) → a fixed mobile action
  bar (hidden ≥940px) → a conditionally-rendered disclaimer modal.
- **`/references/`** ([app/references/page.tsx](frontend/app/references/page.tsx),
  server component that only supplies route metadata, delegating render to
  [ReferencesView.tsx](frontend/app/references/ReferencesView.tsx)): a single-column
  document page — same app bar minus the "references" link (already there) — listing
  every citation in the engine's source registry grouped by type (Qur'an, hadith,
  ijma, KHI, classical, case law), sourced from a build-time-generated JSON
  ([lib/generated/reference-data.json](frontend/lib/generated), produced by
  `backend/scripts/export_reference_data.py`), plus a per-ruleset coverage-gap listing
  (silent gaps always shown, "announced" gaps behind a disclosure). This route boots no
  Pyodide engine.
- `robots.ts` / `sitemap.ts`: standard Next.js route handlers generating
  `robots.txt`/`sitemap.xml` from the two routes in `ROUTES`.

### Component inventory (one line each)

- **HeirForm** — the heir-count input form: 6 collapsible sections (spouse, children,
  parents, grandparents, grandchildren, siblings) built from steppers/switches, plus a
  KHI-only "ahli waris pengganti" (representative) repeater and an estate-figures
  section (4 money fields + KHI-only joint-assets field and harta-bersama checkbox).
- **ResultView** — the main result renderer: beta warning, summary badges + proportion
  bar + legend, estate-deduction breakdown strip, share list (expandable "why?" rows
  with citations), working table (pokok masalah/siham, Professional only), blocked-heir
  list, plain-language pipeline narrative (Personal) or full numbered timeline
  (Professional), notes, coverage gaps, disclaimer.
- **DerivationFlow** — React Flow node/edge graph: a root "divisible estate" node
  fanning out to one node per awarded share (colour-coded by category via left border)
  and, with dashed red edges, to blocked-heir nodes; includes a screen-reader-only text
  fallback pointing back to the table view.
- **ComparisonView** — side-by-side compare mode: renders one `ResultView` per ruleset
  column (KHI vs Syafi'i), or an "not computable under this school" error box per
  column when unsupported.
- **DivergenceNotice** — an inline banner (gold-accented, not styled as a warning/error)
  shown above the result when KHI and classical Syafi'i would diverge on this case,
  with per-heir before/after fraction rows and a button to switch into compare mode.
- **CoverageGaps** — lists what the engine doesn't (yet) handle for the active
  configuration, split into always-visible "silent" gaps (undetectable by using the
  app) and a collapsible "announced" list.
- **SensitivityPanel** — an on-demand "what-if" panel: runs ~30 additional single-slot
  counterfactual calculations and groups results into inert (nothing changes, often
  grouped by shared blocker), changing, and refused (unsupported) rows.
- **WorkedExample** — a static, hardcoded 4-stage narrative of one worked case (husband
  + 2 sons + 1 daughter, matches the form's seed data), shown in the result pane before
  any calculation exists.
- **EstateScale** — a labeled `<input type="range">` with 8 discrete round-number stops
  (Rp 50 jt–5 M) that rewrites the estate's `gross_value`, so the result re-derives live.
- **MoreExamples** — static below-the-fold article content: two more worked cases in a
  2-column grid (stacks <1100px), each a numbered step list ending in a pinned result box.
- **EngineStatus** — boot-progress indicator for the Pyodide runtime (spinner +
  status text while downloading/starting; error state with retry button; renders
  nothing once ready or on repeat visits where it's cached).
- **DisclaimerModal** — the non-skippable first-calculation disclaimer: custom
  focus-trap dialog (`inert` applied to all non-dialog `document.body` children,
  focus returned to the invoking element on close, Escape intentionally disabled).
- **ResultAnnouncer** — visually hidden live region that announces new results/errors
  to screen readers on live recalculation.
- **MakerSignature** — footer credit line (name + year + external link icons).
- **ui.tsx** — the shared primitives file: `Icon` (a hand-authored set of ~30 inline
  stroke SVGs, no icon package), `Fraction`, `Segmented` (native radio-group styled as
  a pill control), `NumberStepper`, `SwitchRow`, `MoneyInput` (Rp-prefixed, collapsible
  hint), `HeirSection` (collapsible), `CategoryChip`, `ProportionBar`, `colorFor`.

### Core-object component and its footprint

The core object (a calculation's derivation) is held by `ResultView`/`DerivationFlow`
inside `<section className="pane-result">`. Layout is a 2-column CSS grid
(`.layout { grid-template-columns: minmax(340px, 400px) 1fr }`), so on desktop the
result pane occupies the majority of the content width — roughly 3/4 to 4/5 of the
`--maxw: 1240px` content column once the ~340–400px fixed input pane is subtracted
(no exact px figure is computed anywhere; it is a `1fr` flex remainder). Below the
940px breakpoint the grid collapses to a single column (`grid-template-columns: 1fr`)
and the result pane becomes full-width, stacked below the form, with the calculate
action detaching into a `position: fixed` bottom bar.

## 5. Interaction & state

### User-controllable inputs

- Ruleset select (KHI/Syafi'i/Hanafi/Maliki/Hanbali), a native `<select>`.
- Mode segmented control (Personal/Professional).
- Per-heir-type inputs: boolean switches (husband, father, mother, both grandmothers,
  paternal grandfather), 0–4 stepper (wives), unbounded number steppers (all other
  heir counts, children, grandchildren, siblings by type).
- Representative ("ahli waris pengganti") repeater: add/remove rows, each with a
  select (replacing son/daughter) and two steppers (grandsons/granddaughters).
- Four money inputs (gross value, funeral costs, debts, wasiyya) plus a KHI-only joint
  assets money input and a harta-bersama checkbox.
- Compare-mode checkbox (KHI vs Syafi'i side by side).
- View toggle (table/diagram) once a result exists.
- Language toggle (ID/EN) and 3-state theme toggle (System/Light/Dark), both in the app
  bar, both persisted to `localStorage`.
- Copy-link button (writes current case to a shareable URL via the Clipboard API).
- PDF export button (Professional mode only, disabled while exporting).
- Reset ("kasus baru") button, shown only when the form is dirty.
- Estate-scale slider (appears once a result with a non-zero estate exists).
- Sensitivity panel: an on-demand "run" button, then per-row disclosure toggles.
- Per-share "why?" disclosure toggle (citation reasoning), open by default for the
  first share in Personal mode and for every share in Professional mode.
- Disclaimer modal accept button (the only way to dismiss it; Escape is disabled).

### Keyboard/gesture handling

- `Segmented` is a native radio `<fieldset>` (arrow-key nav, roving tabindex come free
  from the browser); a code comment documents this replaced a broken ARIA `tablist`
  pattern.
- `DisclaimerModal` implements a manual focus trap (Tab/Shift+Tab cycling, `inert` on
  background content, focus restored to the invoking element on close).
- `NumberStepper`/`MoneyInput`/`SwitchRow` all carry explicit `<label htmlFor>`
  associations and `aria-label`s per-field (code comments describe these as fixes for
  previously-unnamed form controls found via an accessibility-tree audit).
- Live recalculation on every input change once a first result exists, debounced
  250ms (`RECALC_DEBOUNCE_MS` in [page.tsx](frontend/app/page.tsx)).

### Animation

All animation is CSS-driven (transitions/keyframes), no JS animation library
(no Framer Motion, GSAP, etc.):

- `@keyframes fadein` — used for section reveals, the disclaimer overlay, seed/hint
  notes, engine-status banner.
- `@keyframes shimmer` — the loading-skeleton gradient sweep.
- `@keyframes engine-spin` / `engine-pulse` — the engine boot spinner; the pulse
  variant is the reduced-motion substitute for the spin (still needs to read as "in
  progress" without translating motion).
- Chevron/toggle rotations via `transform: rotate(180deg)` transitions (collapsible
  sections, coverage/pipeline/sensitivity disclosures, theme-toggle-adjacent icons).
- Switch-knob slide (`.switch::after { transition: transform 0.18s }`).
- Result-pane dim-on-recalculate (`.pane-updating { opacity: 0.55 }` transition,
  chosen over a skeleton swap to avoid flashing the whole pane on every keystroke, per
  a code comment).
- Smooth scroll-to-result on mobile after submit (`scrollIntoView({ behavior:
  "smooth" })`), conditional on `prefers-reduced-motion`.
- One JS/library-driven animation exists outside CSS: React Flow's built-in `animated`
  edge prop is set `true` for asabah-category edges in
  [DerivationFlow.tsx](frontend/components/DerivationFlow.tsx) (a dashed-line marching
  effect internal to the ReactFlow library, not a hand-authored keyframe).
- `@media (prefers-reduced-motion: reduce)` flattens all `animation-duration` to
  0.01ms and restricts transitions to non-motion properties (color/background/
  border-color/box-shadow/opacity), with the spinner's keyframe explicitly swapped to
  the pulse variant so it doesn't go fully inert.

### Loading / empty / error / no-result / first-visit states

All five are present and each has a distinct, purpose-built treatment:

- **First-visit**: the form is pre-seeded with a worked example
  (husband + 2 sons + 1 daughter) with a dismissable "seed" note explaining the
  pre-fill; the result pane shows `WorkedExample` (a static walkthrough) rather than
  being empty.
- **Loading**: `EngineStatus` (WASM download/boot, shown once per session until
  cached) and two calculation-scoped states — `busy === "initial"` renders skeleton
  blocks in the result pane; `busy === "live"` dims the existing result in place
  (`.pane-updating`) rather than replacing it.
- **Empty (no heirs entered)**: the Calculate button is disabled with a `title`
  tooltip and an inline hint (`t("need_heirs")`); an all-empty submission is blocked
  client-side before it would otherwise surface as an "unsupported configuration"
  engine error, per a code comment explaining this was a deliberate UX decision.
- **No-result / unsupported configuration**: a dedicated `.unsupported-box` treatment
  (amber/warn styling, explicitly not the red error treatment — a code comment states
  this is to avoid teaching users to distrust the engine when it is correctly refusing
  to guess).
- **Error**: a separate `.error-box` (red/danger styling) for genuine calculation
  failures, distinct from the unsupported-configuration case.
- **PDF export error / sensitivity error / clipboard failure**: each has its own
  localized inline error state (`.sens-error`, silently swallowed for clipboard denial
  with a code comment noting the URL is already visible so nothing is lost).

## 6. Weak points, stated plainly

- The app bar, hero, and two-pane form/result layout is a fairly conventional
  sidebar(form)+content(result) arrangement; nothing about its outer shell (sticky bar,
  centered `--maxw: 1240px` container, card-with-border-radius-and-shadow styling) is
  structurally different from a generic SaaS dashboard shell. What is app-specific is
  concentrated inside the result pane (working table, derivation timeline, blocked-heir
  list, React Flow graph, sensitivity panel) rather than in the page-level layout.
- `MoreExamples` and `WorkedExample` are static prose sections styled as numbered lists
  with a result box at the end — a card-grid/article layout, not a distinct visual
  treatment; a code comment in `MoreExamples` explicitly notes it was designed to avoid
  reading as "a second calculator," i.e. this was a considered choice, not an oversight.
- The estate breakdown (`gross − funeral − debts − wasiyya [− harta bersama] = net`) is
  rendered as an inline text sentence (`.estate-strip`), not as a labelled waterfall or
  stacked-bar breakdown, despite being an explicitly ordered arithmetic sequence (PRD
  §5.2 step 1).
- The "pokok masalah" (common denominator) / siham (parts) working is rendered as a
  plain HTML `<table>` (`.working`), horizontally scrollable with a mask-fade edge on
  narrow viewports — a numeric/tabular domain concept rendered as a literal table, with
  no visual encoding of magnitude (e.g. no bar-per-row, no proportional width).
- `ProportionBar` is a single-row flex bar of coloured `<div>` segments sized by inline
  `style={{ width: ... }}` — functional but minimal; it has no axis, no numeric labels
  on the bar itself (values live only in the adjacent legend/list), and no
  representation of the estate's absolute size (two cases with wildly different rupiah
  totals but the same fractions render an identical-looking bar).
- Blocked-heir relationships (who blocked whom) are stated as text
  ("blocked because X") in the table view and shown as dashed graph edges in the
  diagram view — the diagram view is the only place this structural relationship gets a
  spatial/visual treatment; it is behind a manual view toggle rather than default.
- A11y: no findings of missing focus states, contrast failures, or keyboard traps were
  found by reading the code — the opposite: the file carries extensive first-person
  code comments documenting specific accessibility defects that were found and fixed
  (unnamed form controls, unlabelled tablist misuse, a checkbox visually hidden in a
  way that also hid its focus ring, missing `<caption>` on the working table, the
  disclaimer modal's focus trap, `prefers-reduced-motion` coverage gaps, a 320px
  reflow failure in the app bar). No further gaps of this kind were identified by
  inspection, though this audit did not test with an actual screen reader or automated
  contrast tooling — see Open Questions.

## Open questions

- Whether the Django/DRF backend (`backend/api`, `backend/faraid_web/service.py`) is
  used in any deployed context (e.g. local development, a future non-static hosting
  target, or the source of the JSON consumed by `/references`) versus being purely a
  test/authoring surface whose logic is later inlined into the browser via Pyodide —
  this could not be confirmed from the frontend code alone.
- Actual runtime file sizes/performance (the ~13 MB Pyodide runtime and ~2.9 MB PDF
  bundle are quoted from code comments in `lib/engine.ts`, not independently measured
  here).
- Whether automated contrast/a11y tooling (axe, Lighthouse) has been run against the
  built site — the in-repo evidence is manual/code-comment-documented fixes, not tool
  output.
- Whether `frontend/out/` (the committed static export) is kept in sync with source or
  is a stale build artifact — not diffed against source in this audit.
- Full content of `PORTFOLIO_CONTEXT.md` and `README.md` was not read; they may contain
  additional stated intent not reflected in PRD.md/CLAUDE.md.
