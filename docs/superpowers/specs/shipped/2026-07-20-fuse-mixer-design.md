# Fuse as a Mixer — Design & Implementation Spec

Date: 2026-07-20
Status: approved (brainstorm), implementing via ultracode
Feature area: `src/lib/features/fuse/`

## Vision

Turn the Fuse tab from "shuffle two random paths" into a real mixer: choose where
each hand's path comes from (shuffle, the library, the VTG path collection, or a
custom path you build right there), and optionally derive one hand from the other
via the LOOP transformation family (mirror/flip/rotate/invert/rewind and common
pairs). No tab-hopping, no export/reimport.

## The spine (why this is tractable)

Every new capability reduces to one primitive: **produce one solo path for one
hand and inject it into Fuse.** Today Fuse sources *only* from the random browse
pool (`bluePool`/`redPool` over `FuseBrowseLoader`); there is no
`setSource(side, …)`. Add that one injection API and every picker (library, VTG,
custom) is just a different producer feeding it. Symmetry mode is the same fuse
overlay with the follower computed from the driver instead of shuffled.

## Grounded infrastructure reference (verified 2026-07-20)

Executors: use these; do not re-derive or hand-roll equivalents.

### Fuse state / pool
- `src/lib/features/fuse/state/fuse-state.svelte.ts` — `createFuseState`. Exposes
  `blue`/`red` source states, `requestedLength`/`appliedLength` (FuseLength,
  numeric), `bpm`, `currentStep`, `previewSequence`, `setLength(length, restore?)`,
  `shuffle(side)`, `previous(side)`, `buildFusedSequence()`, `persistSelection(...)`,
  `readPersistedState()`/`PersistedFuseState`.
- `createPreview(blue, red, length)` (~:267) → calls `fuseSequences(blue.blueSoloProp, red.redSoloProp, {maxSteps})`; **tiles to length**. Reuse for injected sources.
- `canFuseNow()` (~:315) requires `source.steps.length === appliedLength` and the side's `soloProp` present.
- `src/lib/features/fuse/state/fuse-shuffle-pool.svelte.ts` — `commit`, `commitPrevious`, `commitRestored(sequence)` (accepts an externally-supplied `SequenceData`, aligns cursor, rebuilds). **This is the injection seam.**
- `FUSE_LENGTHS = [2, 4, 8, 12, 16, 24, 32]` (fuse-state.svelte.ts:31); `FuseLength` numeric union; `isFuseLength`.
- `FuseSide = "blue" | "red"`.

### Fusion + transforms
- `src/lib/features/fuse/services/sequence-fuser.ts` — `fuseSequences(blue, red, {maxSteps, alignmentOffset?})`. **Accepts `HandPathData | SoloPropData` directly** (no SequenceData round-trip needed). `buildMotionFromSoloPropStep(step, color, gridMode)` stamps a solo step with a color.
- Transform primitives — `src/lib/shared/create/services/sequence-transformer.ts`, all take `targetHand: "blue"|"red"|"both"` except color swap:
  - `mirrorSequence(seq, targetHand)` — vertical reflection
  - `flipSequence(seq, targetHand)` — horizontal reflection
  - `rotateSequence(seq, rotationAmount, targetHand)` — `rotationAmount` in 45° eighth-steps: `2`=90°, `4`=180°
  - `invertSequence(seq, targetHand)` — PRO↔ANTI + CW↔CCW
  - `rewindSequence(seq, targetHand)` — time reversal
  - `swapColors(seq)` — blue↔red (both only)
  - `swapMotionColor(motion, targetColor)` (motion-transforms.ts) — single-motion recolor
- LOOP taxonomy (for labels/combos): 6 components ROTATED/MIRRORED/FLIPPED/SWAPPED/INVERTED/REWOUND. Implemented combos allow-list: `IMPLEMENTED_COMBOS` in `src/lib/shared/create/services/loop-type-utils.ts` (every subset of {MIRRORED, ROTATED, SWAPPED, INVERTED}; FLIPPED & REWOUND are singles-only).

### Solo extraction / construction
- `src/lib/shared/foundation/services/sequence-decomposer.ts` — `extractBlueSoloProp(seq)`, `extractRedSoloProp(seq)`, `extractSoloProp(seq, color)` → `SoloPropData`.
- `src/lib/shared/foundation/services/solo-prop-factory.ts` — `createSoloProp(steps, startLocation, startOrientation)`.
- `SoloPropData` model: `src/lib/shared/foundation/domain/models/solo-prop-data.ts`. `SequenceData.blueSoloProp` / `.redSoloProp` are first-class optional fields.

### Source pickers (drop-in)
- **Library:** `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte` — props `open`, `onClose`, `onSelect(seq: SequenceData)`, `requiredBeatCount?`, `title?`, `showSourceToggle?`. Over `createBrowseEngine` + `BrowsePanel`. Reference consumer: `ArrangeTab.svelte:480`. Returns fully-hydrated `SequenceData`. Extract this side's hand via `extractBlueSoloProp`/`extractRedSoloProp`.
- **VTG per-hand path (1D):** no existing 1D picker — build a thin selectable list. Enumerate `buildFlowerAxis()` (`src/lib/shared/shape-matrix/domain/flower-signature.ts`, 56 flowers; filter via `defaultAxisFilter`→28 diamond / `matrix-size-preset` bands). Thumbnails via `loadShapeMatrix()` maps + `renderHeader(paths, hand, px, clubTipDx)` (`src/lib/shared/shape-matrix/services/shape-matrix-render.ts`). On select build the solo with `buildFlowerSequence(archetype, flower, hand, edges)` (`src/lib/features/lab/vtg-lab/services/build-flower-sequence.ts`) — returns a single-hand solo `SequenceData`. Archetype resolver (`pro→iso`/`anti→antispin` from `resolveRotationStyleMatrices("diamond").byTurn.get("0|0")`) is a private ~8-line closure in `shape-matrix-flowers.ts` `build()` — extract it to a shared helper. Flowers are color-agnostic: same `Flower`, `hand` arg paints blue or red. **Per hand there are ~12/28/56 paths, never 144** (144 = pair-grid cells).
- **Overflow host:** `src/lib/shared/ui/components/OverflowMenu.svelte` — generic, prop `items: MenuItem[]` (`{label, icon, action, variant?}`). Use this, NOT `ViewerOverflowMenu` (hardcoded callbacks).

### Mini-assemble (builder core is context/service-free)
- `src/lib/features/assemble-lab/state/assemble-state.svelte.ts` — `createAssembleState({ onDocumentChange? })`. No services, no context.
- `src/lib/features/assemble-lab/components/InteractiveGrid.svelte` — props `{ builderState, onStepCapExceeded? }`; self-wires prop animation; only app singletons.
- Minimal control strip: reuse `BuilderTurnBar`/`BuilderControls` or roll a minimal one (recommended — sheds beat-cap/auth/layout coupling).
- Solo output: `builderStepToSoloPropStep` + start-loc/ori extraction are **trapped inline in `BuilderControls.svelte` (~:79)** — extract to a shared service near `builder-step-converter.ts`; then `createSoloProp(steps, startLocation, startOrientation)`.
- `resolveMotionType(step, gridMode)` is the correct motion-type resolver (not the older `deriveMotionType`).
- The live Assemble surface is `src/lib/features/create/assemble/` importing from `assemble-lab/`. **Do not delete the Assemble tab.** No solo gallery.

### Header / step control
- `src/lib/features/fuse/components/FuseWorkspaceHeader.svelte` — title + native `<select>` step control (~:40-48) + `HelpButton`. `handleLengthChange` → `isFuseLength` → `state.setLength`.
- `SegmentedControl` — `src/lib/shared/3d/components/controls/SegmentedControl.svelte`. Props: `options: Option[]`, `value: T` (T extends string — stringify numbers), `onchange: (v) => void`, `color`, `size` ("sm" trims padding/font, keeps 44px touch). `Option = {value, label, icon?, count?, disabled?}`. **SSR caveat:** SegmentedControl is on the CF-Worker SSR-stub list; FuseTab is already client-only (`return null when !browser`), so it's safe here — do not add ungated SSR usage.

## Architecture

### Modes (top-of-tab)
A `SegmentedControl` at the top of the Fuse workspace, values:
- `shuffle` (default — current behavior, two independent paths)
- `symmetry` (one driver path; the other hand derived via a transform)
Default is `shuffle`. Persist the mode in the existing per-device Fuse state. Room for more modes later; no other modes in this spec.

### Sources (per hand, in the source card's overflow menu)
Each `FuseSourceCard` gets an `OverflowMenu` with: Shuffle (existing) · Pick from library · Pick a VTG path · Build custom. Each non-shuffle action produces a solo path and calls `setSource(side, …)`. A shuffle after an injected source replaces it (normal pool behavior).

### Symmetry mode
Driver side keeps a source (shuffle/pick/build). A transform picker (singles + common pairs) chooses how the follower derives: `follower = recolor(transform(driverSolo))`, fused live via `fuseSequences`. Only the driver has a visible source; the follower card shows the derived result read-only.

## Phase breakdown (each = one implementation plan / executor)

### P0 — Source-injection spine (ENABLER; do first)
Files: `fuse-state.svelte.ts`, `fuse-shuffle-pool.svelte.ts`.
- Add `setSource(side: FuseSide, source: SequenceData, origin: SourceOrigin): Promise<void>` where `SourceOrigin = { kind: "library"|"vtg"|"custom", id?, word?, name?, label? }`.
- Behavior: extract/validate the side's solo (`source.blueSoloProp`/`redSoloProp`, or extract from a two-hand `source`), rebuild the preview via `createPreview` (which tiles to `appliedLength`), commit through `commitRestored`, set `previewSequence`, and persist the source (extend `PersistedFuseState` per-side to carry `origin` so a restore re-hydrates a picked/built source — for `custom`, persist the serialized solo steps; for `library`/`vtg`, persist enough to rebuild).
- A subsequent `shuffle(side)` clears that side's injected origin and returns to pool behavior.
- Acceptance: `state.setSource("blue", seq, {kind:"library",…})` shows the fused preview with blue = the injected path; persists; survives HMR restore; `shuffle("blue")` overrides it.

### P1 — Step-count SegmentedControl (independent; small)
Files: `FuseWorkspaceHeader.svelte`.
- Replace the native `<select>` with `SegmentedControl` over `FUSE_LENGTHS` (stringify/parse). `size="sm"`. Disable during `isLoadingLength || isFusing` (per-option `disabled` or wrapper — SegmentedControl has no whole-control disabled).
- Desktop: all 7 inline. Compact (<600px container): keep it inside the compact controls cluster; if 7 segments overflow, wrap gracefully (segments already keep 44px touch height) — do not regress the compact layout.
- Acceptance: header shows an inline length button row; picking a length calls `setLength`; no layout shift; compact mode still fits.

### P2 — Library source pick (depends P0)
Files: `FuseSourceCard.svelte` (+ overflow), maybe a small `FuseSourceMenu` wrapper.
- Add `OverflowMenu` to each source card with a "Pick from library" item that opens `SequencePickerModal` (`requiredBeatCount = appliedLength`). On `onSelect(seq)`: extract this side's hand (`extractBlue/RedSoloProp`) into a solo, wrap as a `SequenceData` carrying the side's soloProp, call `setSource(side, …, {kind:"library", id, word, name})`.
- Acceptance: pick a library sequence for blue → blue path becomes that sequence's blue hand, fused live; persists.

### P3 — VTG per-hand path pick (depends P0)
Files: new `src/lib/features/fuse/components/FuseVtgPathPicker.svelte` (+ a shared archetype helper extracted from `shape-matrix-flowers.ts`), wire into the source card overflow.
- Build a 1D selectable list of flowers (enumerate `buildFlowerAxis()` filtered to the diamond default; render tiles via `renderHeader(paths, side, px, clubTipDx)` painted in the side's color). On select: `buildFlowerSequence(archetype, flower, side, edges)` → single-hand solo `SequenceData` → `setSource(side, …, {kind:"vtg", label})`.
- Reuse `BaseModal` for the picker shell. Do NOT pull in the page-level SSR-fragile SegmentedControl size control.
- Acceptance: "Pick a VTG path" for red shows red-painted flower tiles; selecting one sets red to that solo path, fused live; persists.

### P4 — Symmetry mode + transform family (depends P0 for driver source; independent UI)
Files: `FuseLayout.svelte` (mode switcher + symmetry wiring), new `src/lib/features/fuse/components/FuseModeBar.svelte`, new `src/lib/features/fuse/components/FuseTransformPicker.svelte`, fuse-state (mode + derive).
- Add the top mode `SegmentedControl` (`shuffle`/`symmetry`), persisted.
- In `symmetry`: pick a driver side (default blue). A transform picker exposes singles (Mirror, Flip, Rotate 90, Rotate 180, Invert, Rewind) + curated common pairs (Rotate+Mirror, Mirror+Invert, Rotate+Invert). Deriving: take the driver's solo, apply the chosen sequence transform(s) with `targetHand` matching, recolor to the follower via `swapMotionColor`, and fuse. Update live when driver or transform changes.
- The follower source card renders the derived result read-only (no shuffle/pick on it while in symmetry).
- Acceptance: symmetry mode + Mirror → red hand mirrors blue live; changing driver re-derives; switching back to shuffle restores independent paths.

### P5 — Mini-assemble custom path (depends P0)
Files: new `src/lib/features/fuse/components/FuseCustomPathModal.svelte`, shared `builderStepToSoloPropStep` extraction (new `src/lib/features/assemble-lab/services/builder-solo-export.ts` or near `builder-step-converter.ts`), wire into source card overflow.
- Modal embeds `createAssembleState` + `InteractiveGrid` + a minimal control strip (turns/orientation/grid/undo/finish). On finish: build `SoloPropStepData[]` via the extracted `builderStepToSoloPropStep` + `resolveMotionType(step, gridMode)`, `createSoloProp(...)`, wrap into a `SequenceData` with the side's soloProp, `setSource(side, …, {kind:"custom"})`.
- The Assemble tab is untouched; this shares its builder core.
- Acceptance: "Build custom" opens a compact builder; finishing sets that side to the built solo path, fused live; persists (custom origin re-hydrates on HMR).

## Non-goals / parked
- Deleting or folding away the Assemble tab (decide later, informed by how mini-assemble feels).
- A solo-sequence gallery/repository.
- LOOP compositional fixed-point validation (not building loops here — overlaying a simultaneous transform, no circularity constraint).
- Combinations beyond the curated symmetry set.

## Verification protocol for executors
- A full `npm run check` is blocked this session (two `check:watch` daemons hold the machine-wide svelte-check slot; resource-budget forbids a third). Do NOT start svelte-check / `npm run check` / `check:fast`.
- Statically verify each diff: re-read it, confirm types line up against the signatures above, confirm no dangling references, grep the diff for the forbidden patterns (`type="checkbox"`, raw `class="chip"` filter buttons, `.word` used raw in display).
- Commit each phase with a scoped pathspec (`git commit -m "<msg>" -- <files>`), never bare. Trailers required:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SumpGLfJphejyk8Wz7BtDE`
