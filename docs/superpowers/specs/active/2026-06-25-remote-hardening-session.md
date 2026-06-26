# Remote Hardening Session — 2026-06-25

**Branch:** `claude/code-hardening-automation-s9q1xp`
**Mode:** autonomous, definitively-verifiable hardening only (no visual/judgment work).
**Gate state after session:** `npm run check` → **0 errors, 4 warnings** (was 13 errors,
all the `@tka/domain`/`@vtg/domain` unbuilt-package artifact — resolved by building
packages). Test suites: **27 failed → 7 failed**; passing tests **3019 → 3186**.

## What this session did

Worked the codebase-quality backlog for changes that can be proven correct without a
human at the screen: stale imports, dead/broken tests, and the pre-vetted real bugs in
`2026-06-19-wave9-flagged-findings.md`. Every fix below has a test or a typecheck gate.

### Landed (committed, each verified)

1. **Test suites were silently dead on Linux (stale PascalCase imports).**
   Seven test/helper files imported `$lib/shared/foundation/domain/models/Letter`
   (PascalCase); the canonical file is `letter.ts`. Case-insensitive dev FS (Mac/Win)
   resolved it; case-sensitive Linux (CI / web sessions) failed the import and the suite
   collected **0 tests**. Corrected to the kebab path production already uses.
   **Proof:** the 5 affected suites went from "failed to resolve / 0 tests" to **80 tests
   passing**. (commit `test: fix stale PascalCase model imports…`)

2. **Multi-device sync handshake was fully broken by a one-word typo.**
   `validateSerializedRoomState` checked `playback.isPlaying`, but the serialized shape is
   a `PlaybackIntent` whose field is `playing`. `typeof undefined !== 'boolean'` always
   threw → every WELCOME / STATE_RESPONSE was rejected → a joining peer never received
   room state. **Proof:** new `SyncMessages.test.ts` asserts the serializer's own output
   passes its own validator (round-trip) — red before, green after. (commit `fix(sync):…`)

3. **LAN-sync sequence-mismatch detection was dead code.**
   `handleStateUpdate` compared `update.sequenceId` against `_playbackState.sequenceId`
   *after* merging the update into that state, so the comparison was always false and the
   mismatch callbacks never fired. Captured the previous id before the merge.
   **Proof:** new regression test verified **red without the fix** (callback fires 0 times)
   and **green with it** (fires once with the new id). (commit `fix(lan-sync):…`)

4. **R2 sequence-thumbnail upload failures were silent to the user.**
   `uploadSequenceThumbnail` caught errors with only `console.error` + rethrow, while its
   three sibling methods route through `handleError()` (which also shows an in-app
   `ErrorHandler` notification). Aligned with the siblings; `handleError` is `: never` so
   the rethrow contract is preserved (typecheck gate). (commit `fix(share):…`)

### Debunked (investigated, NOT a bug — left as-is)

- **village `personality-generator.ts` Box-Muller `u1=0` → "NaN traits"** (wave-9 flagged
  as a real bug). Traced it: with `u1=0`, `z` becomes `±Infinity` (Math.cos never returns
  exactly 0 for representable inputs, so there is no `Inf*0 = NaN` path), and the final
  `Math.max(0, Math.min(1, …))` clamps `±Inf` to exactly 1 or 0. The function never returns
  NaN in practice. The clamp already bounds the output. No change shipped.

## Needs your judgment (the 7 remaining failed suites)

These are real but NOT safe to auto-fix — each needs a decision you own:

- **`tests/unit/3d-hierarchy/performer-rig-transforms.test.ts` (22 failures).** Imports
  `{ Plane, computePropRotation }` from `@austencloud/scene-3d`, but that package
  (v0.1.3) does **not** export them from its public API (only `.` and `./state` subpaths;
  `computePropRotation` lives in `lib/components/props/prop3d-transforms` internally).
  **Fix belongs in the scene-3d package** (add to its `src/index.ts`), then bump the dep
  here. Can't be fixed from this repo without editing node_modules.

- **`tests/unit/animation-engine/canvas-lifecycle-manager.test.ts` (6 failures).** The test
  uses a removed setter-injection API (`setResizer`, `setCanvasInitializer`, …); the class
  was refactored to a single `configure(deps)` method + `dispose(callbacks?)`. The test
  needs a deliberate rewrite against the new contract — doing it blind would just mirror
  the implementation rather than verify intent.

- **`…/render-context-factory.test.ts` (1 failure).** `appendChild … parameter 1 is not of
  type 'Node'` — jsdom can't host the headless canvas/engine. Environment limitation, not a
  product bug; needs a jsdom guard or a real-DOM test runner.

- **`tests/unit/village/VillageOrchestrator.test.ts` (1 failure).** "maintains population
  over many ticks" expects 5, gets 6. Sim involves RNG; this reads as a test-calibration /
  intended-behavior question, not a clear bug.

- The other 2 "failed suites" reported by vitest have **0 failed tests** — teardown noise
  from jsdom missing `indexedDB` and a relative-URL CSV fetch in the full run.

## Not pursued, with rationale

- **Broad RGB→semantic-token sweep.** The specific wave-9 multi-grid scope is already
  refactored to `--multi-grid-accent`; the remaining hex there are canonical TKA hand
  colors (`#3575E2` / `#ED1C24`, domain-exempt) or JS `$derived` theme colors (exempt). A
  wider sweep is a visual refactor with no runtime proof and real parallel-turf drift risk
  — outside the "definitively verifiable" bar for an unattended session. Flagging rather
  than sweeping.

## Environment notes (for the next web session)

- Fresh container needs **`pnpm install --frozen-lockfile`** then **`npm run build:packages`**
  before `npm run check` / tests are meaningful (the 13 "errors" at baseline were entirely
  unbuilt `@tka/domain` / `@vtg/domain`). A SessionStart hook doing both would make web
  sessions green from the first command.
