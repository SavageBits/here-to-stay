# Health Goals Tracker — Build Plan

Step-by-step plan and checklist to build the MVP defined in [prd.md](./prd.md),
following the design in [architecture.md](./architecture.md).

**Stack:** React + TypeScript + Vite, IndexedDB via Dexie, local-first PWA.

**Build order rationale:** foundation → data model → pure business logic (with
tests) → repositories → UI, feature by feature. Business logic is built and
tested *before* the UI so the PRD's core rules (progression, 7-day average) are
proven correct in isolation.

---

## Phase 0 — Project Setup  ✅ COMPLETE (2026-08-31)

- [x] Scaffold Vite + React + TypeScript project (`npm create vite@latest`, react-ts).
      *Result: Vite 8, React 19, TypeScript 6.*
- [x] Enable TypeScript `strict` mode (in `tsconfig.app.json`).
- [x] Add dependencies: `dexie`, `dexie-react-hooks`, `react-router-dom`,
      `@tanstack/react-query`, `recharts`, `date-fns`.
- [x] Add dev dependencies: `vitest`, `@testing-library/react`,
      `@testing-library/jest-dom`, `jsdom`, `prettier`, `vite-plugin-pwa`.
- [x] Configure Vitest (jsdom environment, `src/test/setup.ts`).
- [x] Configure linter + Prettier; add `lint`, `format`, `test`, `dev`, `build` npm scripts.
      *Note: scaffold ships **oxlint** (kept — faster, zero-config) instead of ESLint.*
- [x] Create folder structure per architecture §3 (`domain/`, `data/`, `features/*`,
      `components/`, `hooks/`, `lib/`).
- [x] Verify `npm run dev` serves the app (HTTP 200), `npm run test` runs (smoke test
      green), `npm run build` typechecks + builds + generates PWA service worker,
      `npm run lint` clean.

**Deviations from original plan (all resolved):**
- `vite-plugin-pwa` bumped to `^1.3.0` and `vitest` to `^4.1.0` for Vite 8 peer-dep
  compatibility (the originally-listed 0.21 / 2.x lines do not support Vite 8).
- Linter is oxlint (Vite scaffold default), not ESLint.
- `strict` lives in `tsconfig.app.json` (the scaffold splits tsconfig into
  app/node projects).

**Next:** Phase 1 — define domain types & the PRD §15 entity interfaces.

---

## Phase 1 — Domain Types & Data Model  ✅ COMPLETE (2026-08-31)

- [x] Define shared domain types in `domain/types.ts` (WorkoutType, WorkoutStatus,
      DateISO, Timestamp, TrendDirection, TrendRange, SetResult).
- [x] Define entity interfaces matching PRD §15 in `domain/entities.ts`:
      `WeightEntry`, `WorkoutTemplate`, `Exercise`, `WorkoutTemplateExercise`,
      `WorkoutSession`, `WorkoutExercise`, `ExerciseSet` — each documented with
      its PRD reference and history/idempotency notes.
- [x] Add `lib/ids.ts` (`newId()` via `crypto.randomUUID()`) and `lib/dates.ts`
      (calendar-day helpers on `date-fns`: `today`, `toDateISO`, `subtractDays`,
      `calendarDaysBetween`, `isWithinRange`, `nowTimestamp`).
- [x] `tsc -b` typecheck clean, lint clean, tests green.

**Note:** entity interfaces live in `domain/entities.ts` (split from `types.ts`)
so pure logic and repositories share one source of truth without `data/`
depending on UI. Nullable fields (`weight`, `targetWeight`, `progressionAchieved`,
`nextTargetWeight`, `completedAt`, `archivedAt`) are explicitly typed to encode
bodyweight/incomplete/history states from the PRD.

**Next:** Phase 2 — pure business logic, test-first (progression, weight stats,
workout builder).

---

## Phase 2 — Pure Business Logic (test-first)  ✅ COMPLETE (2026-08-31)

**37 tests passing across the three modules. Typecheck + lint clean.**

### Progressive Overload (`domain/progression.ts`) — PRD §9, §16, §20  ✅

- [x] Implement `evaluateProgression(input): ProgressionOutcome`.
- [x] Constants: `TARGET_REP_GOAL = 12`, `PROGRESSION_INCREMENT_LB = 5`.
- [x] Success rule: ≥1 set, every set reps ≥ 12, every set weight ≥ target.
- [x] Success → target + 5; failure → target unchanged (never reduced).
- [x] Skipped → unchanged; bodyweight (null/0 target) → no progression.
- [x] **Tests (required by PRD §20)** — 14 tests, all passing:
  - [x] `55x12 ×4` → next 60.
  - [x] `60x12, 60x12, 60x10, 55x12` → stays 60.
  - [x] `60x12 ×4` → next 65.
  - [x] One set below target weight → no increase.
  - [x] One set below 12 reps → no increase.
  - [x] All sets above 12 reps → success.
  - [x] Exercise skipped → unchanged.
  - [x] Bodyweight exercise → no +5 rule (both null and 0 target).
  - [x] Re-evaluating an unchanged completed workout does **not** re-increment.
  - [x] Full 55 → 60 → 60 → 65 sequence (PRD §9.4) walked end-to-end.

### Weight Stats (`domain/weightStats.ts`) — PRD §5.2, §5.3, §20  ✅

- [x] Implement `sevenDayAverage` (mean of existing entries in the 7-day window;
      missing days excluded, never zero; returns `null` for an empty window).
- [x] Implement `trendDelta` (avg today − avg 7 days ago) and `trendLabel`
      (±0.25 lb thresholds).
- [x] Implement `movingAverageSeries` for the chart (per range; window can reach
      across the range boundary so edge points aren't truncated).
- [x] **Tests** — 15 tests: exactly 7 entries, fewer than 7, missing days,
      out-of-window entries, edited entries, deleted entries, empty window,
      trend delta + null cases, thresholds (down/flat/up/null), series ordering.

### Workout Builder (`domain/workoutBuilder.ts`) — PRD §7, §8  ✅

- [x] Implement `buildSessionFromPrevious` (copy order/current names/target,
      not reps; seed one set defaulted to 12; fall back to template when no
      previous; use current template names even after a rename; respect
      added/removed exercises via the current template set).
- [x] **Tests** — 8 tests: first-ever A/B, builds from previous, previous
      next-target used, template fallback for newly-added exercises, current
      names win over snapshots, removed exercises dropped, reps not copied,
      default 12, sort order.

**Notes:**
- Removed the Phase 0 smoke test now that real domain tests exist.
- `buildSessionFromPrevious` takes a `PreviousExerciseResult[]` (the prior
  session's per-exercise `nextTargetWeight`) rather than a whole session object,
  keeping the function pure and easy to test; sessionRepo will assemble this in
  Phase 3.

**Next:** Phase 3 — persistence layer (Dexie schema + repositories).

---

## Phase 3 — Persistence Layer  ✅ COMPLETE (2026-08-31)

**49 tests passing total (37 domain + 12 repository). Typecheck, lint, and
production build all clean.**

- [x] Define Dexie DB + v1 schema in `data/db.ts` (tables & indexes per
      architecture §5.1), including the `&date` unique index on `weightEntries`.
      Constructor accepts `DexieOptions` so tests can inject fake-indexeddb.
- [x] Document the migration/versioning pattern with a commented placeholder v2
      upgrade in `db.ts`.
- [x] `data/seed.ts`: `seedIfEmpty` creates Workout A & B templates with default
      exercises on first run; idempotent (no-op if already seeded).
- [x] `weightRepo`: `upsertWeight` (one-per-day), update, delete, list-in-range,
      list-all, latest, recent-window.
- [x] `exerciseRepo`: create / rename / archive logical exercises (stable IDs);
      list active.
- [x] `templateRepo`: get template, add / remove / reorder exercises,
      `setTemplateTargetWeight`, and `getTemplateExerciseViews` (the exact shape
      `buildSessionFromPrevious` consumes; skips archived).
- [x] `sessionRepo`: `startSession` (via `workoutBuilder` + previous results),
      load, add/update/delete sets (with set-number re-packing),
      `setExerciseCompleted`, `completeSession` (stamps + recomputes),
      `recomputeSession` (idempotent — derives results, updates template target),
      `reopenSession`, list-completed, get-active.
- [x] `backupRepo`: export JSON (full fidelity) + CSV (weigh-ins), import JSON
      (clear-then-bulk-add), version guard.
- [x] **Tests** — 12 repository tests via `data/testDb.ts` (isolated
      fake-indexeddb per test): one-weigh-in-per-day upsert/replace + decimals +
      delete; seed idempotency; first-session template targets + default set;
      success → next session target +5; **complete→recompute→re-complete does not
      double-increment**; edit-to-failure retains (never lowers) target;
      **rename does not rewrite historical snapshots**; set target weight; backup
      round-trip restores identical data; unsupported version rejected.

**Bug caught by tests (fixed):** `recomputeSession` read `workoutSessions` and
`workoutTemplates` inside its transaction but hadn't declared `workoutSessions`
in the transaction scope → Dexie `NotFoundError`. Fixed by adding it to the
transaction table list. This is exactly why the persistence layer is tested.

**Notes:**
- Added `fake-indexeddb` (dev dep) so Dexie runs headless under Vitest.
- Multi-table transactions (>4 tables) use the array form
  `db.transaction('rw', [tables], fn)` — Dexie's varargs overload is typed only
  up to a fixed arity.
- Bundle size is unchanged from Phase 0 because no UI imports `data/` yet
  (tree-shaking); it wires up in Phase 4.

**Next:** Phase 4 — app shell, routing, provider wiring, and first-run seed.

---

## Phase 4 — App Shell & Navigation  ✅ COMPLETE (2026-08-31)

**50 tests passing (adds an App-shell render test). Typecheck, lint, build clean.
Dev server serves `/` and SPA routes (200).**

- [x] `App.tsx`: React Router with all routes from architecture §6 (dashboard,
      weight, trend, templates, start-workout, active-workout, history, detail,
      exercise-history, settings) + catch-all redirect to `/`.
- [x] Mobile-first layout shell (`components/Layout.tsx`): single column with a
      fixed thumb-friendly bottom nav (Today / Weight / History / Workouts /
      Settings); dark high-contrast theme in `index.css`.
- [x] Run seed on first launch via `hooks/useSeed.ts` (loading gate until
      `seedIfEmpty` resolves); wire `QueryClientProvider` (React Query available
      for imperative async; reads will use Dexie `useLiveQuery` in later phases).
- [x] Shared components: `NumberField` (decimal input mode for mobile keypads),
      `ConfirmDialog` (destructive-action confirmation). Per-feature set-row
      component deferred to Phase 7 where the logging UI defines its exact shape.
- [x] Placeholder screens for every route so navigation works now; each names
      the phase that fills it in.
- [x] App-shell render test (`App.test.tsx`): provider + router mount, seed gate
      resolves, dashboard + bottom nav render (uses `fake-indexeddb/auto` in the
      test setup for the real `db` singleton).

**Cleanup:** removed scaffold `App.css`, `src/assets/`, and all `.gitkeep`
placeholders (folders now hold real files).

**Note:** the set-row shared component from the original checklist is intentionally
built in Phase 7 (Workout Logging) rather than here — its props depend on the
logging interaction (auto-add set, target vs actual weight) defined there.

**Next:** Phase 5 — Weight Tracking feature (log/edit/delete, 7-day average,
trend chart).

---

## Phase 5 — Weight Tracking Feature (PRD §5)

- [ ] Log Weight screen: default date = today, decimals, pounds, remembers last
      value as a hint but never auto-saves.
- [ ] Weigh-in list: add for another date, edit, delete (with confirm).
- [ ] Trend chart (Recharts): daily points + prominent 7-day average line.
- [ ] Range selector: 30d / 90d / 6m / 1y / All.
- [ ] Show current 7-day average, delta vs 7 days ago, direction label + raw number.
- [ ] **Acceptance (PRD §18 weight):** record in seconds, edit/delete, chart,
      rolling average, up/down vs 7 days ago, no false zeros.

---

## Phase 6 — Workout Templates Feature (PRD §6)

- [ ] Templates screen for Workout A and B.
- [ ] Add / rename / remove(archive) / reorder exercises.
- [ ] Renaming edits the logical exercise, never past workout snapshots.
- [ ] **Acceptance (PRD §18 templates):** have A & B; add/rename/remove/reorder;
      history unchanged after edits.

---

## Phase 7 — Workout Logging Feature (PRD §7, §8, §14)

- [ ] "Start Workout A/B" preview screen ("Based on <date>", targets shown).
- [ ] Active workout screen: per exercise show target prominently; set rows with
      weight + reps.
- [ ] Auto-add next set after saving, pre-filled 12 reps + current/last weight.
- [ ] Edit / delete any set; "Done with Exercise"; "Complete Workout".
- [ ] Preserve target vs actual weight per set (needed for progression).
- [ ] On complete: timestamp, evaluate progression per weighted exercise, store
      results, update next targets; leave skipped/incomplete unchanged.
- [ ] **Acceptance (PRD §18 logging + progression):** A uses last A / B uses last
      B; default 12 reps; editable reps/weight; unlimited sets until done;
      edit/delete sets; +5 on success; no increase on miss; never auto-reduce;
      same target until achieved; matches 55→60→60→65; reopen edit does not
      double-apply +5.

---

## Phase 8 — Dashboard / Today (PRD §4)

- [ ] Show today's date; today's weigh-in if recorded; most recent weight.
- [ ] Current 7-day average + change vs 7 days ago; small trend chart.
- [ ] Next suggested workout (opposite of last completed; default A) with option
      to choose either.
- [ ] Quick actions: Log Weight, Start Workout A/B; most recent workout summary.

---

## Phase 9 — History Feature (PRD §12, §13)

- [ ] Workout history list (date, A/B, # exercises completed, short summary).
- [ ] Workout detail (targets, sets, "target retained/advanced"); editable.
- [ ] Exercise history (dates, target, actual weights, reps, achieved?, next target).

---

## Phase 10 — Settings, Backup & PWA (PRD §19)

- [ ] Settings screen: unit display, export JSON, export CSV, import JSON.
- [ ] Configure `vite-plugin-pwa` (manifest, icons, offline app shell).
- [ ] Verify install-to-home-screen and offline use on a phone/emulator.

---

## Phase 11 — Hardening & Edge Cases (PRD §17)

- [ ] Walk every §17 edge case against the running app (see architecture §9 table).
- [ ] Confirm destructive actions require confirmation.
- [ ] Verify data survives a full browser/app restart.
- [ ] Run full test suite; fix gaps in coverage of business rules.

---

## Phase 12 — Definition of Done (PRD §22)

Verify all 13 DoD items end-to-end on a phone:

- [ ] Open on a phone.
- [ ] Record a morning weigh-in.
- [ ] See weight + 7-day trend.
- [ ] Start Workout A or B.
- [ ] Previous same-type workout acts as the template.
- [ ] Suggested target per weighted exercise.
- [ ] Enter weights/reps for as many sets as needed.
- [ ] Every set defaults to 12 reps.
- [ ] Explicitly finish each exercise.
- [ ] Complete the workout.
- [ ] Achieved target advances +5 lb automatically.
- [ ] Unachieved target stays until completed successfully.
- [ ] Review/edit history without corrupting progression state.

---

## Notes

- **Test the rules first.** Phase 2 must be green before UI work — the
  progression and average logic are the product.
- **Never mutate history.** Any feature touching names/templates must go through
  snapshots (architecture §4, §5.1).
- **Keep the repository seam clean.** All Dexie access lives in `data/repositories/`
  so a future cloud-sync adapter (PRD §21) has one place to attach.
