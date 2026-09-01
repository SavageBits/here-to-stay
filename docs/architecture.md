# Health Goals Tracker — Architecture

This document describes the technical architecture for the Health Goals Tracker
MVP defined in [prd.md](./prd.md). It is the reference for how the app is
structured, where each responsibility lives, and how the data flows. The build
checklist lives in [plan.md](./plan.md).

---

## 1. Guiding Principles

Derived directly from the PRD (§19 Technical Characteristics, §2 Design
Principles):

1. **Local-first, single-user.** No accounts, no server, no network required.
   Data lives on the device and survives restarts.
2. **Business logic is UI-free and unit-tested.** Progression and 7-day-average
   math live in pure functions with no React or storage dependencies, so the
   PRD's required test cases (§20) can run headless.
3. **History is immutable by snapshot.** A completed workout stores snapshots of
   exercise names and target weights so later template/name edits never rewrite
   history (PRD §10, §16.3–4).
4. **Progression is derived, not accumulated.** Re-saving a completed workout
   must never double-apply +5 lb (PRD §11, §16.15, §18). We recompute the result
   from the sets, we do not incrementally mutate a running target.
5. **Mobile-first, minimal taps.** Thumb-friendly controls; previous data
   pre-fills the next entry.
6. **Extensible schema.** Future metrics (nutrition, sleep, notes, goal weight)
   are out of MVP scope but the model should not preclude them.

---

## 2. Technology Stack

| Concern            | Choice                                              | Why |
|--------------------|-----------------------------------------------------|-----|
| Language           | TypeScript (strict)                                 | Type safety for the data model and progression rules |
| UI framework       | React 18                                            | Component model, huge ecosystem |
| Build tool / dev   | Vite                                                | Fast startup (PRD §19), simple config |
| Routing            | React Router                                        | Client-side routing for the 3 areas + detail screens |
| Persistence        | IndexedDB via **Dexie.js**                          | Structured local DB, versioned schema/migrations, survives restarts |
| State management    | React Query (`@tanstack/react-query`) + Dexie live queries via `dexie-react-hooks` (`useLiveQuery`) | Reactive reads straight from the DB; no separate global store needed |
| Charts             | Recharts                                            | Simple declarative line charts for the weight trend |
| Dates              | `date-fns`                                          | Calendar-day math for weigh-ins and 7-day windows |
| Testing            | Vitest + React Testing Library                      | Fast, Vite-native; jsdom for component tests |
| PWA                | `vite-plugin-pwa`                                   | Installable, offline, app-like on phone |
| Formatting/Lint    | ESLint + Prettier                                   | Consistency |

**No backend.** If cloud sync is added later (PRD §21), the repository layer
(§5) is the seam where a sync adapter would plug in.

---

## 3. High-Level Structure

```
here-to-stay/
├─ docs/
│  ├─ prd.md
│  ├─ architecture.md
│  └─ plan.md
├─ index.html
├─ vite.config.ts
├─ package.json
├─ src/
│  ├─ main.tsx                 # React entry
│  ├─ App.tsx                  # Router + layout shell
│  ├─ domain/                  # PURE business logic (no React, no Dexie)
│  │  ├─ types.ts              # Shared domain types / enums
│  │  ├─ progression.ts        # Progressive-overload rules (PRD §9)
│  │  ├─ weightStats.ts        # 7-day average + trend (PRD §5.2, §5.3)
│  │  └─ workoutBuilder.ts     # Build next session from previous (PRD §7)
│  ├─ data/                    # Persistence layer
│  │  ├─ db.ts                 # Dexie schema + version migrations
│  │  ├─ repositories/         # One module per aggregate (CRUD + queries)
│  │  │  ├─ weightRepo.ts
│  │  │  ├─ templateRepo.ts
│  │  │  ├─ exerciseRepo.ts
│  │  │  ├─ sessionRepo.ts
│  │  │  └─ backupRepo.ts      # export/import JSON + CSV
│  │  └─ seed.ts               # Default Workout A/B templates on first run
│  ├─ features/                # UI, grouped by product area
│  │  ├─ dashboard/
│  │  ├─ weight/
│  │  ├─ workout/
│  │  ├─ templates/
│  │  ├─ history/
│  │  └─ settings/             # backup/export/import, units
│  ├─ components/              # Shared presentational components
│  ├─ hooks/                   # Shared React hooks (useLiveQuery wrappers)
│  └─ lib/                     # Small helpers (formatting, ids)
└─ tests/                      # Domain unit tests (colocated allowed too)
```

**The dependency rule:** `features/` → `data/` → `domain/`. `domain/` depends on
nothing. UI never contains progression or averaging math; it calls `domain/`.

---

## 4. Domain Layer (pure, testable)

This is the heart of the app and the primary target for the PRD's required tests.
Every function here is pure: same inputs → same outputs, no I/O.

### 4.1 `progression.ts`

Implements PRD §9 and the business rules in §16.

```ts
const PROGRESSION_INCREMENT_LB = 5;
const TARGET_REP_GOAL = 12;

interface SetResult { weight: number | null; reps: number; }

interface ProgressionInput {
  targetWeight: number | null;   // null/0 => bodyweight, no progression
  sets: SetResult[];
  skipped: boolean;
}

interface ProgressionOutcome {
  successful: boolean;
  nextTargetWeight: number | null;
  reason: string;                // human-readable, for history/debug
}

function evaluateProgression(input: ProgressionInput): ProgressionOutcome;
```

Rules (all covered by tests):
- **Skipped** exercise → not successful, target unchanged (§16.13).
- **Bodyweight** (target null/0 and no weight) → no +5 rule (§16.14).
- Successful **only when**: ≥1 set, every completed set reps ≥ 12, every completed
  set weight ≥ target (§9.2). Reps above 12 still count (§9.2).
- Success → `nextTarget = target + 5`. Failure → `nextTarget = target`
  (never reduced — §9.3, §16.10–11).
- **Idempotent by construction:** `nextTargetWeight` is computed from the target
  and the sets, so re-evaluating an unchanged workout yields the same result and
  cannot double-increment (§11, §16.15).

### 4.2 `weightStats.ts`

Implements PRD §5.2 and §5.3.

```ts
function sevenDayAverage(entries: WeightEntry[], onDate: DateISO): number | null;
function trendDelta(entries: WeightEntry[], onDate: DateISO): number | null; // avg today − avg 7d ago
function trendLabel(delta: number | null): 'down' | 'flat' | 'up';           // ±0.25 lb thresholds
function movingAverageSeries(entries: WeightEntry[], range: Range): SeriesPoint[];
```

- Average = arithmetic mean of weigh-ins in `[onDate-6d, onDate]`, using only the
  days that exist — missing days are **excluded, never zero** (§5.2, §16 / §18).
- Fewer than 7 days → average the available entries (§17, §20).
- Thresholds: `≤ −0.25` down, `−0.25..+0.25` flat, `≥ +0.25` up (§5.3). Raw delta
  is always surfaced alongside the label.

### 4.3 `workoutBuilder.ts`

Implements PRD §7 and §8.

```ts
function buildSessionFromPrevious(
  type: 'A' | 'B',
  currentTemplate: TemplateExercise[],   // current names + sort order + target
  previousSession: WorkoutSession | null,
): NewWorkoutSessionDraft;
```

- Copies exercise order, **current** names, and suggested target weight
  (previous session's `nextTargetWeight` where present, else template target).
- Does **not** copy completed reps (§7.4).
- Defaults new sets to 12 reps (§7.5, §8.1).
- No previous session → use the current template (§7).

---

## 5. Data Layer

### 5.1 Dexie schema (`db.ts`)

One Dexie database, versioned. Tables mirror the PRD §15 data model:

| Table                     | Key fields / indexes |
|---------------------------|----------------------|
| `weightEntries`           | `id`, unique index on `date` (one primary per day — PRD §15 constraint) |
| `workoutTemplates`        | `id`, index `type` (A \| B) |
| `exercises`               | `id`, `archivedAt` |
| `templateExercises`       | `id`, index `[workoutTemplateId+sortOrder]`, `exerciseId`, `targetWeight` |
| `workoutSessions`         | `id`, index `[workoutType+completedAt]`, `status` |
| `workoutExercises`        | `id`, index `workoutSessionId`, `exerciseId`; carries `exerciseNameSnapshot`, `targetWeightSnapshot`, `completed`, `progressionAchieved`, `nextTargetWeight` |
| `exerciseSets`            | `id`, index `workoutExerciseId`, `setNumber` |

**Snapshots** (`exerciseNameSnapshot`, `targetWeightSnapshot`) are written when a
session is created/completed so history is immune to later renames/template edits
(PRD §10, §16.3–4). IDs are UUIDs (`crypto.randomUUID()`).

### 5.2 Migrations

Every schema change bumps the Dexie version with an upgrade function (PRD §19:
"use migrations/schema versioning"). Version 1 = the tables above. The pattern and
a placeholder version 2 are documented in `db.ts` so future metrics can be added
without data loss.

### 5.3 Repositories

Each repository is the only code that touches Dexie for its aggregate. UI and
hooks call repositories; repositories call `domain/` for calculations. Key
operations:

- **weightRepo** — upsert-by-date (enforces one-per-day), edit, delete, list-in-range.
- **templateRepo** — CRUD template exercises: add / rename (edits `Exercise.name`,
  not history) / archive / reorder (§6).
- **exerciseRepo** — logical exercises with stable IDs (§10).
- **sessionRepo** — start session (uses `workoutBuilder`), add/edit/delete sets,
  **completeSession** (runs `evaluateProgression` per exercise, writes results and
  `nextTargetWeight`, updates the template's `targetWeight`), reopen/edit, and
  **recomputeSession** used on every save so progression stays deterministic and
  idempotent (§11).
- **backupRepo** — export all tables to JSON and CSV; import from JSON (§19, §21).

### 5.4 Seeding

On first launch (`seed.ts`), create Workout A and Workout B templates. Ship a
sensible default A/B exercise list (e.g. the PRD §6 example) that the user can
freely edit.

---

## 6. UI Layer

Mobile-first, single-column, bottom-friendly primary actions. React Router routes:

| Route                         | Screen (PRD ref) |
|-------------------------------|------------------|
| `/`                           | Dashboard / Today (§4) |
| `/weight`                     | Weigh-in list + Log Weight (§5.1) |
| `/weight/trend`               | Trend chart + ranges 30/90d/6m/1y/All (§5.3) |
| `/workout/start/:type`        | "Start from previous" preview (§7, §14.2) |
| `/workout/:sessionId`         | Active workout logging (§8, §14.1) |
| `/templates`                  | Edit Workout A/B templates (§6) |
| `/history`                    | Completed workouts list (§12) |
| `/history/:sessionId`         | Workout detail (§12) |
| `/exercise/:id/history`       | Exercise history (§13) |
| `/settings`                   | Units, backup/export/import (§19) |

Reads use `useLiveQuery` so the UI reactively reflects DB changes. Writes go
through repositories. Components stay presentational; screen-level containers
orchestrate.

Key UX behaviors from the PRD:
- Dashboard suggests next workout (opposite of last completed; default A) but user
  can pick either (§4).
- After saving a set, a new set row auto-appears pre-filled with 12 reps and the
  current target/last weight (§8.1, §14.1).
- "Done with Exercise" and "Complete Workout" are explicit actions (§8.1, §11).

---

## 7. Cross-Cutting Concerns

- **Units:** pounds default; store raw numbers, support decimals (§5.1). Unit
  setting stored in a small `settings` row for future kg support.
- **IDs & timestamps:** UUID string IDs; ISO `createdAt`/`updatedAt` on every
  record.
- **Dates:** weigh-ins keyed by calendar date (`YYYY-MM-DD`, local). Session
  timestamps are full datetimes.
- **Error handling:** repository operations wrapped so UI can surface failures;
  destructive actions (delete weigh-in/session) confirm first.
- **Backup:** Settings screen exposes JSON (full fidelity) and CSV (weights,
  sets) export, plus JSON import — a safety net given local-only storage (§19).
- **Offline/PWA:** app shell cached; all data local, so it works fully offline.

---

## 8. Testing Strategy

Aligns with PRD §20.

- **Domain unit tests (highest priority):**
  - `progression.ts` — the 55→60→60→65 example verbatim, one set below target,
    one set below 12 reps, all sets above 12, skipped exercise, bodyweight,
    edited-after-completion, and **re-save-unchanged does not re-increment**.
  - `weightStats.ts` — exactly 7 entries, fewer than 7, missing days, edited
    entries, deleted entries; trend thresholds.
  - `workoutBuilder.ts` — first-ever A/B, builds from previous, does not copy
    reps, defaults to 12.
- **Repository tests:** one-weigh-in-per-day constraint; complete→reopen→save
  idempotency at the storage level; snapshots preserved after rename.
- **Component/integration tests (lighter):** logging flow (auto-add set),
  dashboard next-workout suggestion.

CI-friendly: domain and repo tests run headless under Vitest.

---

## 9. Traceability to Edge Cases (PRD §17)

| Edge case | Handled by |
|-----------|-----------|
| Missing weigh-in days, <7 days | `weightStats` excludes missing days |
| Edit/delete prior weigh-in | `weightRepo` + recompute averages on read |
| First-ever A/B | `workoutBuilder` falls back to template |
| Exercise added/removed/renamed | `Exercise` stable id + snapshots in history |
| Workout abandoned | session `status = in_progress`, never evaluated |
| Exercise skipped | `progression` returns unchanged target |
| One-set / varied-weight / reps ≷ 12 | `progression` set-level checks |
| Historical edit | `recomputeSession` deterministic re-evaluation |
| Accidental double-complete | idempotent derived `nextTargetWeight` |
| Zero/blank target (bodyweight) | `progression` bodyweight branch |
```
