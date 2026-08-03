# Play Arcade — Design

**Date:** 2026-07-12
**Status:** Approved (conversational, per skip-spec-gating)
**Owner:** Fable session w/ Austen

## Problem

The Learn module's Play tab ("Let's Play!") is live in navigation but was never
release-grade. The per-question game logic works; the aggregate layer is broken:

- `QuizSessionManager.submitAnswer()` ignores its argument and scores by coin
  flip (`Math.random() > 0.5`) — the results screen shows a fake score
  (`src/lib/features/learn/quiz/services/quiz-session-manager.ts:362-371`).
- Two unrelated sessions run at once: `QuizTab.svelte` creates one (scored
  randomly, displayed) while `QuizWorkspaceView.svelte` creates another (scored
  correctly, discarded — its `onQuizComplete(results)` lands in a zero-arg
  handler).
- Countdown mode never ends: `QuizTimer` is imported and ref'd but never
  rendered, so `timeRemaining` never decrements.
- `QuizRepoManager` loads placeholder configs nothing consumes.
- The Play subsystem is legacy class-based singletons; the rest of Learn uses
  Svelte 5 runes factories (`state-management` skill pattern).

Goal: release Play as a polished arcade — fix the core, add games, per-game
level progression, personal bests, and a hub that pulls people in.

## Decisions (locked with Austen 2026-07-12)

1. **Scores:** v1 ships per-game personal bests + grades. Global leaderboards
   are phase 2 (schema specced below, not built). This respects the 2026-06-26
   XP-teardown line: game score is the game's own output, not grind reward.
   No XP, no levels-as-currency, no persistent achievement/badge collection,
   no daily/weekly challenges. Per-run flair (confetti on perfect run) is fine.
   Stars/levels below are content progression (which question pools you've
   cleared), not XP.
2. **V1 roster (6):** the four existing games fixed + leveled (Pictograph →
   Letter, Letter → Pictograph, Valid Next Pictograph, Performer → Word) plus
   **Speed Blitz** (rapid-fire letter recognition, escalating pace) and
   **Mandala Match** (pick the word that produced a rendered sequence mandala).
   Phase 2 backlog: Memory Pairs, Sequence Builder Puzzle, leaderboards.
3. **Hub identity: live arcade stage.** Dark stage riding the existing theme
   pipeline. Each game is a large card with a live animated preview — the games
   play themselves on their cards. Per-game accent color, best score + grade,
   star/level progress ring.

## Architecture

New subtree `src/lib/features/learn/play/`:

```
play/
  domain/
    game-registry.ts        — GameDefinition + the 6 registrations
    arcade-types.ts         — ArcadeSessionResult, LevelDefinition, StarThresholds…
    scoring.ts              — pure: points, speed bonus, streak multiplier, S–D grade
    progression.ts          — pure: stars earned, unlock rules
  state/
    arcade-session-state.svelte.ts   — factory + context (state-management skill)
  services/
    play-progress-store.ts  — localStorage-first + Firestore sync (bests/stars/unlocks)
    mandala-question-generator.ts    — Mandala Match questions
  components/
    PlayHub.svelte          — the arcade stage (replaces QuizSelectorView)
    GameCard.svelte         — card + live preview slot + stats ring
    previews/               — per-game lightweight animated previews (SVG/CSS)
    GameShell.svelte        — shared in-game chrome (replaces QuizWorkspaceView)
    ArcadeResults.svelte    — grade reveal, stars, best delta (rebuilt on
                              QuizResultsView bones)
    LevelPicker.svelte      — level ladder for a selected game
  games/
    (ported per-question components; see Porting)
```

### Session engine

`arcade-session-state.svelte.ts` — ONE source of truth. Factory returns runes
state: `phase` (`"hub" | "level-select" | "countdown-in" | "playing" |
"between" | "results"`), question index, per-question records, score, streak,
combo, clock. Explicit finite states, transitions validated (research note:
runes-based FSM, no XState dependency for an app-embedded mini-game — see
Research addendum). Games are question renderers; they report
`QuizAnswerEvent` up, the engine scores it. `QuizSessionManager`,
`QuizRepoManager`, `get-quiz-session-manager.ts`, `get-quiz-repo-manager.ts`
are deleted.

Timer lives in the engine (single `setInterval`-free rAF-or-Date drift-corrected
tick owned by the session factory), rendered as a ring in `GameShell`. Countdown
mode works because the engine owns time, not a never-mounted component.

### Scoring (pure functions, unit-tested)

- Base points per correct answer + speed bonus (answer-time bands) ×
  streak multiplier (caps to keep numbers readable).
- Session grade S/A/B/C/D — same letter language as Train's `ResultsScreen`.
- Per-level star thresholds (1–3 stars) defined in the level, computed by
  `progression.ts`.

### Progression

Per-game level ladder in `game-registry.ts`. A level = question-pool
constraints (e.g. letter subset / difficulty), question count or time limit,
star thresholds. Completing a level unlocks the next. Stars display on hub
cards and level picker. No cross-game meta-currency.

### Persistence

- `play-progress-store.ts` mirrors the `concept-progress-tracker` dual-write
  pattern: localStorage key `tka_play_progress` (guests get full progression),
  Firestore `users/{uid}/playProgress/current` (`setDoc merge`, lastUpdated
  wins) after sign-in.
- Attempts keep flowing through the existing append-only
  `users/{uid}/quizHistory/{attemptId}` via `quiz-history-recorder` — now with
  real scores. Gap detection (`gap-detector`, misconception hints) keeps
  feeding concepts.
- `firestore.rules`: add `playProgress` subcollection rule cloned from
  `learningProgress`. (`quizHistory` rule already exists.)

### Phase 2 spec (not built in v1)

- Leaderboards: `POST /api/play/score` Cloudflare Pages Function —
  `requireFirebaseUser` + `withRateLimit` (new `RL_PLAY_SCORE` binding) +
  server-side score recompute from raw answer log + `getAdminDb()` write to
  `playLeaderboards/{gameId}/entries/{uid}` (best-per-user) + daily snapshot
  doc for rank-change. Rules AND `firestore.indexes.json` entries land in the
  same commit (Arena shipped without either and silently default-denied —
  avoid).
- Memory Pairs, Sequence Builder Puzzle as new registry entries.

## Hub UI — live arcade stage

- `PlayHub`: hero header (title + one-line tagline, real copy per
  writing-style rules), responsive card grid (container queries; 1-col mobile,
  2-col ≥640px container, 3-col wide).
- `GameCard`: fixed-aspect preview stage (reserved box — no layout shift on
  preview mount), title, tagline, per-game accent (`--game-accent` local var
  fed from registry; never redeclares `--theme-*`), best score + grade chip,
  star/level `ProgressRing`, 44px+ hit area, whole card clickable
  (button-styled per clickables-look-like-buttons).
- Live previews: tiny per-game Svelte components, SVG/CSS animation only
  (pictographs crossfading via `Crossfade`, mandala rotating/blooming,
  letter-stream for Blitz, performer silhouette for Performer → Word — no 3D,
  no canvas on the hub). Staggered entrance (`DURATION` tokens +
  `@starting-style` where supported), paused when offscreen
  (IntersectionObserver) and under `prefers-reduced-motion` (static frame).
- Card entrance: staggered rise + fade on hub mount; hover = lift + accent
  glow; active = press scale. All tokens, no raw ms numbers.

## GameShell (shared in-game chrome)

Top bar: back, level label, question progress (`StepProgress` or dots),
score (tabular-nums), streak flame (threshold-gated so the slot is reserved —
`visibility` toggle, no shift), timer ring (countdown levels). Question stage:
`Crossfade` between questions (cheap content, `fill` inside the fixed stage).
Pictograph answer grids use `SelectionHit` + `.tka-seq-cell` ring. Feedback
banner + misconception hint (ported shared components) below, slot reserved.

## ArcadeResults

Grade reveal (scale-in, spring), animated score counter
(`AnimatedScoreCounter` ported), stars earned with staggered pop, best-score
delta line ("New best!" / "Best: N"), misconception summary (ported), actions:
Replay level / Next level / Hub. Confetti via shared `delight-orchestrator` on
new best or 3 stars. `AchievementUnlockOverlay` + `QuizAchievementsBadges` +
`achievement-definitions.ts` are deleted (persistent-achievement surface —
teardown line).

## Games

| Game | Source | Levels (v1) |
|---|---|---|
| Pictograph → Letter | port `PictographToLetterQuiz` | L1 Type 1 letters, L2 all shift letters, L3 full alphabet, L4 countdown blitz variant |
| Letter → Pictograph | port | same ladder as above |
| Valid Next | port `ValidNextPictographQuiz` | L1 4 options, L2 6 options, L3 countdown |
| Performer → Word | port `SequenceToWordQuiz` (3D stage stays) | L1 2-letter words, L2 3-letter, L3 4-letter |
| Speed Blitz | NEW — mechanics pattern-matched on `interactive/positions/SpeedRounds.svelte` (positions-scoped; not directly reusable), pool from `question-generator` | L1 slow ramp, L2 fast ramp, L3 survival (3 misses out) |
| Mandala Match | NEW — renders `SequenceMandala` (shared component), `mandala-question-generator` picks target sequence + word distractors | L1 4 choices simple words, L2 6 choices, L3 similar-word distractors |

Level pool definitions reference letter-type groupings from `@tka/domain`
(`letter-registry` / `letter-types`) rather than hand-rolled constants where a
grouping is needed beyond what `question-generator` already exposes.

Porting = game components keep their internals (question generation via
`QuestionGenerator`, feedback, haptics, gap detection) but: local streak state
removed (engine owns streak), answer events flow to the engine, level
constraints passed in as props.

## What gets deleted

- `quiz-session-manager.ts`, `get-quiz-session-manager.ts`
- `quiz-repo-manager.ts`, `get-quiz-repo-manager.ts`
- `QuizTab.svelte`, `QuizWorkspaceView.svelte`, `QuizSelectorView.svelte`,
  `LessonButton.svelte`, `QuizModeToggle.svelte` (mode is now a level property)
- `AchievementUnlockOverlay.svelte`, `QuizAchievementsBadges.svelte`,
  `PerfectQuizCelebration.svelte` (delight-orchestrator supersedes),
  `achievement-definitions.ts`
- `QuizTimer.svelte` (engine-owned time + ring in GameShell)

`LearnTab.svelte` `"play"` mode renders `PlayHub` (with legacy aliases
`"quiz"`/`"drills"` preserved).

## Reuse evidence (never-hand-roll)

Reused: `PictographRenderer`/`QuizPictographCard` path (already in games),
`SequenceMandala`, `SelectionHit`/`.tka-seq-cell`, `Crossfade`, `ProgressRing`,
`StepProgress`, `FilterChipBase`/`SegmentedControl` (level/mode pickers),
`delight-orchestrator` + `ConfettiBurst`, `AnimatedScoreCounter`,
`MisconceptionHint`/`QuizFeedbackBanner`/`QuizPrompt`/shared quiz kit,
`quiz-history-recorder`, `gap-detector`, haptics service, DURATION tokens,
modal kit (if a quit-confirm is needed). New builds justified: session engine
(replacing broken class), scoring/progression pure modules (none exist),
GameCard/previews (no live-preview card primitive exists), Speed Blitz +
Mandala Match games (new mechanics), `play-progress-store`
(playProgress collection is new; pattern cloned from concept-progress-tracker).

## Testing

- Vitest unit: `scoring.ts` (points, bands, multiplier caps, grade edges),
  `progression.ts` (star thresholds, unlock rules),
  `play-progress-store` merge logic (local vs remote lastUpdated).
- Component test (test-on-fix): one vitest-browser test asserting the engine
  scores a wrong answer as wrong and a right answer as right end-to-end
  through GameShell — the regression class that shipped the coin flip.
- Contract greps before done: no `type="checkbox"`, no raw chip buttons, no
  `--theme-*` declarations in play components, no raw `seq.word` in display
  (Mandala Match answers route through `simplifyRepeatedWord`).

## Research addendum (2026 techniques — verified 2026-07-12, web research pass)

- **State:** runes-based FSM as a discriminated-union `$state` in the session
  factory (`{ phase: "hub" } | { phase: "playing"; … } | …`) with `$derived`
  view state. No FSM library: XState is overkill for an embedded quiz loop
  (community consensus + ~16.7kB vs ~0 cost); no Svelte 5 FSM lib has real
  adoption. Matches the codebase state-management convention exactly.
- **Screen transitions:** same-document View Transitions API reached Baseline
  (Chrome 111+, Safari 18+, Firefox 144, Baseline Oct 2025). Our hub → game →
  results changes are component state, NOT router navigations, so SvelteKit's
  `onNavigate` idiom does not apply — use a small
  `transition(fn) { document.startViewTransition ? startViewTransition(fn) : fn() }`
  wrapper around phase mutations. The API does NOT honor
  `prefers-reduced-motion` automatically — gate explicitly (skip the
  transition under reduced motion).
- **CSS:** container queries, `@starting-style`, and scroll-driven animations
  are all cross-engine Baseline in 2026 — ship unconditionally. Card previews:
  CSS keyframes on `transform`/`opacity` only (compositor-cheap);
  `content-visibility: auto` + `contain-intrinsic-size` on the card grid for
  offscreen render cost; IntersectionObserver toggling
  `animation-play-state: paused` for offscreen preview loops
  (content-visibility stops paint but not animation ticking).
- **Juice:** first-party `svelte/motion` `Spring` class (stable since 5.8, TS
  types complete as of 5.55) for score count-ups / streak numbers — the
  re-targetable-value case Spring is built for; no external motion lib.
  Routine feedback 200–300ms ease-out; a distinct heavier 400ms+ beat reserved
  for big reveals (grade, combo milestone) so it reads as a different tier of
  event. `navigator.vibrate` is Android-only reality (iOS Safari never shipped
  it; the 2026 checkbox hack is already patched) — haptics stay a silent
  progressive enhancement via the existing haptics service, never load-bearing.

## Rollout

1. Engine + hub + 4 ported games + bests/stars/levels + fixes → release Play.
2. Speed Blitz + Mandala Match (same release if wave completes cleanly;
   otherwise fast-follow).
3. Phase 2: leaderboards endpoint + rules + indexes, Memory Pairs, Sequence
   Builder.
