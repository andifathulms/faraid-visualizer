# Faraid Visualizer — Frontend (Next.js)

Next.js 14 (App Router, TypeScript) UI for the faraid engine. Two modes (Personal /
Professional), heir capture per PRD §5.1, and the step-by-step derivation view with
inline citations.

## Setup

```bash
npm install
# Point at the backend (defaults to http://localhost:8000):
echo 'NEXT_PUBLIC_API_BASE=http://localhost:8000' > .env.local
npm run dev            # http://localhost:3000
```

The backend must be running (`cd ../backend && python manage.py runserver`) for
calculations. CORS for `localhost:3000` is preconfigured in the Django settings.

## Structure

- `app/page.tsx` — main screen: mode toggle, ruleset select, form, results.
- `components/HeirForm.tsx` — PRD §5.1 heir input (representatives & harta bersama are KHI-only).
- `components/ResultView.tsx` — shares table, hajb list, steps, citations, disclaimer.
- `components/DerivationFlow.tsx` — React Flow derivation diagram (hajb → furud → asabah).
- `components/DisclaimerModal.tsx` — non-skippable first-calculation disclaimer (PRD §7).
- `lib/api.ts` — typed client mirroring the DRF `serialize_result` payload.

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck`
