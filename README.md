# Health Goals Tracker

A local-first, mobile-friendly personal health tracker for daily body-weight
trends and alternating A/B strength workouts with automatic progressive-overload
suggestions.

- Product spec: [docs/prd.md](docs/prd.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Build plan / progress: [docs/plan.md](docs/plan.md)

## Stack

React 19 + TypeScript + Vite, IndexedDB via Dexie, installable PWA. No backend —
all data lives on the device.

## Scripts

```bash
npm run dev          # start dev server (http://localhost:5173)
npm run build        # typecheck + production build
npm run preview      # preview the production build
npm run test         # run unit tests once (Vitest)
npm run test:watch   # run tests in watch mode
npm run lint         # oxlint
npm run format       # Prettier
```

## Project structure

```
src/
  domain/       pure business logic (progression, weight stats) — no UI/DB
  data/         Dexie schema + repositories (all persistence lives here)
  features/     UI grouped by product area (dashboard, weight, workout, ...)
  components/   shared presentational components
  hooks/        shared React hooks
  lib/          small helpers
```

See [docs/architecture.md](docs/architecture.md) for the full design.
