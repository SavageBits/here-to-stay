# Health Goals Tracker — Product Requirements Document

## 1. Product Summary

Build a simple, mobile-friendly personal health tracking app focused on two activities:

1. Tracking daily body weight and its trend over time.
2. Logging two alternating strength workouts (Workout A and Workout B) with automatic progressive-overload suggestions.

The app should make daily logging extremely fast. It is intended for a single user and should prioritize clarity, low friction, and useful trends over social features, gamification, or complex analytics.

---

## 2. Product Goals

### Primary goals

- Make it easy to record a body-weight measurement every morning.
- Show whether body weight is trending up, down, or flat without overemphasizing day-to-day noise.
- Make Workout A / Workout B logging fast enough to use during a workout.
- Reuse the previous version of the same workout as the starting template for the next session.
- Track weights and reps by exercise and set.
- Automatically suggest when to increase exercise weight based on consistent completion of 12 reps per set.
- Preserve the current progression target when a user cannot yet complete all sets at 12 reps.

### Design principles

- Mobile-first.
- Minimal taps and typing.
- Previous data should do as much work as possible.
- Defaults should be useful but always editable.
- Never destroy workout history when a template or exercise name is changed.
- Progression logic should be predictable and easy to understand.

---

## 3. MVP Scope

The MVP has three main areas:

1. **Today / Dashboard**
2. **Weight Tracking**
3. **Workout Tracking**

The architecture should make future health metrics possible, but nutrition, sleep, steps, heart rate, and other health data are out of scope for the MVP.

---

# 4. Dashboard / Today

The home screen should quickly answer:

- Did I weigh in today?
- What is my current 7-day average?
- How is my weight trending?
- What workout is next?
- What was my most recent workout?

## Requirements

Display:

- Today's date.
- Today's weigh-in, if recorded.
- Most recent body weight.
- Current 7-day moving average.
- Change in the 7-day average versus:
  - 7 days ago.
- A small weight trend chart.
- The next suggested workout:
  - A if the most recently completed workout was B.
  - B if the most recently completed workout was A.
  - If there is no workout history, default to Workout A.
- A button to:
  - `Log Weight`
  - `Start Workout A` or `Start Workout B`

The user must still be able to manually choose either workout regardless of the suggestion.

---

# 5. Weight Tracking

## 5.1 Daily weigh-in

The user weighs every morning.

### Requirements

- Allow one primary weigh-in per calendar day.
- Default the date to today.
- Allow the user to add a weigh-in for another date.
- Allow the user to edit or delete an existing weigh-in.
- Weight should support decimal values.
- Default unit: pounds.
- The input should remember the most recent weight as a convenient starting value if helpful, but must not automatically save it.

### Example

```text
Aug 30
164.8 lb
```

---

## 5.2 Seven-day average

The app should calculate a rolling 7-day average.

### Definition

For each date, calculate the arithmetic mean of all recorded weigh-ins from that date and the previous 6 calendar days.

If one or more days in the period are missing, calculate the average using the weigh-ins that do exist rather than treating missing days as zero.

Example:

```text
Day 1: 165.0
Day 2: 164.4
Day 3: 164.8
Day 4: 164.0
Day 5: 164.3
Day 6: 163.9
Day 7: 164.1

7-day average = average of those 7 measurements
```

The app may additionally show calendar-week summaries, but the rolling 7-day average is the primary metric used for trend display.

---

## 5.3 Weight trend

Provide a chart showing:

- Daily weigh-ins.
- 7-day moving average.

Allow common time ranges:

- 30 days
- 90 days
- 6 months
- 1 year
- All

The 7-day average should be visually more prominent than individual daily fluctuations.

Also display:

- Current 7-day average.
- Difference from the 7-day average 7 days earlier.
- Direction:
  - Trending down
  - Roughly flat
  - Trending up

For MVP purposes, the direction label can use a simple threshold such as:

```text
Change <= -0.25 lb: Trending down
Change between -0.25 and +0.25 lb: Roughly flat
Change >= +0.25 lb: Trending up
```

Keep the raw numeric change visible so the label is not the only information available.

---

# 6. Workout Model

The user alternates between two basic workout templates:

- Workout A
- Workout B

Each workout contains an ordered list of exercises.

## Requirements

For each workout template, the user can:

- Add an exercise.
- Edit an exercise name.
- Remove an exercise from future workouts.
- Reorder exercises.
- Preserve historical workout data even if the current template changes.

Example:

```text
Workout A
1. Deadlift
2. Pull-up
3. Dumbbell Incline Press
4. Calf Raise
5. Plank
```

Exercise names are user-defined and editable.

---

# 7. Starting a Workout

When starting Workout A or Workout B:

1. Find the most recent completed workout of the same type.
2. Use that workout as the template for the new session.
3. Copy:
   - Exercise order.
   - Exercise names as represented by the current template.
   - Suggested target weight for each weighted exercise.
4. Do NOT copy completed reps as today's results.
5. Default reps for a newly entered set to `12`.

If there is no previous session of that workout type, use the current Workout A or Workout B template.

The user should be able to edit the workout before or during the session.

---

# 8. Exercise Logging

Each exercise should support a sequence of sets.

For each set, record:

- Weight used, if applicable.
- Reps completed.
- Set number.

## 8.1 Rep entry

Default every new set to:

```text
12 reps
```

The user can edit the rep count before saving the set.

After a set is recorded:

- Automatically prepare another set for the same exercise.
- Pre-fill reps with `12`.
- Pre-fill weight with the current suggested weight or most recently used weight for that exercise in the current session.

Continue this process until the user explicitly chooses:

```text
Done with Exercise
```

There is no fixed number of sets.

The user can edit or delete any set before completing the workout.

---

## 8.2 Weight entry

For weighted exercises:

- Show the suggested target weight prominently.
- Default each new set's weight to that target.
- Allow the user to change the actual weight used for any set.
- Preserve the suggested target separately from the actual weight used.

This distinction is important for the progression algorithm.

For bodyweight or non-weighted exercises, weight may be blank.

---

# 9. Progressive Overload Logic

## 9.1 Goal

When the user successfully performs every set of an exercise for 12 reps at the current target weight, increase the target by 5 lb for the next occurrence of that exercise.

The progression target should remain in place until the user successfully completes it.

---

## 9.2 Definitions

### Target weight

The weight the app is currently asking the user to achieve for an exercise.

### Actual weight

The weight actually used for an individual set.

### Successful exercise session

A weighted exercise session is successful only when:

- At least one set was completed.
- Every completed set has exactly 12 reps or more.
- Every completed set was performed at or above the current target weight.

For the MVP, reps above 12 may count as success, although the UI should default to 12.

---

## 9.3 Progression rule

At the completion of a workout:

### If the exercise was successful

```text
next_target_weight = current_target_weight + 5 lb
```

### If the exercise was not successful

```text
next_target_weight = current_target_weight
```

Do not reduce the target automatically.

The user may use less weight during a difficult session, but the target remains unchanged until achieved.

---

## 9.4 Required example

### Session 1

Dumbbell Incline Press

Current target:

```text
55 lb
```

Sets:

```text
55 x 12
55 x 12
55 x 12
55 x 12
```

Result:

```text
SUCCESS
Next target = 60 lb
```

### Session 2

Suggested target:

```text
60 lb
```

User performs:

```text
60 x 12
60 x 12
60 x 10
55 x 12
```

Result:

```text
NOT SUCCESSFUL
Next target remains 60 lb
```

### Session 3

Suggested target:

```text
60 lb
```

User performs:

```text
60 x 12
60 x 12
60 x 12
60 x 12
```

Result:

```text
SUCCESS
Next target = 65 lb
```

This is a core product rule and should have automated tests.

---

# 10. Exercise Progression State

Progression should be associated with the logical exercise, not merely a text string in an individual workout record.

Each exercise should have a stable internal ID.

Suggested fields:

```text
Exercise
- id
- name
- createdAt
- archivedAt

WorkoutTemplateExercise
- id
- workoutType: A | B
- exerciseId
- sortOrder
- currentTargetWeight
```

If the same logical exercise exists in both Workout A and Workout B, the implementation may either:

1. Share its progression target across both templates, or
2. Treat progression separately per workout template.

For the MVP, prefer **separate progression state per workout template exercise**, because the same exercise may be performed differently in A and B.

Historical workout records must store snapshots so later renaming or template changes do not rewrite history.

---

# 11. Workout Completion

The user should explicitly finish a workout.

On completion:

- Save the completed timestamp.
- Evaluate progression for every weighted exercise.
- Store each exercise's success/failure result.
- Update the next target weight where applicable.
- Leave incomplete or skipped exercises unchanged.
- Make the completed workout available as the previous-workout template for the next session of the same type.

Allow the user to reopen and edit a completed workout.

If edits change whether an exercise qualifies for progression, recalculate progression deterministically.

To avoid progression drift, target history should be derived or versioned carefully rather than repeatedly adding 5 lb every time a completed workout is reopened and saved.

---

# 12. Workout History

Provide a history screen listing completed workouts.

Each row should show:

- Date.
- Workout A or B.
- Number of exercises completed.
- Optional short summary.

Selecting a workout should show:

```text
Workout A — Aug 30

Dumbbell Incline Press
Target: 60 lb
60 x 12
60 x 12
60 x 10
55 x 12
Target retained: 60 lb

Pull-up
12
12
10
```

The user can edit past workouts.

---

# 13. Exercise History

From an exercise, allow the user to view its history.

Display:

- Workout date.
- Target weight.
- Actual weights used.
- Reps by set.
- Whether the progression target was achieved.
- Next target.

A simple trend view of target weight over time is desirable but not required for the first MVP.

---

# 14. Suggested UX

## 14.1 Workout screen

Example:

```text
WORKOUT A
Aug 30

Dumbbell Incline Press
Target: 60 lb

Set 1   [60 lb]   [12 reps]
Set 2   [60 lb]   [12 reps]
Set 3   [60 lb]   [12 reps]
Set 4   [60 lb]   [10 reps]

[ + Add Set ]
[ Done with Exercise ]

Next exercise >
```

After saving a set, a new set row may appear automatically so the user does not need to tap `Add Set` repeatedly.

Important controls should be thumb-friendly on a phone.

---

## 14.2 Starting from previous workout

Example:

```text
Start Workout A

Based on Aug 25 Workout A

Deadlift
Pull-up
Dumbbell Incline Press — target 60 lb
Calf Raise
Plank

[ Start ]
```

---

# 15. Data Model

Exact implementation is up to the developer, but the system should represent at least the following concepts.

## WeightEntry

```text
id
date
weight
createdAt
updatedAt
```

Constraint:

```text
one primary weight entry per date
```

---

## WorkoutTemplate

```text
id
type: A | B
name
createdAt
updatedAt
```

---

## Exercise

```text
id
name
createdAt
updatedAt
archivedAt
```

---

## WorkoutTemplateExercise

```text
id
workoutTemplateId
exerciseId
sortOrder
targetWeight
createdAt
updatedAt
```

---

## WorkoutSession

```text
id
workoutType: A | B
startedAt
completedAt
status: in_progress | completed
createdAt
updatedAt
```

---

## WorkoutExercise

Snapshot of an exercise within a workout session.

```text
id
workoutSessionId
exerciseId
exerciseNameSnapshot
sortOrder
targetWeightSnapshot
completed
progressionAchieved
nextTargetWeight
createdAt
updatedAt
```

---

## ExerciseSet

```text
id
workoutExerciseId
setNumber
weight
reps
createdAt
updatedAt
```

---

# 16. Important Business Rules

1. Weight entries are editable.
2. Workout history is editable.
3. Editing today's template must not alter past workouts.
4. Exercise names can change without changing historical labels.
5. Reps default to 12.
6. Number of sets is unlimited until the user says the exercise is done.
7. Workout A should use the previous Workout A as its reference.
8. Workout B should use the previous Workout B as its reference.
9. Progression is +5 lb only after every completed set meets the rep and target-weight requirement.
10. Missing the target does not lower the target.
11. Using a lower weight does not lower the target.
12. A target remains active until successfully completed.
13. Skipping an exercise does not count as success or failure and does not change its target.
14. Bodyweight/non-weighted exercises do not use the +5 lb progression rule unless a weight is explicitly assigned.
15. All progression calculations should be covered by automated tests.

---

# 17. Edge Cases

Handle the following intentionally:

### Weight

- Missing weigh-in days.
- Editing a prior day's weigh-in.
- Deleting a prior weigh-in.
- Fewer than 7 days of data.
- Multiple decimal places.

### Workouts

- First-ever Workout A.
- First-ever Workout B.
- Exercise added after prior workouts already exist.
- Exercise removed from the current template.
- Exercise renamed.
- Workout abandoned before completion.
- Exercise skipped.
- One-set exercise.
- Exercise with different weights across sets.
- Reps below 12.
- Reps above 12.
- User changes a completed historical workout.
- User accidentally completes a workout twice.
- A target weight of zero or blank for bodyweight work.

---

# 18. Acceptance Criteria

## Weight tracking

- [ ] I can record today's weight in a few seconds.
- [ ] I can edit or delete a weigh-in.
- [ ] I can see individual weigh-ins on a chart.
- [ ] I can see my rolling 7-day average.
- [ ] I can see whether that average is higher or lower than it was 7 days ago.
- [ ] Missing weigh-in days do not create false zero values.

## Workout templates

- [ ] I have Workout A and Workout B.
- [ ] I can add, rename, remove, and reorder exercises.
- [ ] Historical workouts remain unchanged after template edits.

## Workout logging

- [ ] Starting A uses the most recent A as context/template.
- [ ] Starting B uses the most recent B as context/template.
- [ ] Every new set defaults to 12 reps.
- [ ] I can change reps for any set.
- [ ] I can record a weight for each set.
- [ ] I can keep adding sets until I mark the exercise done.
- [ ] I can edit or delete sets.

## Progression

- [ ] If every set is 12+ reps at the target weight, the next target increases by 5 lb.
- [ ] If any set has fewer than 12 reps, the target does not increase.
- [ ] If any set is below the target weight, the target does not increase.
- [ ] The app does not automatically reduce a target.
- [ ] The same target continues to be suggested until achieved.
- [ ] Progression logic behaves exactly like the 55 → 60 → 60 → 65 example in this PRD.
- [ ] Editing a completed workout does not accidentally apply the +5 lb progression more than once.

---

# 19. Recommended MVP Technical Characteristics

These are implementation preferences, not hard product requirements.

- Responsive web app.
- Mobile-first layout.
- Single-user.
- Local-first or simple persistent database.
- Fast startup.
- No authentication required for an initial local/personal version unless the chosen deployment model makes it useful.
- Data should survive browser/app restarts.
- Provide an easy backup/export path, preferably JSON and/or CSV.
- Keep business logic separate from UI so progression calculations can be unit tested.
- Use migrations/schema versioning if a database is used.

If Claude Code is building this from scratch, choose a simple, maintainable stack rather than a highly distributed architecture.

---

# 20. Testing Requirements

At minimum, add unit tests for:

### Seven-day average

- Exactly 7 entries.
- Fewer than 7 entries.
- Missing days.
- Edited entries.
- Deleted entries.

### Progressive overload

```text
Target 55:
55x12, 55x12, 55x12, 55x12
=> next target 60
```

```text
Target 60:
60x12, 60x12, 60x10, 55x12
=> next target remains 60
```

```text
Target 60:
60x12, 60x12, 60x12, 60x12
=> next target 65
```

Also test:

- One set below target weight.
- One set below 12 reps.
- All sets above 12 reps.
- Exercise skipped.
- Bodyweight exercise.
- Historical workout edited after completion.
- Re-saving an unchanged completed workout does not increment the target again.

---

# 21. Future Enhancements

Do not block the MVP on these, but keep the model extensible enough to add them later:

- Goal weight or desired weight range.
- Notes attached to weigh-ins.
- Workout notes.
- Rest timers.
- RPE / reps-in-reserve tracking.
- Exercise-specific progression increments other than 5 lb.
- Different progression rules by exercise.
- Plate or dumbbell increment constraints.
- Workout duration.
- Personal records.
- Volume calculations.
- Exercise charts.
- Steps.
- Sleep.
- Nutrition/macros.
- Body measurements.
- Apple Health integration.
- Import/export.
- Cloud sync.
- Multiple users.

---

# 22. Definition of Done for MVP

The MVP is complete when the user can:

1. Open the app on a phone.
2. Record a morning weigh-in.
3. See the weight and 7-day trend.
4. Start Workout A or Workout B.
5. Have the same-type previous workout act as the starting template.
6. See a suggested target weight for each weighted exercise.
7. Enter weights and reps for as many sets as needed.
8. Default every set to 12 reps.
9. Explicitly finish each exercise.
10. Complete the workout.
11. Have the app automatically advance an achieved target by 5 lb.
12. Have an unachieved target remain unchanged until it is completed successfully.
13. Review and edit weight and workout history without corrupting progression state.
