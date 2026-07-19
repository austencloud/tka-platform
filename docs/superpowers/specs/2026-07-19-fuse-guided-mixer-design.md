# Fuse Guided Mixer Design

**Date:** 2026-07-19  
**Status:** Ready for Fable implementation  
**Owner:** Fable  
**Area:** Create module, Fuse tab  
**Supersedes:** The conflicting layout, animation, and tour decisions in [2026-07-10-fuse-facelift-design.md](./2026-07-10-fuse-facelift-design.md). The shared sequence viewer result, independent Blue and Red shuffling, and pure fusion service remain valid.

## Decision

Rebuild Fuse as a guided two-input mixer with one combined output.

The page should make one idea obvious without explanation: choose a Blue path, choose a Red path, then inspect and open the result. The current screen gives equal weight to two source animations and leaves the actual result hidden behind the Fuse button. The new screen puts source selection on the left and a large combined preview on the right. On smaller containers, the same content stacks in source order without changing the DOM.

This is not a visual reskin. It also closes the async races, silent empty states, keyboard interception, weak action contrast, and excessive animation work found in the current implementation.

## Product promise

At every moment, the user can answer four questions:

1. What am I choosing?
2. What will these two choices produce?
3. Why can or cannot I continue?
4. What will the main action do?

The screen should feel active because the combined sequence moves and each shuffle has an immediate visible effect. It should not depend on a modal tour, pulsing button, or decorative motion to create interest.

## Goals

- Teach the workflow in the page itself.
- Show the fused result before opening the sequence viewer.
- Give Blue and Red paths visible identity, notation, pool position, and independent controls.
- Keep the same interaction and reading order at every size.
- Use one steady-state animation canvas instead of two source canvases plus hidden output work.
- Make loading, empty, unavailable, and failure states explicit.
- Keep async results consistent when the length or either source changes quickly.
- Meet WCAG 2.2 AA expectations at 320 CSS pixels and 400 percent zoom.
- Reuse the project controls, drawer, cards, naming, viewer, and fusion service.

## Non-goals

- Do not change the fusion algorithm in `sequence-fuser.ts`.
- Do not add a third input, manual step editing, saving inside Fuse, or a Fuse-specific viewer.
- Do not revive the full-screen tab intro.
- Do not add a numeric progress stepper. Blue and Red may be shuffled in either order, so a linear stepper would communicate a false order.
- Do not create a new generic button, drawer, transport, card, or tempo primitive.
- Do not add global keyboard shortcuts.

## Evidence from the current implementation

The design responds to behavior in these files:

- `FuseLayout.svelte` owns layout, length, both selected sequences, tempo UI, playback, fusion, letter derivation, viewer navigation, and a window-level Space handler.
- `FusePanel.svelte` presents a source as both a live animation and a notation card, which gives the two inputs more visual weight than the result.
- `FuseAnimationPreview.svelte` initializes asynchronous playback without a request generation guard.
- `fuse-shuffle-pool.svelte.ts` silently falls back to every sequence when an exact length has no matches, catches full-data failures without user feedback, and can commit stale async results after the requested length changes.
- `fuse-state.svelte.ts` owns a shared animation clock and two controller registrations, but not the pair whose readiness determines the main action.
- `StandardWorkspaceLayout.svelte` already gives Fuse the full creation panel, so this layout can use the complete available width without changing the Create shell.

The current length selector uses seven custom radio buttons. Every button remains in the tab order, arrow-key behavior is not implemented, and the row cannot fit safely at 320 CSS pixels. The current primary button uses white text over orange. The current gradient ranges from about 2.26:1 to 3.56:1 with white text. Dark `#0b0b0f` text ranges from about 5.52:1 to 8.68:1 on those same stops.

## Experience model

Fuse has three persistent regions:

1. **Blue path** selects the Blue input.
2. **Red path** selects the Red input.
3. **Combined preview** shows the current output and contains playback, tempo, readiness, and the primary action.

Length applies to both sources. It is a page-level input, not a setting belonging to either source. Tempo affects only preview playback and the viewer's initial tempo. Shuffling changes one source while preserving the other.

## Layout

### Wide container, 1100 pixels and above

Inputs occupy about 40 percent of the width and stack on the left. The combined output occupies about 60 percent and remains the largest object on the page.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Fuse two paths                                                            │
│ Set the length. Shuffle either path. The preview shows them together.     │
│ Length [ 8 steps ▾ ]                                                   [?] │
├─────────────────────────────┬──────────────────────────────────────────────┤
│ BLUE PATH          3 of 42  │ COMBINED PREVIEW                             │
│ CCKKCCKK                    │                                              │
│ [inline ChoreoCard]         │       [one large combined animation]         │
│ [Back] [Shuffle Blue]       │                                              │
├─────────────────────────────┤                                              │
│ RED PATH           8 of 42  │ [Play] [60 BPM ▾]                            │
│ IIWWIIWW                    │ Both paths are ready.                         │
│ [inline ChoreoCard]         │ [Fuse and open]                              │
│ [Back] [Shuffle Red]        │                                              │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

Requirements:

- The input column may shrink only until source controls and notation remain readable.
- The preview canvas receives the flexible space.
- The primary action stays inside the output region. It is not a detached floating dock.
- The status line reserves one line below transport controls so loading text does not move the button.

### Medium container, 600 through 1099 pixels

Blue and Red sit side by side above the combined preview. The preview spans the full width below them.

```text
┌──────────────────────────────────────────────────────────┐
│ heading, instruction, length, help                       │
├────────────────────────────┬─────────────────────────────┤
│ Blue path                  │ Red path                    │
│ notation and controls      │ notation and controls       │
├────────────────────────────┴─────────────────────────────┤
│ Combined preview, transport, status, Fuse and open       │
└──────────────────────────────────────────────────────────┘
```

### Narrow container, below 600 pixels

The page becomes one column. Source cards become compact identity rows. Their full notation moves into one shared bottom drawer and mounts only when requested.

```text
┌──────────────────────────────┐
│ Fuse two paths           [?] │
│ Set the length...            │
│ Length [ 8 steps ▾ ]         │
├──────────────────────────────┤
│ BLUE PATH            3 of 42 │
│ CCKKCCKK                     │
│ [View notation]              │
│ [Back] [Shuffle Blue]        │
├──────────────────────────────┤
│ RED PATH             8 of 42 │
│ IIWWIIWW                     │
│ [View notation]              │
│ [Back] [Shuffle Red]         │
├──────────────────────────────┤
│ COMBINED PREVIEW             │
│ [combined animation]         │
│ [Play] [60 BPM ▾]            │
│ Both paths are ready.        │
│ [Fuse and open]              │
└──────────────────────────────┘
```

Requirements:

- No horizontal control strip may be required to use the page.
- Back and Shuffle may wrap as a pair, but each target stays at least 44 by 44 CSS pixels.
- The combined canvas fits inside the content width at 320 CSS pixels.
- Full notation does not mount behind the closed drawer.
- The primary action follows status in the normal document flow. It is not fixed to the viewport.

### Layout mechanics

- Use mobile-first component styles and container queries on `.fuse-workspace`.
- Use `container-type: size` because both width and short landscape height matter.
- Keep the DOM in this order at every breakpoint: header, Blue, Red, combined output.
- Use CSS grid areas that preserve that source order. Do not use `order`, dense packing, or a JavaScript-measured compact branch.
- Give source notation, preview, status, counters, and actions reserved space so loading and swapping do not shift adjacent controls.
- Let the page scroll when height is constrained. Do not clip controls behind `overflow: hidden`.

## Header and guidance

The header is persistent, compact, and sufficient for a first visit.

### Visible copy

- Heading: `Fuse two paths`
- Instruction: `Set the length. Shuffle either path. The preview shows them together.`
- Field label: `Length`
- Select options: `2 steps`, `4 steps`, `8 steps`, `12 steps`, `16 steps`, `24 steps`, `32 steps`
- Help button accessible name: `How Fuse works`

Use a native labeled `<select>` for length. Seven options do not fit a compact custom segmented control, and a select already supplies keyboard, focus, selection, and zoom behavior.

### Help drawer

The existing `HelpButton` opens a `Drawer` with three short sections:

1. **Set the length**  
   Both path pools use the same step count.
2. **Shuffle either path**  
   Back returns to the last path you saw.
3. **Fuse and open**  
   The result opens in the sequence viewer.

The help drawer is always available. It does not appear automatically, persist a dismissed state, or block the first interaction.

## Source cards

Blue and Red share one component and differ only by side-specific data and labels.

Each source card contains:

- A visible `Blue path` or `Red path` heading.
- A display name from `getSequenceDisplayName`, then `simplifyRepeatedWord` where the shared naming path calls for it.
- A stable pool counter such as `3 of 42` using tabular numerals and reserved width.
- Full `ChoreoCard` notation in the wide and medium layouts.
- A `View notation` button in the narrow layout.
- A visible `Back` action.
- A visible `Shuffle Blue` or `Shuffle Red` action.

### Source interaction

- Shuffle changes only its source.
- The other source and the combined preview remain visible while the requested replacement loads.
- During a source shuffle, that source card is `aria-busy="true"`, its Back and Shuffle actions are unavailable, and the main action becomes unavailable.
- Commit the replacement and combined preview together. Never show the new name with the old combined animation.
- Back returns to the previous fully hydrated source without a network request when it remains in history.
- Back is natively disabled when no previous source exists.
- Pool traversal does not repeat until all eligible entries have been visited, except when a new length creates a new pool.
- If a candidate lacks the solo-prop data required for its side, skip it and continue through the eligible pool. If no valid candidate remains, show an explicit empty state.

### Shuffle feedback

After a successful shuffle, use one short border or background emphasis on the changed source and combined output. Use opacity or transform only, finish within 240 milliseconds, and disable it when reduced motion is requested. Do not animate box shadow or run a repeating glow.

## Combined preview

The combined preview is the visual center of the feature.

- Build it from the current Blue solo-prop data and Red solo-prop data with `fuseSequences`.
- Keep one `FuseAnimationPreview` mounted and update its sequence in place.
- Do not crossfade or key-remount the animation canvas.
- Do not render separate live source canvases.
- Do not derive letters merely to display the preview. Letter derivation remains part of the final Fuse action.
- Keep the last valid preview visible while one replacement loads, but label the page status with the pending side and make the primary action unavailable.
- When both replacements load after a length change, commit both sources and the preview as one state transition.

The preview needs a text alternative that summarizes the current selection without announcing every beat. Example:

`Combined preview of Blue path CCKKCCKK and Red path IIWWIIWW, 8 steps at 60 BPM.`

This text updates when a source, length, or tempo changes. Beat changes are never live-announced.

## Playback and tempo

- Reuse `TransportControls` for Play and Pause.
- Reuse `BpmQuickPopover` inside the existing Bits UI popover shell.
- Present the tempo trigger as a labeled rectangular control, not an unlabeled chip.
- Keep tempo between the current supported minimum and maximum.
- Preserve the current persisted tempo behavior.
- Stop the Fuse clock when the document becomes hidden, when the component is destroyed, and before the viewer opens.
- When `prefers-reduced-motion: reduce` is active, start paused. An explicit Play action may start the preview.
- Remove the window-level Space handler. Native controls already support Space and Enter without stealing input from selects, drawers, or buttons.

## Primary action

The button label is `Fuse and open`. Its result is no longer surprising because the combined preview already shows the composition and the label states that another surface opens.

Use the shared `ActionButton` and extend it only where its current API cannot express this action:

- Add a `fuse` color preset.
- Let the component accept `aria-disabled`, `aria-describedby`, and busy text.
- Set the Fuse preset foreground to `#0b0b0f` on the current orange gradient.
- Preserve existing colors through fallback variables so other consumers do not change.

Do not create a `FuseButton` component.

The main action remains focusable when unavailable. Use `aria-disabled="true"`, describe the reason through the visible status line, and suppress activation in the handler. This lets keyboard and screen-reader users discover the final action and its requirement. During the final operation, set `aria-busy="true"`, lock re-entry, and change the label to `Building fused sequence...`.

### Readiness contract

`canFuse` is true only when all conditions hold:

- Blue is fully hydrated and has the required Blue solo-prop data.
- Red is fully hydrated and has the required Red solo-prop data.
- Both sources match the applied length.
- The combined preview was built from those exact source snapshots.
- No length load, source shuffle, or Fuse action is pending.
- No blocking source or preview error is active.

## Status and error copy

Use one reserved status region with `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. It announces meaningful transitions only.

| State | Visible copy | Action state |
| --- | --- | --- |
| Initial or length load | `Loading 8-step paths...` | Unavailable |
| Blue shuffle | `Loading another Blue path...` | Unavailable |
| Red shuffle | `Loading another Red path...` | Unavailable |
| Ready | `Both paths are ready.` | Available |
| Exact-length empty | `No 12-step paths are available. Choose another length.` | Unavailable |
| Catalog failure | `Couldn't load paths. Try again.` | Unavailable, show Retry |
| Candidate failure | `Couldn't load another Blue path. Try again.` | Unavailable, show Retry |
| Preview failure | `Couldn't build the combined preview. Shuffle a path and try again.` | Unavailable |
| Final operation | `Building the fused sequence...` | Busy |
| Derivation failure | `Couldn't identify every fused step. Shuffle a path and try again.` | Returns to ready controls |

Blocking errors use `role="alert"` once when they appear. Do not place live-region semantics on containers whose child text changes every animation frame.

Use the shared error handler for reporting and user feedback. A console message alone is not a handled failure.

### Final Fuse failure policy

Do not open or save a fused sequence when letter derivation throws or leaves any output step without a letter. The current fallback can open a result with a sentinel or incomplete word, and the source comments document that partial results have reached the save path before. Keep the selected pair intact, return controls to their ready state, and show the derivation error above.

## Empty, loading, and retry behavior

- Exact length means exact length. Never fall back to all public sequences while the UI still says a requested length.
- A catalog request failure is not an empty result.
- A candidate hydration failure is not silently accepted as metadata-only input.
- Preserve the card and preview box dimensions during loading.
- Skeletons may occupy the source name and notation area. Controls remain visible so the structure does not disappear.
- Retry repeats the failed request for the current generation only.
- Changing length clears a blocking error and begins a new generation.

## State and async design

`createFuseState` becomes the single source of truth for the pair, preview, shared clock, and operation status. `FuseLayout` should render and route; it should not coordinate concurrent catalog loads.

### Root dependency injection

`FuseTab.svelte` resolves `getBrowseLoader()` once and passes it into `createFuseState({ browseLoader })`. Nested source components consume state through the existing Fuse context. No nested component resolves the loader or another service locator.

### State shape

The factory should expose read-only getters for:

- `requestedLength`
- `appliedLength`
- `bpm`
- `clockRunning`
- `currentStep`
- `blue`
- `red`
- `previewSequence`
- `status`
- `error`
- `isLoadingLength`
- `pendingSide`
- `isFusing`
- `canFuse`

Blue and Red each expose:

- hydrated current sequence
- shuffled eligible IDs or entries
- current deck index
- resolved history
- loading state
- error state
- pool count
- whether Back is available

Public actions:

- `setLength(length)`
- `shuffle("blue" | "red")`
- `previous("blue" | "red")`
- `retry()`
- `setBpm(value)`
- `toggleClock()`
- `startFuse()` or an equivalent guarded snapshot method
- `dispose()`

### Request generations

Use monotonic request generations or abortable requests at both scopes:

- One generation for a length change and its two initial candidates.
- One generation per side for later Shuffle or Retry actions.

Every async completion checks its generation before mutating state. A stale result may warm an existing loader cache, but it may not update source identity, preview, status, error, or readiness.

### Atomic commits

- A length change stages Blue, Red, and preview off-state, then commits all three only when both valid source candidates and their preview are ready.
- A side shuffle stages that side and its new preview, then commits both together.
- The final Fuse action captures one immutable pair snapshot. Viewer navigation uses the fully derived result from that snapshot.
- Rapid length changes cannot produce mixed-length sources.
- Rapid repeated Shuffle activation cannot allow an older request to replace a newer one.

### Factory boundaries

The current `FuseLayout.svelte` and `FusePanel.svelte` each mix four distinct concerns: rendering, interaction, orchestration, and data loading. Split by responsibility:

- `createFuseState`: pair orchestration, derived readiness, shared playback state.
- `createFuseShufflePool`: one side's deck and history, with no presentation work.
- `FuseLayout`: grid and viewer navigation boundary.
- `FuseWorkspaceHeader`: heading, instruction, length, help trigger.
- `FuseSourceCard`: one source's identity, notation, and source actions.
- `FusePreviewStage`: combined preview, transport, status, and primary action.
- `FuseDetailDrawer`: Fuse-specific help or source notation content inside the shared drawer shell.

## Component and primitive plan

### Reuse unchanged

- `TransportControls`
- `BpmQuickPopover`
- Bits UI `Popover`
- `HelpButton`
- `Drawer` or `CreatePanelDrawer`
- `ChoreoCard`
- `PanelButton` for Back and Shuffle
- `getSequenceDisplayName`
- `simplifyRepeatedWord`
- `openSequenceViewer`
- `fuseSequences`
- shared error handler and toast path

### Extend

- `ActionButton.svelte`: add the Fuse color preset and the accessibility or busy props listed above. Do not change existing preset output.

### Create

- `src/lib/features/fuse/components/FuseWorkspaceHeader.svelte`
- `src/lib/features/fuse/components/FuseSourceCard.svelte`
- `src/lib/features/fuse/components/FusePreviewStage.svelte`
- `src/lib/features/fuse/components/FuseDetailDrawer.svelte`

These are feature composition components, not replacements for shared primitives. `BuilderInstructionHeader` is tied to Assemble state and controls, so it is not a safe direct reuse. Its spacing and heading pattern may inform the Fuse header.

### Replace or retire

- Replace `FusePanel.svelte` with `FuseSourceCard.svelte` once all consumers move.
- Remove source-canvas controller registration from `fuse-state.svelte.ts` when only the combined preview owns a controller.
- Remove the JavaScript width measurement and the duplicated compact or desktop action branches from `FuseLayout.svelte`.
- Remove the global Space listener.
- Keep the dormant full-screen Fuse tab intro out of this flow. Clean it up in the same change only if it has no live consumers and the removal stays scoped.

## Animation preview hardening

`FuseAnimationPreview.svelte` must remain safe when the sequence changes quickly:

- Increment an initialization generation for each input sequence.
- Reset loading, error, and initialized state for the active generation.
- Ignore every async completion after a newer generation or component destruction.
- Dispose the controller belonging to the superseded generation.
- Keep the canvas container mounted and update the controller or input in place where the animation API permits.
- Do not use `Crossfade` around the canvas or `ChoreoCard`.
- Use a stable fallback height and visible error text.

## Accessibility contract

### Structure

- One page-level Fuse heading at the correct level for the Create tab shell.
- Blue, Red, and Combined sections use visible headings and `aria-labelledby`.
- The native Length select has a persistent visible label.
- The visual and DOM order match at every breakpoint.
- Drawer triggers name the source, such as `View Blue notation`.
- Closing a help or notation drawer returns focus to its trigger.

### Keyboard

- Native buttons activate with Space and Enter.
- The Length select uses native keyboard interaction.
- Tab order follows header, Blue, Red, combined controls, status relation, and primary action.
- No window-level shortcut prevents default behavior on another control.
- No hidden or offscreen source controls remain tabbable.

### Announcements

- Announce loads, successful replacements, readiness, busy state, and blocking errors.
- Do not announce beat changes or animation frame changes.
- Do not move focus on Shuffle, Back, length changes, or recoverable failures.
- Viewer navigation follows the existing shared viewer focus behavior.

### Visual access

- All pointer targets are at least 44 by 44 CSS pixels.
- Essential text is at least 14 CSS pixels. Supplementary counters are at least 12 CSS pixels.
- Blue and Red are written as text. Color is supporting information only.
- The Fuse action uses dark text on orange and must meet 4.5:1 across every gradient stop.
- Focus-visible treatment remains clear on orange, Blue, Red, and neutral surfaces.
- At 320 CSS pixels and 400 percent zoom, content reflows without two-dimensional scrolling.
- At 200 percent text size, labels and status do not clip.
- Reduced motion starts playback paused and removes nonessential shuffle emphasis.

## Chrome and rendering constraints

The target design uses browser features that current Chrome supports: CSS grid, container queries, `color-mix`, native select controls, `prefers-reduced-motion`, and Bits UI's existing popover and drawer behavior. The main risk is implementation behavior, not feature support.

Chrome verification must cover:

- Accessibility tree names, roles, states, and description relation for the main action.
- Keyboard traversal with every drawer and popover closed, then open.
- No Space interception while Length, tempo, or a drawer control has focus.
- 320 CSS pixel reflow and 400 percent zoom.
- Computed contrast at all Fuse gradient stops in light and dark themes.
- Source order and focus order at each container layout.
- Paint flashing while shuffling and playing.
- No repeated layout or paint from an animated shadow, filter, width, height, top, or left property.
- One live animation canvas in steady state.
- No focus loss when crossing a responsive breakpoint.
- No stale source or preview after rapid length and shuffle actions.

## Performance budget

- One `AnimatorCanvas` in steady state.
- Zero hidden notation canvases on narrow layouts until the drawer opens.
- One shared request for sequence metadata through `PublicSequencesLoader` caching.
- Hydrate only candidates needed for the current pair, plus a small next-candidate prefetch if measurement proves useful.
- Do not pre-render every pool entry.
- Playback must stop while the document is hidden.
- Use transform and opacity for the single shuffle emphasis.
- No keyed remount of the primary canvas during ordinary shuffles.

## Testing plan

### Unit tests

Add focused tests for logic users cannot reliably verify by sight:

1. Exact-length filtering never falls back to another length.
2. A catalog failure is distinguishable from an empty pool.
3. A stale length generation cannot commit either source.
4. A stale side shuffle cannot replace a newer result.
5. A length change commits Blue, Red, and preview atomically.
6. Missing side-specific solo-prop data is skipped.
7. Back returns the previous hydrated entry without loading it again.
8. `canFuse` is false during every pending or error state.
9. Fuse re-entry is locked while derivation is pending.
10. Throwing or partial letter derivation does not open the viewer.
11. Dispose cancels the clock and invalidates pending commits.
12. Reduced-motion initialization leaves playback paused.

Keep the existing `SequenceFuser` and fused-word derivation tests. Do not test CSS positioning or visible copy in unit tests unless a semantic state could silently regress.

### Screenshot coverage

Add a Fuse route to `tests/screenshots/devices.ts` with `.fuse-workspace` as the readiness selector. Capture at least:

- 320 by 568 reflow case
- a modern phone portrait
- tablet portrait
- 1366 by 768 desktop
- 1920 by 1080 desktop
- 2560 by 1305 wide desktop when the local screenshot harness supports it

Capture light and dark themes. Add a reduced-motion case and at least one loading or empty state fixture so reserved space is visible.

### Browser interaction matrix

Run with explicit user permission before interactive Chrome DevTools control:

1. Change Length several times quickly.
2. Shuffle Blue rapidly, then Red rapidly.
3. Open notation, close it, and confirm focus return.
4. Open tempo, edit it by keyboard, and close it.
5. Tab through the complete page at narrow and wide sizes.
6. Activate the unavailable main action and confirm it does nothing while its reason remains readable.
7. Fuse once, confirm the busy lock, and confirm the viewer receives the displayed pair.
8. Hide and restore the tab, then check playback state.

## Acceptance criteria

The redesign is complete only when all of these are true:

- A first-time user can identify the two inputs, combined result, and final action without opening Help.
- The combined result is visible before the viewer opens.
- Exactly one animation canvas runs in the settled page.
- Length is a native labeled select.
- Blue and Red names and labels remain visible without relying on color.
- The same DOM and focus order works at narrow, medium, and wide sizes.
- No control overflows or requires horizontal scrolling at 320 CSS pixels.
- White is not used as the Fuse gradient's foreground.
- Status, empty, retry, preview, and final-operation failures are visible and announced appropriately.
- Exact-length empty data never displays a different length.
- Rapid async interactions cannot commit stale or mixed data.
- The global Space listener is gone.
- Reduced motion starts paused.
- The final action cannot re-enter and cannot open an incomplete derived result.
- Source and preview dimensions remain stable through loading and shuffle.
- Browser verification shows one live canvas, no breakpoint focus loss, correct names and states, and no avoidable paint-heavy animation.
- Scoped tests, lint, style checks, and the implementation's required type checks pass.

## Implementation order

1. Add state tests that reproduce exact-length fallback and stale request commits.
2. Refactor pair loading, request generations, history, and readiness into `createFuseState` and the side pool factory.
3. Harden `FuseAnimationPreview` against stale initialization and reduce it to the combined preview role.
4. Extend `ActionButton` with the scoped Fuse preset and accessibility props.
5. Build the header, source card, output stage, and shared detail drawer from existing primitives.
6. Replace the current layout with the mobile-first container grid.
7. Move final fusion into a guarded snapshot flow and block incomplete derivation.
8. Remove obsolete source animations, breakpoint branches, controller registrations, Crossfades, and the global Space listener.
9. Add screenshot coverage and run scoped automated checks.
10. With user permission, complete interactive Chrome verification at the target sizes and accessibility settings.

## Research references

- [WAI-ARIA radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [WAI-ARIA button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
- [WAI-ARIA keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WCAG labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
- [WCAG pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [WCAG failure F103 for status messages](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103.html)
- [MDN `aria-disabled`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)
- [Chrome DevTools accessibility reference](https://developer.chrome.com/docs/devtools/accessibility/reference)
- [web.dev animation performance guide](https://web.dev/articles/animations-guide)
- [Carbon progress indicator guidance](https://carbondesignsystem.com/components/progress-indicator/usage/)

## Fable handoff boundary

Fable owns implementation against this document. If a primitive or service API differs from the paths above, inspect the current source and preserve the behavioral contract instead of cloning a nearby component. Any change to the page model, combined-preview requirement, exact-length rule, incomplete-derivation policy, or accessible action contract should be brought back to Austen before implementation diverges.
