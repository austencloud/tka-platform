# Guide Companion v2 — Editable Guide Sequences

Date: 2026-07-10. Approved by Austen ("go nuts bro").

## Problem

The Level 1 guide reader's right-side companion is minimal: BPM chips at top +
InlineAnimationPlayer. Austen wants (a) saner chrome, (b) copy-for-AI so he can
hand Claude a broken sequence instead of describing it, and (c) the ability to
edit/replace guide sequences from anywhere (signed in, any device) with the
changes persisting for all readers — and a safety net so nothing is ever
permanently lost.

## Decisions (from brainstorm)

- Edits persist and are visible to everyone after refresh — not a sandbox.
- Editable from anywhere while signed in as admin → **Firestore**, not a
  dev-server file endpoint.
- History: every save snapshots the prior state (in-app revert), plus
  "reset to original" (authored code literal remains canonical base).
- All UI composed from existing primitives; NO sequence-viewer chrome
  internals imported (keeps the viewer-shell contract clean — the guide
  companion is not a viewer host).

## Architecture

### Override layer (foundation)

- Firestore collection `guideOverrides/{stripKey}` (stripKey = the existing
  strip keys, e.g. `t1l-kiec`):
  `{ word?, steps: <serialized StepData[]>, updatedAt, updatedBy }`.
- Subcollection `guideOverrides/{stripKey}/revisions/{autoId}`: snapshot of the
  replaced state (including "authored" pseudo-revision = null steps meaning
  canonical) with timestamp. Cap ~20 per strip (client-side prune on save).
- Rules: public **read** (guide is public), **write** restricted to admin
  (same admin gate used elsewhere in rules).
- Client service `guide-overrides.svelte.ts` (in `_data/`):
  - `loadOverrides(): Promise<Map<string, StepData[]>>` — one collection read
    on reader mount; pages consume via context.
  - `saveOverride(key, steps)` — snapshots current → revisions, writes doc.
  - `revertOverride(key)` — pops latest revision back into the doc.
  - `resetOverride(key)` — deletes doc (canonical authored steps show again).
- Page seam: pages already precompute strip steps (e.g. `LOOP_STEPS` through
  `bakeReversals`). They now resolve `override(key) ?? authoredSteps` before
  baking. **Reversal dots stay derived (bakeReversals), never stored.**
- Layout tolerance: pages render steps via `{#each}` rows; an override of a
  different length wraps into the same row structure (rows of 4 for
  Type1LoopsPage). Faithful artboard geometry only guaranteed for same-length
  overrides; acceptable.
- `/print` and `/book` routes apply overrides too (the override IS the guide).

### Chrome fixes

- BPM chips leave the companion top. Replaced by a small "N BPM" button below
  the animator that opens `BpmQuickPopover`
  (`animation-engine/components/controls/BpmQuickPopover.svelte`), wrapped in
  a bits-ui Popover exactly like `PracticeBar.svelte:190`.
- Companion header gains `CopyForAIButton`
  (`shared/foundation/ui/CopyForAIButton.svelte`) with
  `getData = () => header + getClaudeCodeCopier().generatePrompt(sequence)`
  where header = `Guide: Level 1 › <page title> › <strip word>`. Admin-only.

### Editing actions (admin-only action row in companion)

- **Replace**: `SequencePickerModal`
  (`shared/components/sequence-picker/SequencePickerModal.svelte`) → picked
  SequenceData converted to StepData[] → `saveOverride`.
- **Revert / Reset**: buttons wired to the override service (Revert enabled
  when revisions exist; Reset when an override exists).
- **Remix** (P2): composer handoff, same pattern the /q scan host uses for its
  `onRemix` override. Fix in Create, come back, Replace.
- **Transform** (P2): rotate/mirror/color-swap via the underlying transform
  services IF they are decoupled from CreateModuleContext (verify at plan
  time; if coupled, defer).
- **Inline pictograph edit** (P3): embed `OptionPicker` (`hideFilters`,
  `filterPredicate`) in a companion sub-panel: tap a step in a mini strip,
  truncate from there, rebuild step-by-step, save as override.

## Phasing

- **P1**: override layer + rules + page seam + BPM demote + copy-for-AI +
  Replace + Revert/Reset.
- **P2**: Remix handoff + Transform actions.
- **P3**: inline OptionPicker editing.

## Testing

- Unit: override service serialization round-trip (StepData → Firestore JSON →
  StepData), revision cap/prune, revert semantics.
- Contract: guide route imports no viewer chrome internals (extend or mirror
  the existing shell contract test's CHROME_INTERNALS list for the guide dir).
- Manual/CDP: save override → refresh → persists; reset → canonical returns;
  print route reflects override.

## Non-goals

- Editing authored artboard geometry/text through this system (Illustrator
  mode already covers that with its Copy-dump-to-source flow).
- Multi-user editing, conflict resolution (single admin).
- Storing derived reversal flags.
