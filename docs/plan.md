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

## Phase 5 — Weight Tracking Feature (PRD §5)  ✅ COMPLETE (2026-08-31)

**53 tests passing (adds 3 weight-flow tests). Typecheck, lint, build clean.**

- [x] Log Weight screen: default date = today (capped at today), decimals,
      pounds; most recent weight shown as an input *placeholder hint* only —
      never auto-saved (PRD §5.1).
- [x] Weigh-in list: log for any date via the date picker, edit inline, delete
      with a confirm dialog. Backed by `upsertWeight` (one-per-day).
- [x] Trend chart (Recharts): faint daily points + prominent 3px 7-day average
      line (PRD §5.3).
- [x] Range selector: 30d / 90d / 6m / 1y / All (tabs).
- [x] Show current 7-day average, delta vs 7 days ago, and the direction label
      (Trending down/Roughly flat/Trending up) with the raw ± number kept visible.
- [x] Reactive data via Dexie `useLiveQuery` hooks (`useAllWeights`,
      `useWeightSummary`) — list, summary, chart, and dashboard all update live.
- [x] Dashboard weight section wired up (today's weigh-in, most recent, 7-day
      avg + trend, Log Weight / View Trend actions) so there's real data to see.
- [x] **Acceptance (PRD §18 weight):** record in a few seconds ✓, edit/delete ✓,
      chart with daily + average ✓, rolling 7-day average ✓, higher/lower vs 7
      days ago ✓, missing days never create false zeros (domain-tested Phase 2) ✓.

**Tests added (`WeightScreen.test.tsx`):** record today's weight → appears in
list; edit an entry; delete after confirmation. Also tightened the Phase 4
App-shell test to scope nav queries (the dashboard now renders a "Weight" card
title too).

**Deps:** added `@testing-library/user-event` (dev) for interaction tests.

**Note:** production bundle ~755 KB precache (Recharts is large). Acceptable for
a local PWA; can be code-split later if desired (Vite suggested it — deferred as
a non-blocking optimization).

**Next:** Phase 6 — Workout Templates (add/rename/remove/reorder exercises).

---

## Phase 6 — Workout Templates Feature (PRD §6)  ✅ COMPLETE (2026-08-31)

**58 tests passing (adds 5 template-flow tests). Typecheck, lint, build clean.**

- [x] Templates screen with an A / B tab switch (`useTemplate` live-query hook
      joins template-exercise rows to their current logical exercises).
- [x] Add exercise (name + optional target weight; blank target = bodyweight),
      rename (inline, tap the name), remove (confirm dialog; archives the row so
      history is preserved), reorder (thumb-friendly ↑/↓ controls with
      sortOrder re-packing).
- [x] Per-exercise target-weight editing via `setTemplateTargetWeight`.
- [x] Renaming edits the logical exercise only — historical
      `exerciseNameSnapshot` values are untouched (verified by the Phase 3 repo
      test "rename does not rewrite historical snapshots").
- [x] **Acceptance (PRD §18 templates):** Workout A & B exist ✓; add / rename /
      remove / reorder ✓; historical workouts unchanged after edits ✓
      (repo-tested).

**Tests added (`TemplatesScreen.test.tsx`):** shows seeded exercises; add;
rename (old name gone, new name shown); remove after confirm; reorder via
move-down.

**Notes:**
- Reorder uses ↑/↓ buttons rather than drag-and-drop — simpler, more reliable on
  touch, and no extra dependency. Drag-and-drop is a possible later polish.
- Target-weight edits write on every change (debounce-free); fine at this scale.
- Bundle now ~773 KB (225 KB gzip) — Recharts still dominates; unchanged stance
  (code-split later if desired).

**Next:** Phase 7 — Workout Logging (start-from-previous, set entry with
auto-add, complete + progression). This is the biggest UI phase.

---

## Phase 7 — Workout Logging Feature (PRD §7, §8, §14)  ✅ COMPLETE (2026-08-31)

**61 tests passing (adds 3 workout-flow tests). Typecheck, lint, build clean.**

- [x] "Start Workout A/B" preview screen (`StartWorkoutScreen`): shows "Based on
      your last Workout X (date)" or first-time message, lists exercises with
      suggested targets (built from the same `buildSessionFromPrevious` logic),
      Start creates the session and navigates to it.
- [x] Active workout screen (`WorkoutScreen`): per-exercise card with the target
      shown prominently; editable set rows (weight + reps) via the shared
      `SetRow` component (the one deferred from Phase 4).
- [x] "+ Add Set" pre-fills 12 reps and the current/last weight (last set's
      weight, else the target). Sessions also seed one such set on start.
- [x] Edit / delete any set (delete re-packs set numbers); "Done with Exercise"
      toggle; "Complete Workout" with a confirm dialog.
- [x] Target-vs-actual weight preserved per set (`targetWeightSnapshot` on the
      exercise, `weight` on each set) — the distinction the progression algorithm
      needs.
- [x] On complete: `completeSession` stamps completion and runs the tested
      progression engine (evaluate per exercise, store results, advance next
      targets; skipped/incomplete left unchanged), then navigates to history.
- [x] Dashboard "Next workout" wired up (Phase 8 preview): suggests the opposite
      of the last completed type (default A), lets the user pick either, and
      offers to resume an in-progress session.
- [x] **Acceptance (PRD §18 logging + progression):** A/B use last same-type
      session ✓ (Phase 3 `startSession`); default 12 reps ✓; editable reps/weight
      ✓; unlimited sets ✓; edit/delete sets ✓; +5 on success ✓ (UI-tested); no
      increase on miss / never auto-reduce / same target until achieved ✓
      (domain + repo tested); matches 55→60→60→65 ✓; reopen-edit no double +5 ✓
      (repo-tested Phase 3).

**Tests added (`WorkoutScreen.test.tsx`):** renders started session with targets;
Add Set defaults to 12 reps; completing a successful workout advances the
template target to 60 and navigates to history — the full stack through the UI.

**Notes:**
- Set edits write on change (no debounce), consistent with the templates screen.
- The "auto-appear a new set row after saving" idea from PRD §8.1/§14.1 is
  implemented as an explicit "+ Add Set" that pre-fills — clearer and avoids
  stray empty sets affecting progression. The seeded first set means the user
  usually just edits + adds. Can revisit if you want true auto-append.

**Next:** Phase 8 — Dashboard polish (mini trend chart) — mostly done here; then
Phase 9 — History screens.

### Phase 7.1 — Focused workout UX redesign (user request, 2026-08-31)  ✅

Reworked the active-workout UI from a scrollable list of exercise cards to a
**focused, one-exercise-at-a-time flow**:

- [x] Workout screen is now a **list of exercises** (rows: name, target, set
      count, done ✓). Tapping a row opens the focused view.
- [x] `FocusedExercise` view: screen devoted to one exercise — large "Set N"
      indicator, **huge reps field defaulted to 12** as the primary input, weight
      secondary (pre-filled target/last). **Save records the set in place and the
      indicator advances to Set N+1** — no appended rows, no UI shift (the exact
      behavior requested). Recorded sets shown compactly below with tap-to-edit.
- [x] "Done with Exercise" exits the focused view.
- [x] **Settings toggle** (user request): after finishing an exercise, either
      return to the exercise list (`'list'`, default) or advance into the next
      exercise (`'next'`).
- [x] New persistence: `AppSettings` entity + **schema v2** (`settings` table —
      first real migration, exercising the documented pattern), `settingsRepo`,
      `useSettings` live-query hook.
- [x] Settings screen implements the toggle (radio options).
- [x] Removed the obsolete `SetRow` component.
- [x] Tests: rewrote `WorkoutScreen.test.tsx` for the focused flow (list → focus
      → Save advances Set 1→2 in place → Done returns to list → complete advances
      target); added `afterExercise.test.tsx` ('next' advances to the following
      exercise). **63 tests passing.**
- [x] **Fix (user report):** newly-started exercises no longer pre-seed a Set 1,
      so the focused view correctly opens at "Set 1" instead of "Set 2".
      `buildSessionFromPrevious` now seeds zero sets (reps still default to 12 in
      the UI when recording). Updated the builder/repository/screen tests that
      previously assumed one seeded set. Note: only affects sessions started
      after this change; a pre-existing in-progress session keeps its stray set.

### Phase 7.2 — Abandon workout (user request, 2026-08-31)  ✅

Previously the only way out of an in-progress workout was to complete it. Added
the ability to abandon one (PRD §17 — "Workout abandoned before completion"):

- [x] `abandonSession(sessionId)`: deletes the session and all its exercises +
      sets in one transaction. An abandoned workout leaves no history and does not
      touch progression targets.
- [x] "Abandon Workout" button on the workout list view → confirm dialog
      ("discards the workout and everything logged; progression not affected") →
      deletes and navigates home.
- [x] Tests: `abandon.test.ts` (3) — deletes session + children; progression
      targets untouched; completed history untouched. WorkoutScreen UI tests for
      abandon-confirm (navigates home, session gone) and abandon-cancel (stays,
      session intact).
- [x] **Test-isolation hardening:** a global `beforeEach` in `src/test/setup.ts`
      now clears the shared `db` before every test, fixing an intermittent
      cross-file data-bleed flake (component tests all use the same `db`
      singleton; repo tests use isolated dbs and are unaffected). Verified stable
      across repeated full-suite runs. **84 tests passing.**

---

## Phase 8 — Dashboard / Today (PRD §4)

- [ ] Show today's date; today's weigh-in if recorded; most recent weight.
- [ ] Current 7-day average + change vs 7 days ago; small trend chart.
- [ ] Next suggested workout (opposite of last completed; default A) with option
      to choose either.
- [ ] Quick actions: Log Weight, Start Workout A/B; most recent workout summary.

---

## Phase 9 — History Feature (PRD §12, §13)  ✅ COMPLETE (2026-08-31)

**67 tests passing (adds 4 history tests). Typecheck, lint, build clean.**

- [x] Workout history list (`HistoryScreen`): completed sessions most-recent
      first — Workout A/B, # exercises completed, completion date; tap a row →
      detail. Empty state when no history.
- [x] Workout detail (`WorkoutDetailScreen`): per exercise shows target, the
      sets performed, and the progression outcome ("Target advanced X → Y" or
      "Target retained X"); "Skipped" badge for incomplete exercises. **Editable**
      via "Edit workout" → `reopenSession` → logging view; re-completion recomputes
      progression deterministically (no double +5, repo-tested Phase 3). Link to
      each exercise's history.
- [x] Exercise history (`ExerciseHistoryScreen`): for one logical exercise, each
      completed session's date, workout type, target, actual weights × reps, and
      achieved?/next-target.
- [x] Live-query hooks (`useHistory.ts`): `useWorkoutHistory`, `useSessionDetail`,
      `useExerciseHistory`.
- [x] **Acceptance (PRD §12, §13):** history list ✓; detail with targets/sets/
      result ✓; edit past workouts without corrupting progression ✓ (reopen +
      idempotent recompute); exercise history with achieved/next target ✓.

**Tests added (`history.test.tsx`):** lists a completed workout; empty state;
detail shows "Target advanced: 55 → 60"; exercise history lists sessions with
"Achieved → next 60".

**Next:** Phase 10 — Settings, Backup & PWA (export/import JSON+CSV; PWA verify).

### Phase 6.1 — Re-add removed exercises with history (user question, 2026-08-31)  ✅

**Question:** after removing an exercise from a workout, can you add it back later
and keep its historical data? **Before:** history survived, but "Add exercise"
always created a *new* logical exercise (new id), so re-adding started fresh and
the old history stayed orphaned. Fixed:

- [x] `listReaddableExercises(type)`: logical exercises not currently in the
      template (and not archived), each with its **last achieved target** (most
      recent completed session's next target) and a `hasHistory` flag.
- [x] `useReaddableExercises` live-query hook.
- [x] TemplatesScreen "Add existing exercise" picker: lists previously-used
      exercises with "resumes at N lb / bodyweight / no history yet"; tapping
      re-adds via the **same `exerciseId`**, so history + progression reconnect
      and it resumes at the last achieved target. "Add new exercise" form
      unchanged for genuinely new exercises.
- [x] Fixed the misleading "archives the row" comment on
      `removeExerciseFromTemplate` (it deletes only the template slot; the
      logical exercise + snapshots persist).
- [x] Tests: `readd.test.ts` — snapshots retained after removal; offered as
      re-addable at last target (60); re-add reuses id and a new session resumes
      at 60; creating a NEW same-name exercise does NOT reconnect history.
      TemplatesScreen UI test for remove → re-add.

**Fix (user report): re-add defaulted to bodyweight when there was no completed
history.** `listReaddableExercises` only looked at completed sessions, so an
exercise removed before finishing any workout resolved its resume target to
`null`. Fixed by persisting the slot's target onto the logical exercise on
removal:
- [x] Added `Exercise.lastTargetWeight` (**schema v3** — optional non-indexed
      field, no backfill).
- [x] `removeExerciseFromTemplate` now writes the removed slot's `targetWeight`
      to `Exercise.lastTargetWeight`.
- [x] `listReaddableExercises` resolves the resume target as: completed-history
      target if any, else `Exercise.lastTargetWeight` — so a re-add restores the
      prior (or edited) target even with no completed history.
- [x] Picker label updated to always show the resume target.
- [x] Tests added: resumes at seeded target 135 (not bodyweight) when removed
      before completion; preserves an edited target (145) across remove/re-add.

**Fix (user report): duplicate exercises (e.g. two "Deadlift", one bodyweight +
one 135).** Root cause: `addExerciseToTemplate` with a `name` always created a
NEW logical exercise, so typing an existing name made a duplicate. Prior UI/test
flows had created such duplicates in the persisted DB. Fixed both prevention and
cleanup:
- [x] **Prevention:** add-by-name now reuses an existing non-archived exercise
      with a matching name (case/whitespace-insensitive) instead of duplicating.
- [x] **Cleanup:** `mergeDuplicateExercises` consolidates same-name exercises —
      re-points history + template slots to a canonical exercise (prefers the one
      with completed history, else oldest), keeps the best `lastTargetWeight`,
      dedupes template slots, deletes the extras. Runs once on startup (in
      `useSeed`) so existing local data self-heals on next load.
- [x] Tests: `dedup.test.ts` (5) — add-by-name reuses; single Deadlift candidate
      at 135; merge keeps the history-bearing exercise; history re-pointed;
      template views stay unique. Updated the now-obsolete readd test that had
      asserted the old duplicate-creating behavior. **79 tests passing.**

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
