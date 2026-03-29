# LOOP Completion Button & Save Panel Redesign

**Date:** 2026-03-16
**Status:** Design

---

## Problem

1. The Save to Library panel shows a full ChoreoCard preview that duplicates what's already visible in the workspace (on desktop). On mobile the preview is useful since the workspace is hidden by the drawer.

2. The LOOP detection result is only visible inside the ChoreoCard's top-right corner — invisible during sequence creation. Users have no way to discover that their sequence is close to forming a LOOP, and no quick way to auto-complete it.

3. The existing LOOP extension flow (ExtendDrawer) requires navigating to a separate drawer. It's powerful but not discoverable.

---

## Design

### Part 1: LOOP Completion Button

#### Compact Ring Button

A single circular button in the workspace header's top-right zone (replacing the save-to-library button). The button contains a ring divided into 6 colored segments, one per LOOP component:

| Component | Color | Icon (from `loop-constants.ts`) |
|-----------|-------|---------------------------------|
| Rotated | #36c3ff (cyan) | fa-rotate |
| Mirrored | #6F2DA8 (purple) | fa-left-right |
| Flipped | #e91e63 (pink) | fa-up-down |
| Swapped | #26e600 (green) | fa-shuffle |
| Inverted | #eb7d00 (orange) | fa-adjust |
| Rewound | #00bcd4 (cyan) | fa-backward |

Colors and icons are sourced from `LOOP_COMPONENT_MAP` in `loop-constants.ts` — the canonical mapping used by `LOOPIconStrip.svelte`.

#### Component-to-LOOPType Mapping

LOOPTypes are named combinations of the 6 primitive components. `LOOPTypeResolver` already handles bidirectional mapping:

- **Decompose:** `LOOPTypeResolver.parseComponents(loopType)` → `Set<LOOPComponent>` — used to determine which ring segments are "active" for a detected LOOP.
- **Compose:** `LOOPTypeResolver.generateLOOPType(components)` → `LOOPType` — used when the user taps a component to determine which LOOPType to apply.

When `SequenceExtender.analyzeSequence()` returns `availableLOOPOptions` (each a `LOOPOption` with a `loopType`), we decompose each into its component set to determine which individual segments to show as faint. A single available LOOPType like `MIRRORED_SWAPPED` lights up both the Mirrored and Swapped segments as faint.

When the user taps a faint segment, we find the best matching LOOPType from the available options that includes that component. If multiple LOOPTypes include the tapped component, prefer the one with the fewest total components (simplest extension).

#### Segment States

- **Full color** — sequence is already a complete LOOP and this component is part of the detected type. Determined by: `LOOPDetector.detectLOOPType(sequence)` returns a `LOOPDetectionResult` with `loopType: LOOPType | null`. If `loopType` is non-null, `LOOPTypeResolver.parseComponents(loopType)` gives the active component set. If `loopType` is null but `isCircular` is true, the sequence is circular but doesn't match a named pattern — no segments show full color.
- **Faint/dim** (25% opacity) — sequence can be completed into a LOOP using a LOOPType that includes this component. Determined by: `SequenceExtender.analyzeSequence(sequence)` → `availableLOOPOptions`, decomposed into component sets.
- **Gray** (10% opacity) — not achievable from the current sequence state. Components that appear in `unavailableLOOPOptions` only, or don't appear at all.
- **All gray** — sequence has fewer than 2 beats or no start position (no meaningful analysis possible).

**Note on Rewound:** REWOUND is always available for any sequence that has a start position — it's position-independent (just plays backward). It will almost always show as faint. The generation pipeline handles it via `LOOPEndPositionResolver` which returns no position constraint for REWOUND.

#### Popover

Tapping the ring button opens a popover with the 6 LOOP components displayed as labeled icon buttons:

```
┌─────────────────────────────────┐
│  LOOP Components                │
│                                 │
│  [🔄 Rotated]  [↔ Mirrored]   │
│  [↕ Flipped]   [🔀 Swapped]   │
│  [◐ Inverted]  [⏪ Rewound]   │
│                                 │
└─────────────────────────────────┘
```

Each button uses the same color states as the ring segments:
- **Full color** — already satisfied (non-interactive, shows status)
- **Faint color** — available for completion (clickable)
- **Gray** — not possible (disabled, tooltip explains why)

**Clicking a faint (available) button:**

1. Shows a confirmation dialog: "Apply [Component] LOOP? This will add [N] beats."
   - Uses `ConfirmDialog` with `showDontAskAgain={true}`
   - Setting key: `skipLoopConfirmation` in `AppSettings`
   - Matches the existing clear-sequence confirmation pattern
2. On confirm:
   - Determine best LOOPType: find the available LOOPOption whose component set includes the tapped component, preferring fewest total components.
   - Determine `sliceSize`: derived from the `ExtensionAnalysis.extensionType` — `"half_rotation"` → `HALVED`, `"quarter_rotation"` → `QUARTERED`, `"already_complete"` → `HALVED` (default).
   - If directly loopable: call `SequenceExtender.extendSequence(sequence, { loopType, sliceSize })`.
   - If bridge needed: call `SequenceExtender.extendWithBridge(sequence, autoSelectedBridge, loopType, undefined, sliceSize)`. Bridge auto-selected based on constraint weights — no picker UI.
3. Popover closes. Sequence is extended. Undo is available.

#### Undo Atomicity

The LOOP extension must be undoable as a single operation. The current `UndoManager` captures sequence state snapshots. When `extendSequence` or `extendWithBridge` returns the new sequence, it replaces the current sequence in one state update — so a single undo restores the pre-extension state. No batch transaction needed.

#### Reactivity

The ring and popover states update live as the user builds their sequence. Adding a beat might light up new segments. The analysis runs via `SequenceExtender.analyzeSequence()` which is efficient (no network calls, pure position/orientation math).

#### Empty State

When the sequence has fewer than 2 beats (no meaningful LOOP analysis possible), the ring button shows all segments gray. The popover shows a brief message: "Add more beats to see LOOP options."

#### Already a Complete LOOP

If the sequence is already circular with a detected LOOP type, the ring shows the active components in full color. No faint options (the sequence is already complete). The popover displays the LOOP type name as a status label (e.g., "Mirrored Rotated LOOP") using `LOOPTypeResolver.formatForDisplay()`.

#### Positioning

The ring button occupies the same top-right position as the current save-to-library button. Same size (48px touch target). The popover anchors to the button and opens downward, staying within viewport bounds. Both mobile and desktop use the same popover approach for consistency.

---

### Part 2: Save Button Relocation

The save-to-library button moves from the workspace header to the **bottom action bar**.

**Component:** `ButtonPanel.svelte` at `src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte`.

Current layout:
- Left zone: `SequenceActionsButton` (tools menu) + `PropIndicatorButton`
- Center zone: `ExportPanelButton`
- Right zone: `GeneratorHelpButton` (mobile only) + `ClearSequencePanelButton`

The save button is added to the right zone, before the clear button. It uses the existing `SaveToLibraryButton` component (moved from `SequenceDisplay.svelte` header). Appears on both mobile and desktop.

---

### Part 3: Save Panel Cleanup

#### Desktop

- **Remove the ChoreoCard preview entirely.** The workspace is visible right behind the panel.
- Panel becomes a compact confirmation form:
  - Word display (text, not a card)
  - Variation info ("Saving as variation 2 of BΣRYE")
  - Public/private toggle
  - Add Notes (expandable)
  - Cancel / Save buttons
- Prop type shown as a read-only indicator (icon + label, e.g., "Staff" with prop icon) so the user knows what's being stored.

#### Mobile

- **Keep the ChoreoCard preview** since the workspace is hidden by the drawer.
- Add a **column toggle** (chip group: Auto, 2, 3, 4, 5... capped at beat count) so the user can control how the preview card looks. Reuses the same chip group pattern from `ExportImagePanel.svelte`.
- Prop type shown as a read-only indicator below the preview.
- Same confirmation form elements as desktop below the preview.

#### Responsive Detection

Use the existing responsive patterns in the codebase. The `CreatePanelDrawer` already handles desktop (side panel) vs mobile (bottom sheet) layouts. The ChoreoCard preview is conditionally rendered based on whether the layout is mobile:

```svelte
{#if isMobile}
  <!-- ChoreoCard preview + column toggle -->
{/if}
```

The `isMobile` detection uses the same breakpoint as other Create module components (640px or container query equivalent).

#### Column Toggle Details

- Uses the same `allColumnOptions` pattern from `ExportImagePanel`: `[Auto, 2, 3, 4, 5, 6, 7, 8]` filtered to `value <= beatCount`.
- Column selection is local to the save panel (not persisted — separate from export options).
- The selected column count is passed to the shared `ChoreoCard` component (at `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`) via its `columnCount` prop.

#### Prop Type Indicator

- Reads `bluePropType` and `redPropType` from `getSettings()`.
- If both are the same: shows "Staff" (or "Fan", "Club", etc.) with a single icon.
- If different (cat/dog mode): shows "Staff / Fan" with both icons.
- Read-only. No selector. If the user wants to change prop type, they do it in Settings before saving.

---

## Data Flow

### LOOP Completion

```
User taps ring button
  → Popover opens
  → Component states derived from:
      1. LOOPDetector.detectLOOPType(sequence)
         → LOOPTypeResolver.parseComponents(result.loopType)
         → Set<LOOPComponent> of active (full color) components
      2. SequenceExtender.analyzeSequence(sequence)
         → availableLOOPOptions: LOOPOption[]
         → Each decomposed via parseComponents() → union of faint components
         → unavailableLOOPOptions → gray components

User taps faint component (e.g., Mirrored)
  → Find best LOOPType: filter availableLOOPOptions to those containing
    MIRRORED, pick the one with fewest components
  → Determine sliceSize from analysis.extensionType
  → ConfirmDialog (unless skipLoopConfirmation is true)
  → On confirm:
      - If directly loopable:
          SequenceExtender.extendSequence(sequence, { loopType, sliceSize })
      - If needs bridge:
          SequenceExtender.extendWithBridge(sequence, autoSelectedBridge, loopType, undefined, sliceSize)
  → Sequence state updates (single snapshot for undo)
  → Ring button re-renders with new states
```

### Save Panel

```
User taps save button (bottom bar)
  → SaveToLibraryPanel opens
  → Desktop: compact form, no preview
  → Mobile: ChoreoCard preview (with columnCount prop) + column toggle + form
  → User configures visibility, notes
  → Save triggers existing LibrarySaveService flow
```

---

## New Settings Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `skipLoopConfirmation` | `boolean` | `false` | Skip confirmation when applying LOOP completion |

Added to `AppSettings` interface. Exposed in PreferencesTab as "Ask before applying LOOP" toggle (inverted display, matching the clear confirmation pattern).

---

## New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LOOPRingButton.svelte` | `create/shared/workspace-panel/shared/components/buttons/` | Compact ring button with 6 colored segments |
| `LOOPCompletionPopover.svelte` | `create/shared/workspace-panel/shared/components/` | Popover with labeled LOOP component buttons + confirmation flow |

---

## Modified Components

| Component | Changes |
|-----------|---------|
| `SequenceDisplay.svelte` | Replace SaveToLibraryButton with LOOPRingButton in header right zone |
| `ButtonPanel.svelte` | Add SaveToLibraryButton to right zone (before clear button) |
| `SaveToLibraryPanel.svelte` | Desktop: remove ChoreoCard preview. Mobile: add column toggle + prop type indicator. Conditional rendering based on layout. |
| `CreateModule.svelte` | Wire LOOP completion flow (analysis, confirmation, extension) |
| `AppSettings.ts` | Add `skipLoopConfirmation` key |
| `PreferencesTab.svelte` | Add "Ask before applying LOOP" toggle |

---

## Edge Cases

1. **Sequence too short** — Ring shows all gray. Popover says "Add more beats to see LOOP options."
2. **No start position** — Same as too short.
3. **Already a complete LOOP** — Active components show full color. No faint options. Popover shows LOOP type name as status.
4. **Multiple LOOPTypes share a component** — When user taps a component that appears in multiple available LOOPTypes (e.g., Mirrored appears in both `MIRRORED` and `MIRRORED_SWAPPED`), prefer the simplest (fewest components). This gives the user the most direct completion.
5. **Bridge auto-selection fails** — If no valid bridge exists for the chosen LOOP type, show a toast error. This shouldn't happen if `availableLOOPOptions` is correct, but handled defensively.
6. **Very long sequences** — LOOP analysis is O(n) on step count. Fast enough for any realistic sequence length.
7. **Undo after LOOP completion** — Single undo restores pre-extension state. The extension replaces the sequence in one state update.
8. **Compound segments** — If a compound LOOPType like `MIRRORED_SWAPPED` is available, both Mirrored and Swapped segments show as faint. Tapping either one triggers the same compound LOOPType.
9. **Circular but no named pattern** — `LOOPDetector` returns `isCircular: true` but `loopType: null` (accidental circularity). No segments show full color. The popover shows "Circular sequence (no LOOP pattern detected)" as status.

---

## Out of Scope

- Changing the LOOP detection algorithm
- Adding new LOOP component types
- Persisting column count from save panel to export options
- Prop type selection in the save panel (read-only only)
- Changes to the sequence viewer's existing save flow
- Modifying the ExtendDrawer (it continues to work as before for users who discover it)
