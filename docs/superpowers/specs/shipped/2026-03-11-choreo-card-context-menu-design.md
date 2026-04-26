# ChoreoCard Context Menu

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Right-click / long-press context menu on the ChoreoCard for quick export visibility toggles

---

## Problem

Export visibility settings (Word, Start, Level, Creator Name, Notes, etc.) are only accessible through the desktop sidebar panel or the Settings > Visibility > Image tab. Users have to leave the preview to change what's shown. The animation canvas already has a right-click context menu for effects and efforts — the ChoreoCard should follow the same pattern.

## Solution

Add a context menu to the ChoreoCard that exposes all export visibility toggles inline. Right-click (desktop) or long-press (touch) opens the menu directly on the preview. Toggles use `keepOpen: true` so users can flip multiple switches without re-opening.

## Menu Structure

```
┌─────────────────────────────┐
│ INCLUDE                     │  header
│ ☑ Word                      │  toggle, keepOpen
│ ☑ Start Position            │  toggle, keepOpen
│ ☐ Difficulty                │  toggle, keepOpen
│ ☑ Step Numbers              │  toggle, keepOpen
│─────────────────────────────│
│ FOOTER                      │  header
│ ☑ Creator Name              │  toggle, keepOpen
│ ☑ Notes                     │  toggle, keepOpen
│ ☑ Birthday                  │  toggle, keepOpen
│─────────────────────────────│
│ COLUMNS  ▸                  │  submenu with Auto, 2, 3, 4, 5, 6
│─────────────────────────────│
│ ☀ Light  /  ☾ Dark          │  theme toggle, keepOpen
│─────────────────────────────│
│ ✎ Edit Notes Text...        │  action, closes menu
│ ⬇ Download Image              │  action, closes menu
└─────────────────────────────┘
```

### Item behaviors

| Item | Type | keepOpen | Notes |
|------|------|----------|-------|
| Word, Start, Difficulty, Step Numbers | Toggle (`checked`) | yes | Reflects current state |
| Creator Name, Notes, Birthday | Toggle (`checked`) | yes | Footer visibility |
| Columns | Submenu parent | — | Opens flyout with checked items (Auto, 2, 3, 4, 5, 6). Mutual exclusion enforced in action callbacks. |
| Light / Dark | Toggle (`checked`) | yes | Theme switch |
| Edit Notes Text... | Action | no | Opens export sidebar with notes text input focused |
| Download Image | Action | no | Triggers image export, closes menu |

### Columns submenu

Columns uses the existing `children` submenu pattern (same as Effects/Efforts on the canvas context menu). Each column option is a `ContextMenuItem` with `checked: true` on the active one. Clicking a column sets it and unchecks the others via the action callback.

```
Columns ▸  ┌──────────┐
           │ ● Auto   │
           │   2      │
           │   3      │
           │   4      │
           │   5      │
           │   6      │
           └──────────┘
```

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts` | Reads state, returns `ContextMenuEntry[]` |
| `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte` | Mounts shared `ContextMenu`, exposes `openContextMenu(x, y)`, re-derives items on state change |

### Modified files

| File | Change |
|------|--------|
| `ChoreoCard.svelte` | Add new prop `onContextMenu?: (x: number, y: number) => void`. Route right-click and long-press to this callback. |
| Parent components (`+page.svelte`, `SequenceViewerDrawerHost.svelte`) | Mount `ChoreoCardContextMenuHost`, pass its `openContextMenu` as the `onContextMenu` prop to ChoreoCard. Pass state managers and callbacks. |

### Reused (no changes)

- `ContextMenu.svelte` — shared component, already supports submenus, `keepOpen`, `checked`
- `context-menu-types.ts` — `ContextMenuEntry`, `ContextMenuItem`, `ContextMenuHeader`, `ContextMenuSeparator`
- `ExportOptionsStateManager` — session-scoped export state
- `ImageCompositionStateManager` — global defaults (Firebase-persisted)

## State flow

### Which state manager to write to

The builder receives both managers and an `isExportMode: boolean` prop. This flag comes from the parent component — `+page.svelte` knows whether the export sidebar is open (`isImageExportActive`), and `SequenceViewerDrawerHost.svelte` knows its export panel state.

- **`isExportMode === true`** (export sidebar visible): read/write `ExportOptionsStateManager`. Changes update the export preview in real time.
- **`isExportMode === false`** (normal viewer): read/write `ImageCompositionStateManager`. Changes persist as the user's global defaults.

### Birthday field routing

`ExportOptionsStateManager` does not have a `showBirthday` field — Birthday lives only on `ImageCompositionStateManager`. The builder always reads/writes Birthday from `ImageCompositionStateManager` regardless of export mode. This is acceptable because birthday is a rarely-toggled personal preference, not a per-export setting.

### Reactivity

The two state managers have different reactivity models:

- **`ImageCompositionStateManager`**: uses observer pattern (`registerObserver` / `unregisterObserver`). The host registers an observer that increments a version counter, triggering `$derived` re-computation.
- **`ExportOptionsStateManager`**: uses Svelte 5 `$state` runes natively. The host's `$derived` block reads its getters directly, which creates automatic Svelte reactivity — no observer needed.

The host uses `$derived.by(() => { ... })` to build menu items. In export mode, it reads `ExportOptionsStateManager` getters (reactive via runes). In normal mode, it reads `ImageCompositionStateManager` via a version-counter dependency (reactive via observer). Either way, the menu items update in real time while the menu stays open.

## Trigger mechanism

Identical to the animation canvas pattern:

- **Desktop:** `oncontextmenu` → `preventDefault()` → `onContextMenu(e.clientX, e.clientY)`
- **Touch/pen:** `pointerdown` starts 500ms timer → `onContextMenu(x, y)` on timeout
- **Cancel:** `pointermove` (>10px), `pointerup`, `pointercancel` clear the timer

### Admin users

The ChoreoCard currently has `oncontextmenu` wired with: `handleContextMenu(e); if (!featureFlagService.isAdmin) handleCellContextMenu(e)`. This means admins get `handleContextMenu` only (the general handler), while non-admins also get the cell context menu.

For this feature: **all users get the new export context menu**. The `onContextMenu` callback fires for all users from the card-level right-click. The existing admin-only cell context menu (`handleCellContextMenu`) continues to fire only for non-admins — that logic is unchanged. The two menus don't conflict because the cell menu targets individual cell clicks, while the export menu targets the card background.

## "Edit Notes Text..." behavior

Clicking this item closes the context menu and opens the export sidebar (if not already open) with the custom notes text input focused. The parent component receives an `onEditNotes` callback from the host, which it handles by opening/scrolling to the notes field in its export panel.

## What this does NOT include

- No changes to `ContextMenu.svelte` (already supports everything needed)
- No removal of the export sidebar (context menu is a quick path, not a replacement)
- No new state managers
- No inline text input inside the menu itself
- No addition of `showBirthday` to `ExportOptionsStateManager` (routes to `ImageCompositionStateManager` always)

## Dependencies

- Shared `ContextMenu.svelte` component
- `ExportOptionsStateManager` and `ImageCompositionStateManager`
- Font Awesome icons (already loaded globally)
