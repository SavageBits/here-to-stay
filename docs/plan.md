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

## Phase 1 — Domain Types & Data Model

- [ ] Define shared domain types in `domain/types.ts` (WorkoutType, DateISO,
      SetResult, enums).
- [ ] Define entity interfaces matching PRD §15: `WeightEntry`, `WorkoutTemplate`,
      `Exercise`, `WorkoutTemplateExercise`, `WorkoutSession`, `WorkoutExercise`,
      `ExerciseSet`.
- [ ] Add `lib/ids.ts` (UUID) and `lib/dates.ts` (calendar-day helpers).

---

## Phase 2 — Pure Business Logic (test-first)

### Progressive Overload (`domain/progression.ts`) — PRD §9, §16, §20

- [ ] Implement `evaluateProgression(input): ProgressionOutcome`.
- [ ] Constants: `TARGET_REP_GOAL = 12`, `PROGRESSION_INCREMENT_LB = 5`.
- [ ] Success rule: ≥1 set, every set reps ≥ 12, every set weight ≥ target.
- [ ] Success → target + 5; failure → target unchanged (never reduced).
- [ ] Skipped → unchanged; bodyweight (null/0 target) → no progression.
- [ ] **Tests (required by PRD §20):**
  - [ ] `55x12 ×4` → next 60.
  - [ ] `60x12, 60x12, 60x10, 55x12` → stays 60.
  - [ ] `60x12 ×4` → next 65.
  - [ ] One set below target weight → no increase.
  - [ ] One set below 12 reps → no increase.
  - [ ] All sets above 12 reps → success.
  - [ ] Exercise skipped → unchanged.
  - [ ] Bodyweight exercise → no +5 rule.
  - [ ] Re-evaluating an unchanged completed workout does **not** re-increment.

### Weight Stats (`domain/weightStats.ts`) — PRD §5.2, §5.3, §20

- [ ] Implement `sevenDayAverage` (mean of existing entries in the 7-day window;
      missing days excluded, never zero).
- [ ] Implement `trendDelta` (avg today − avg 7 days ago) and `trendLabel`
      (±0.25 lb thresholds).
- [ ] Implement `movingAverageSeries` for the chart (per range).
- [ ] **Tests:** exactly 7 entries, fewer than 7, missing days, edited entries,
      deleted entries, trend thresholds (down/flat/up).

### Workout Builder (`domain/workoutBuilder.ts`) — PRD §7, §8

- [ ] Implement `buildSessionFromPrevious` (copy order/current names/target,
      not reps; default 12; fall back to template when no previous).
- [ ] **Tests:** first-ever A/B, builds from previous, reps not copied, default 12.

---

## Phase 3 — Persistence Layer

- [ ] Define Dexie DB + v1 schema in `data/db.ts` (tables & indexes per
      architecture §5.1), including unique index on `weightEntries.date`.
- [ ] Document the migration/versioning pattern with a placeholder v2 upgrade.
- [ ] `data/seed.ts`: create Workout A & B templates with default exercises on
      first run.
- [ ] `weightRepo`: upsert-by-date, edit, delete, list-in-range.
- [ ] `exerciseRepo`: create/rename/archive logical exercises (stable IDs).
- [ ] `templateRepo`: add / rename / archive / reorder template exercises.
- [ ] `sessionRepo`: start (via `workoutBuilder`), add/edit/delete sets,
      `completeSession` (runs progression, writes snapshots + `nextTargetWeight`,
      updates template target), reopen/edit, `recomputeSession` (idempotent).
- [ ] `backupRepo`: export JSON + CSV, import JSON.
- [ ] **Tests:** one-weigh-in-per-day constraint; complete→reopen→save
      idempotency; snapshots survive a rename.

---

## Phase 4 — App Shell & Navigation

- [ ] `App.tsx`: React Router with routes from architecture §6.
- [ ] Mobile-first layout shell (single column, bottom nav or header).
- [ ] Run seed on first launch; wire React Query / `useLiveQuery` provider.
- [ ] Shared components: number/weight input, set row, confirm-delete dialog.

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
