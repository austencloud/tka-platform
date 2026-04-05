# Alt Hotkey Overlay — Design Spec

**Date:** 2026-04-04
**Status:** Approved

## Summary

A wide horizontal popover that slides down from top-center when the user holds Alt on desktop. Shows all available Alt+key bindings organized into three sections: Rotate, Transform, and Prop Presets. Each item is clickable. Releasing Alt dismisses it.

This feature also unifies the currently-split transform keybindings (bare keys in `register-create-shortcuts.ts` and `ArrangeKeyboardHandler.ts`) into a single set of Alt+key shortcuts that work across the entire Create module.

## Motivation

- Transforms on bare keys (M, R, W, etc.) are too easy to trigger accidentally
- The Create module and Arrange tab have separate, inconsistent keybinding sets for the same operations
- Moving transforms behind Alt reduces accidental triggers while the overlay compensates for discoverability
- The overlay also serves as a launchpad — items are clickable, not just informational

## Unified Transform Keybindings

Replaces both the CREATE bare-key shortcuts and the Arrange tab's separate keyboard handler.

| Binding | Transform | FA Icon | Accent Color |
|---------|-----------|---------|--------------|
| Alt+L | Rotate CCW 45° | `fa-rotate-left` | `#60a5fa` (blue) |
| Alt+R | Rotate CW 45° | `fa-rotate-right` | `#60a5fa` (blue) |
| Alt+M | Mirror (flip L/R) | `fa-left-right` | `#60a5fa` (blue) |
| Alt+V | Flip (top/bottom) | `fa-up-down` | `#a78bfa` (purple) |
| Alt+S | Swap hands | `fa-right-left` | `#fb7185` (pink) |
| Alt+I | Invert direction | `fa-circle-half-stroke` | `#fbbf24` (yellow) |
| Alt+F | Shift start beat | `fa-step-backward` | `#818cf8` (indigo) |
| Alt+W | Rewind (reverse) | `fa-backward` | `#34d399` (green) |
| Alt+1–0 | Prop presets 1–10 | Actual prop SVG | amber `#f5c842` |

**Removed shortcuts:**
- Bare M, R, W, H, Shift+R from `register-create-shortcuts.ts`
  - Note: bare H was "swap colors" — now unified as Alt+S ("Swap hands")
- Bare M, R, V, S, I, Shift+R from `ArrangeKeyboardHandler.ts`

**Migration note:** The old bare-key transforms respected `enableSingleKeyShortcuts`. Since Alt+key shortcuts are modifier-based, they are always active regardless of that setting. Users who had `enableSingleKeyShortcuts: false` to prevent accidental bare-key triggers now get the same protection by default (Alt is required), so no behavior is lost.

**Kept as-is in ArrangeKeyboardHandler:**
- Arrow keys (cell navigation)
- Delete/Backspace (clear cell)
- Escape (deselect)
- Space (play/pause)
- Ctrl+C / Ctrl+V (copy/paste)
- Ctrl+Z / Ctrl+Shift+Z (undo/redo)

## Overlay Component

### Mount point

`AltHotkeyOverlay.svelte` is mounted once in `src/lib/features/create/shared/components/CreateModule.svelte` (the composition root) — it lives alongside whatever tab is active (Assemble, Arrange, Generate, etc.), not inside any individual tab.

### Layout

Wide horizontal bar (~960px max-width), horizontally centered, pinned to the top of the viewport. Three sections separated by thin vertical dividers:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Alt]  │  Rotate: ⟲CCW [L]  ⟳CW [R]  │  Transform: Mirror[M] Flip[V]     │
│  hold  │                                │  Swap[S] Invert[I] Shift[F]       │
│        │                                │  Rewind[W]                         │
│        │                                │                                    │
│        │  Props: [Staff][Fan][Club][Buugeng][Hoop]...           [✎ Edit]    │
└──────────────────────��──────────────────────────────────��────────────────────┘
```

Actual layout is `display: flex` with sections flowing horizontally. On very wide monitors (4K) this occupies a modest strip across the top — minimal vertical intrusion.

### Visual spec

Matches existing `TransformSection.svelte` design language:

- **Panel:** `background: var(--theme-panel-bg, rgba(18, 18, 28, 0.97))`, `border: 1px solid var(--theme-stroke)`, `border-radius: 12px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.5)`
- **Icon badges:** 26×26px rounded squares with color-tinted backgrounds (e.g., `rgba(59,130,246,0.12)` for blue), matching `TransformSection`'s `.icon-badge`
- **Key badges:** 11px monospace bold, accent-colored text on accent-tinted background with subtle accent border (e.g., blue key M gets `background: rgba(59,130,246,0.2)`, `color: #7ba3ff`). This replaces the old gray-on-gray style for high contrast.
- **Prop preset items:** Actual SVG from `/images/props/buttons/{propType}.svg`, rotated -90° for staves (matching `PresetChip.svelte` behavior). Amber/gold number badges.
- **Cat/dog preset (slot 10/key 0):** Orange-tinted border to indicate mixed-prop mode, shows both prop icons.
- **Edit button:** Small `fa-pen` + "Edit" text in Props section header. Subtle hover state. Navigates to Settings > Prop Type tab.
- **Section labels:** 9px uppercase, letter-spacing 1px, `color: var(--theme-text-dim)` — matching `.section-label` in TransformSection.

### Behavior

| Event | Result |
|-------|--------|
| Alt keydown | Overlay slides in from top (180ms ease-out, `translateY(-12px)` → `0`) |
| Alt keyup | Overlay fades out (120ms ease-in) |
| Alt+key pressed | Execute transform/preset. Overlay stays visible (user may chain transforms). |
| Click on transform item | Execute that transform. Overlay stays visible. |
| Click on prop preset | Apply that preset. Overlay stays visible. |
| Click "Edit" | Navigate to Settings > Prop Type tab. Overlay dismisses. |
| No active sequence | Transform items render as disabled (dimmed, no click handler). Prop presets still work. |
| Text input focused | Overlay and Alt+key shortcuts are suppressed when an `<input>`, `<textarea>`, or `[contenteditable]` element has focus. Prevents interference with text editing. |
| Mobile / touch device | Overlay never renders. |
| `enableSingleKeyShortcuts` setting off | Does not affect Alt+key shortcuts (Alt is a modifier, not a single key). See migration note in Keybindings section. |

### Animation

- **Enter:** `slideDown` keyframes — opacity 0→1, translateY -12px→0, 180ms ease-out (matches TransformSection)
- **Exit:** opacity 1→0, translateY 0→-8px, 120ms ease-in
- **`prefers-reduced-motion`:** Skip animation, instant show/hide

### State management

The overlay needs to know:
1. **Is Alt held?** — global keydown/keyup listener (managed internally by the component). Suppressed when `document.activeElement` is an input/textarea/contenteditable.
2. **Active sequence exists?** — read via `getCreateModuleContext().state.hasSequence()` (from `create-module-state.svelte.ts:378`) to conditionally enable/disable transform items
3. **Prop presets array** — read from settings state (`container.items.settingsState.settings.propPresets`) to render correct prop icons
4. **Which preset is selected** — read from `selectedPresetIndex` to highlight current

No new state factory needed. The overlay reads existing state from context and settings.

### Desktop only

The component checks for touch/mobile and returns early (no render). The overlay is meaningless on devices without a physical keyboard.

## File Changes

| File | Type | Change |
|------|------|--------|
| `src/lib/features/create/components/AltHotkeyOverlay.svelte` | **New** | The overlay component: Alt key listener, layout, clickable items, prop preset rendering |
| `src/lib/shared/keyboard/utils/register-create-shortcuts.ts` | **Edit** | Remove bare-key transform shortcuts (M, R, W, H, Shift+R). Register Alt+M, Alt+V, Alt+S, Alt+I, Alt+F, Alt+W, Alt+L, Alt+R as unified transforms with `context: "create"`. |
| `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeKeyboardHandler.ts` | **Edit** | Remove the `KEY_TO_TRANSFORM` and `SHIFT_KEY_TO_TRANSFORM` maps and associated handling. Keep arrow nav, delete, space, copy/paste, undo/redo. |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte` | **Edit** | Update `hotkey` field in `rearrangeButtons` array to show Alt+key labels (e.g., `"Alt+M"` instead of `"M"`). |
| `src/lib/features/create/shared/components/CreateModule.svelte` | **Edit** | Mount `<AltHotkeyOverlay />` alongside the active tab content. |

## Non-goals

- No overlay for modules other than Create (Browse, Learn, etc. don't have transforms)
- No customizable key bindings for the overlay items (uses the existing `ShortcutRegistry` — custom bindings already supported there)
- No mobile/tablet adaptation — desktop keyboard feature only
- No new DI services — the overlay is a presentational component reading existing state
