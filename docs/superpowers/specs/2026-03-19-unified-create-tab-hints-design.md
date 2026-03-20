# Unified Create Tab Instruction Hints

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Create module — Generate, Construct, Assemble, Fuse tabs

## Problem

Each Create tab places its "what to do next" hint in a different location with different styling:

| Tab | Current Position | Element | Font Treatment |
|-----|-----------------|---------|----------------|
| Generate | Center of workspace (absolute, inset: 0) | `<p class="empty-prompt">` | 14px, dimmed |
| Construct | Top header bar | `<h2 class="start-position-title">` | clamp(1.25-1.75rem), weight 500 |
| Assemble | Top header + redundant bottom bar | `<span class="step-text">` + `<span class="bar-label muted">` | 20px bold (top), 14px dimmed (bottom) |
| Fuse | None | N/A | N/A |

Users switching between tabs have to hunt for where guidance moved.

## Design

### Approach: Top Position + Normalized Styling

All hints render at the top of their workspace/content area, using a shared CSS class for consistent visual treatment.

### Per-Tab Changes

**Generate tab** (`StandardWorkspaceLayout.svelte`)
- Move "Tap Generate to create your sequence" from workspace center to top of workspace content area
- Show only when workspace has no content (existing condition)
- Disappears when a sequence is generated

**Construct tab** (`StartPositionPicker.svelte`)
- Already at top. Normalize from `<h2 class="start-position-title">` to use shared `.workspace-hint` class
- No position change needed
- Still disappears when entire picker is swapped for OptionPicker

**Assemble tab** (`BuilderInstructionHeader.svelte` + `BuilderTurnBar.svelte`)
- Already at top with phase-based evolution. Normalize styling to match shared class
- Remove redundant bottom hint ("Tap a grid point to begin") from BuilderTurnBar idle state
- Phase messages preserved: idle → placing → building → complete
- Secondary hints preserved ("Switch to Blue when ready", "Red needs 2 more steps")

**Fuse tab** (`FuseLayout.svelte`)
- Add "Select two sequences to fuse" above `.fuse-panels`
- Disappears once both left and right sequences are selected

### Shared Styling Contract

All hints use a `.workspace-hint` CSS class:

```css
.workspace-hint {
  flex-shrink: 0;
  text-align: center;
  font-size: clamp(1rem, 2.5vmin, 1.25rem);
  font-weight: 500;
  color: var(--theme-text, #fff);
  padding: clamp(8px, 1.5vmin, 12px) 1rem;
  margin: 0;
  letter-spacing: 0.02em;
}
```

No shared Svelte component — each tab owns its hint markup and conditions. The shared class lives in each component's scoped styles (duplicated intentionally per Svelte scoping philosophy — see styling.md).

### What Stays the Same

- Assemble's phase-based message evolution
- Assemble's secondary contextual hints
- Overall layout structure of each tab
- Mobile behavior and responsive breakpoints
- Desktop/mobile visibility rules for Assemble's header

## Files Modified

1. `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte` — Move Generate hint to top
2. `src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte` — Normalize Construct hint styling
3. `src/lib/features/assemble-lab/components/BuilderInstructionHeader.svelte` — Normalize Assemble hint styling
4. `src/lib/features/assemble-lab/components/BuilderTurnBar.svelte` — Remove redundant bottom hint
5. `src/lib/features/fuse/components/FuseLayout.svelte` — Add Fuse hint

## Out of Scope

- Assemble's mobile hint system (BuilderControls.svelte) — separate responsive implementation
- Help system, tour system, tab intro content
- Any changes to the tool panel or option pickers
