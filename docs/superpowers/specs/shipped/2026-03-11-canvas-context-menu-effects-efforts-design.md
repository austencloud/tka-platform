# Canvas Context Menu: Effects & Efforts Submenus

**Date:** 2026-03-11
**Status:** Draft

## Problem

The canvas right-click context menu currently shows 4 effect toggles (Fire, Charcoal, LED, Trails) as flat items. The effort preset (Linear, Glide, Dab, etc.) is only accessible through the Canvas Settings modal. Users want quick access to both effects and efforts from the context menu.

## Design

Restructure the flat effect list into two parent items with submenus:

```
Effects  →  None
             Fire         ✓
             Charcoal
             LED
             Trails
Efforts  →  Linear       ✓
             Glide
             Dab
             Press
             Punch
             Elastic
             Bounce
             Anticipation
─────────
Disassemble
Canvas Settings...
```

### Behavior

- **Effects submenu**: Radio-style selection. "None" clears all effects. Checkmark on the active effect. Selecting an effect auto-disables others (existing visibility manager behavior). Menu closes on selection.
- **Efforts submenu**: Radio-style selection. Checkmark on the current effort preset. "Linear" is the default baseline. Menu closes on selection.
- **Disassemble** and **Canvas Settings...** remain at the top level, unchanged.

### Visual Treatment

- **Effects parent item**: Icon `fa-wand-magic-sparkles` (or similar). No iconColor — neutral parent.
- **Efforts parent item**: Icon `fa-gauge` (or similar). No iconColor — neutral parent.
- **Effect children**: Each gets its existing icon and iconColor (Fire = fa-fire-flame-curved/#f97316, Charcoal = fa-fire/#a855f7, LED = fa-lightbulb/#22c55e, Trails = fa-route/neutral).
- **Effort children**: Each gets a circle icon (`fa-circle`) with its domain color from EFFORTS array (e.g., Glide = #34d399, Punch = #f43f5e).
- **"None" item**: Icon `fa-ban`, neutral color.

### `keepOpen` Behavior

All submenu items use `keepOpen: false` (default). Since both effects and efforts are radio-style single selections, the menu closes after choosing. This is a deliberate change from the current flat layout where effects use `keepOpen: true` for toggle-style interaction — submenus are radio-style picks, not multi-toggles.

## Files Changed

| File | Change |
|------|--------|
| `CanvasContextMenuBuilder.ts` | Replace 4 flat effect items with 2 parent items (`Effects`, `Efforts`) each containing `children` arrays. Import `EFFORTS` from effort-types for effort list. |

No other files change. The `ContextMenu` component already supports `children` submenus.

## Dependencies

- `ContextMenuItem.children` — already implemented in context-menu-types.ts
- `AnimationVisibilityStateManager.setEffortPreset()` — already implemented
- `AnimationVisibilityStateManager.getEffortPreset()` — already implemented (via `getSettings().effortPreset`)
- `EFFORTS` array from `effort-types.ts` — already defined with colors

## Edge Cases

- **Active effect detection**: Fire/Charcoal/LED check their respective boolean settings. Trails checks `trailStyle !== "off"`. "None" is checked when all are false/off.
- **Effort preset always has a value**: Defaults to "linear", never null/undefined.
