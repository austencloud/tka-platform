# Concept Lesson Status Tracker

Last updated: 2026-08-21

## Status Legend

| Status      | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| CONFIRMED   | User tested and approved                               |
| REDESIGN    | Built but needs changes per philosophy                 |
| BUILT       | Experience exists, not yet reviewed against philosophy |
| IN PROGRESS | Being actively developed                               |
| NOT STARTED | No experience component exists                         |
| BLOCKED     | Waiting on prerequisite or technical blocker           |

---

## FOUNDATION (1 confirmed / 13 total)

| #   | ID                       | Name                        | Status      | Notes                                                                                                                                                                                                                                                 |
| --- | ------------------------ | --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `grid`                   | The Grid                    | CONFIRMED   | 4-step state machine, merge animation, scroll mode. Interactive SVG with clickable points. Strong.                                                                                                                                                    |
| 2   | `hand-positions`         | Hand Positions              | BUILT       | Redesigned: Discovery phase (drag hands on grid to discover alpha/beta/gamma), Construction Quiz (10 questions, semantic feedback), Speed Rounds (timed classification with streak system). Old info pages + button quiz deleted. Needs user testing. |
| 3   | `hand-motions-intro`     | Hand Motions Overview       | BUILT       | 8 pages with example cycling (rotate/mirror/swap buttons). Needs philosophy audit — does it pass "hands on in 5 seconds"?                                                                                                                             |
| 4   | `dual-shifts-alpha-beta` | Dual-Shifts: Alpha & Beta   | NOT STARTED |                                                                                                                                                                                                                                                       |
| 5   | `gamma-motion`           | Gamma Motions               | NOT STARTED |                                                                                                                                                                                                                                                       |
| 6   | `shifts-type2`           | Type 2: Shifts              | NOT STARTED |                                                                                                                                                                                                                                                       |
| 7   | `cross-shifts-type3`     | Type 3: Cross-Shifts        | NOT STARTED |                                                                                                                                                                                                                                                       |
| 8   | `dash-type4`             | Type 4: Dash                | NOT STARTED |                                                                                                                                                                                                                                                       |
| 9   | `dual-dash-type5`        | Type 5: Dual-Dash           | NOT STARTED |                                                                                                                                                                                                                                                       |
| 10  | `static-type6`           | Type 6: Static              | NOT STARTED |                                                                                                                                                                                                                                                       |
| 11  | `staff-positions`        | Staff Positions             | BUILT       | Quiz-based. Needs philosophy audit.                                                                                                                                                                                                                   |
| 12  | `staff-motions`          | Staff Motions               | BUILT       | Quiz-based. Needs philosophy audit.                                                                                                                                                                                                                   |
| 13  | `negative-space`         | Negative Space & Body Turns | NOT STARTED |                                                                                                                                                                                                                                                       |

## LETTERS (0 confirmed / 8 total)

| #   | ID                          | Name                                  | Status      | Notes                                                       |
| --- | --------------------------- | ------------------------------------- | ----------- | ----------------------------------------------------------- |
| 14  | `letter-codex-intro`        | Letter Codex Overview                 | NOT STARTED |                                                             |
| 15  | `type1-abc-ghi`             | Type 1: ABC & GHI                     | BUILT       | Pages structure exists, quiz works. Needs philosophy audit. |
| 16  | `type1-compound`            | Type 1: DJ, EK, FL                    | NOT STARTED |                                                             |
| 17  | `type1-gamma-compound`      | Type 1: MP, NQ, OR                    | NOT STARTED |                                                             |
| 18  | `type1-stuv`                | Type 1: STUV                          | NOT STARTED |                                                             |
| 19  | `type2-wxyz`                | Type 2: WXYZ, SIGMA-DELTA-THETA-OMEGA | NOT STARTED |                                                             |
| 20  | `type3-cross-shift-letters` | Type 3: Cross-Shift Letters           | NOT STARTED |                                                             |
| 21  | `type456-dash-static`       | Type 4/5/6: PHI PSI LAMBDA            | NOT STARTED |                                                             |

## COMBINATIONS (0 confirmed / 6 total)

| #   | ID                 | Name                    | Status      | Notes                                                                                                                                                                                          |
| --- | ------------------ | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | `words-alpha-beta` | TKA 1: Learning Letters | BUILT       | Uses the canonical 19-card Learning Letters deck, grouped by all six T&D families. Explanatory text still requires Austen's exact approval. See `docs/learn/copy-reviews/words-alpha-beta.md`. |
| 23  | `compound-words`   | Compound Words          | NOT STARTED |                                                                                                                                                                                                |
| 24  | `gamma-words`      | Gamma Words             | NOT STARTED |                                                                                                                                                                                                |
| 25  | `caps-intro`       | LOOPs                   | NOT STARTED | Curriculum now specifies all four reflection axes, grid/axis independence, familiar Mirrored/Flipped names, and direct reflection closure. No lesson experience exists yet.                    |
| 26  | `reversals`        | Reversals               | NOT STARTED |                                                                                                                                                                                                |
| 27  | `advanced-caps`    | Advanced LOOP Examples  | NOT STARTED |                                                                                                                                                                                                |

## ADVANCED (0 confirmed / 1 total)

| #   | ID                    | Name                | Status      | Notes |
| --- | --------------------- | ------------------- | ----------- | ----- |
| 28  | `motion-type-mastery` | Motion Type Mastery | NOT STARTED |       |

---

## Design Decisions

### Positions Redesign (2026-03-08)

**Problem:** 3 info pages (alpha, beta, gamma) followed by 9-question multiple choice. User taps one of three buttons. Passive, hand-holdy, doesn't build real understanding.

**Approved direction:**

1. Kill the info pages. Don't explain alpha/beta/gamma at all.
2. Open with Direct Manipulation Discovery — two draggable hand markers on grid. Placing them at opposite points reveals "Alpha" label. Same point = "Beta." Right angle = "Gamma." User discovers taxonomy by playing.
3. "Place the Hands" construction quiz — "Build a beta position." User places hands on grid. Wrong answers animate what the wrong answer means (semantic feedback).
4. Speed Rounds unlock after passing — swipe-based classification for fluency. Variable celebrations.

**Patterns used:** Direct Manipulation Discovery (#1), Construction Over Recognition (#9), Semantic Feedback (#8), Speed Rounds (#10), Variable Micro-Celebrations (#4)

---

## Philosophy Audit Template

When auditing an existing lesson against the philosophy, check each principle:

- [ ] **Hands on in 5 seconds** — Is the first interaction immediate?
- [ ] **Discovery over instruction** — Does the user discover the concept, or get told?
- [ ] **Mistakes teach** — Do wrong answers show what they mean, or just flash red?
- [ ] **Transformation animations** — Do animations carry conceptual meaning?
- [ ] **Difficulty ramp** — Easy recall → guided challenge → unassisted mastery?
- [ ] **Variable celebrations** — Not every correct answer, bigger at milestones?
- [ ] **Spatial = spatial** — Grid/position/orientation concepts use drag/tap on grid?
- [ ] **One thing at a time** — Never two unfamiliar concepts simultaneously?
