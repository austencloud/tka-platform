# Fuse Tab Facelift — Design

**Date:** 2026-07-10
**Status:** Approved (Austen: result → viewer drawer; keep + polish shuffle interaction; animation-first mobile)

## Problem

The Fuse tab shipped as a shuffle-to-discover MVP and accreted rot:

- `fuse-assembly-animator.ts` is dead — imported by FuseLayout, never called. Panel DOM refs and the `.fuse-target` element are dead with it.
- The state machine declares 5 phases (`browse/left-selected/both-selected/fusing/result`) but the shuffle flow only ever uses `browse → fusing → result`. `selectLeft/selectRight/deselect*/canFuse/matchLengths` are dead or vestigial.
- `FuseSequenceBrowser` carries a dead Pick/Picked UI (`hideActions=true` always, `onSelect={() => {}}`), and `services/types.ts` declares `FuseOptions` twice.
- The bottom bar hand-rolls a length popover (no outside-click dismissal), a ±5 BPM stepper, and a play button while `BpmQuickPopover` + bits-ui `Popover` (PracticeBar reference impl) exist.
- `FuseResultView` hand-assembles a mini sequence viewer (AnimatorCanvas + ChoreoCard + save/open actions) while the shared viewer drawer (`openSequenceViewer` → SequenceViewerShell) already provides all of it plus export and practice.
- Mobile: panels stack 50/50 vertically; inside each, an `aspect-ratio: 1` animation fights the card grid for space. The 5-control bottom bar has no wrap strategy.

## Decisions (locked with Austen)

1. **Result phase deleted.** On fuse, open the fused sequence in the shared viewer drawer. `FuseResultView.svelte` is removed.
2. **Shuffle-to-discover stays the identity.** No interaction rethink; polish only.
3. **Mobile is animation-first.** Panels stay side by side (blue | red) on phones showing the live animations; the ChoreoCard grid moves behind a per-side expand into the shared `Drawer`.

## Design

### 1. Result → viewer drawer

`handleFuse()` in FuseLayout:

1. Guard: both sides showing a sequence AND left has `blueSoloProp` AND right has `redSoloProp` (drives the CTA's disabled state — older index entries may lack compositional data).
2. `fuseSequences(left.blueSoloProp, right.redSoloProp, { maxSteps: min(left.steps.length, right.steps.length) })`.
3. `deriveLettersForSequence(fused)` (best effort — failures fall back to the unlettered result).
4. `openSequenceViewer(result, { returnPath: "/app/create", returnLabel: "Fuse", initialBpm })`.

Save / export / practice / open-fullscreen all come free from SequenceViewerShell. Closing the drawer lands back on the still-mounted Fuse tab — "build another" is just shuffling again.

### 2. State slimming (`fuse-state.svelte.ts`)

Keep: persisted `bpm`, shared beat clock (`currentStep`, `clockRunning`, start/stop/toggle), controller registry (`registerController`, `setBpm` speed sync), `dispose`.

Delete: `FusePhase`, `leftSequence/rightSequence/fusedSequence`, `matchLengths`, `canFuse`, `selectLeft/selectRight/deselectLeft/deselectRight`, `startFuse/completeFuse`, `setFusedSequence`, `reset`, the `sequenceFuser` DI seam (FuseLayout imports the pure `fuseSequences` function directly, per code-style pure-function-module convention).

`FuseTab.svelte` loses the phase branch — always renders FuseLayout.

### 3. Bottom bar on primitives

- **Length:** bits-ui `Popover.Root/Trigger/Portal/Content` (PracticeBar pattern) containing the 7 length options as 44px radio buttons. Trigger chip ghost-sized to the widest value (no layout shift).
- **BPM:** bits-ui Popover + `BpmQuickPopover` (presets, exact entry, tap tempo). Replaces the ±5 steppers. Display keeps `tabular-nums`.
- **Play/pause:** local circular button stays (no shared transport primitive exists; PracticeBar rolls its own too). Tokens only.
- **Fuse CTA:** brand-gradient button stays, right-most, disabled until both sides fusable.
- **Help:** existing shared `HelpButton` stays.

### 4. Animation-first responsive layout

- `.fuse-layout` measures its own width (`bind:clientWidth`); `compact = width < 700`.
- **Compact:** panels stay side by side (`1fr 1fr` columns). Each panel renders animation + shuffle + a "grid" icon button that opens the shared `Drawer` (`placement="bottom"`) containing that side's ChoreoCard. Card section not rendered inline.
- **Regular:** unchanged structure — card + animation per panel, content columns capped at 500px hugging the center gap. The `@media (min-width: 1000px)` cap converts to the same width-driven prop for consistency.
- Panel sizing fix: animation square sized with `aspect-ratio` inside a `min-height: 0` flex chain so it can never crush the card.

### 5. Browser slimming (`FuseSequenceBrowser`)

Remove `onSelect`, `picked`, `hideActions`, the Pick/Picked buttons and their styles. Keep pool loading, shuffle fn exposure, counter callback, clock kick-off.

### 6. Tour

Stops unchanged (welcome / panels / shuffle / fuse). The fuse stop's bespoke post-fuse result block (`tourFuseCompleted` / `tourFusedWord` / `tour-result` markup) is deleted: tour fuse completes the tour, then runs the normal `handleFuse` → drawer.

### 7. Deletions

- `src/lib/features/fuse/components/FuseResultView.svelte`
- `src/lib/features/fuse/services/fuse-assembly-animator.ts`
- Duplicate `FuseOptions` block in `services/types.ts`

### Untouched

`sequence-fuser.ts` (fuse math), `fuse-context.ts`, tour state machine, FuseTab's error boundary. FuseTab's non-keyed view fade disappears with the result phase.

## Verification

- `npm run check` clean (one full pass at the end).
- Unit contract intact: grep confirms no remaining imports of deleted files.
- Visual: dev-server screenshots at phone (390px), tablet (~768px), laptop widths via Chrome DevTools MCP (read-only) — panels side by side on phone, drawer opens with card, bottom bar doesn't overflow, fuse opens viewer drawer.
