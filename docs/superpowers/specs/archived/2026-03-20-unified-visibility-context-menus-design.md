# Unified Visibility Context Menus

**Date:** 2026-03-20
**Status:** Draft

## Problem

Three visual components display TKA data: pictographs (step grid), animation canvas, and choreo cards. Each component has visibility settings that control what's shown, but the access pattern is inconsistent:

- **Animation canvas:** Has a context menu with inline toggles AND a full settings modal ("Canvas Settings" — mislabeled, should be "Animation Settings")
- **Choreo card / thumbnail:** Has a context menu with inline visibility toggles but no dedicated settings modal
- **Pictograph (step grid):** Has NO context menu and NO visibility UI at all

The visibility settings tab was removed from the Settings module. There is currently no UI for users to control pictograph visibility (grid, hand points, TKA glyphs, VTG glyphs, etc.), despite the `VisibilityStateManager` supporting all these toggles.

## Solution

Unify all three components under a single pattern:

**Right-click any component → "[Thing] Settings..." → Full settings modal/drawer with live preview**

No inline toggles in context menus. Each component gets a dedicated settings modal that shows the actual component you right-clicked, updating in real-time as you toggle settings. This grounds visibility changes in context — you see exactly how your changes affect the specific sequence beat you're looking at.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Inline toggles in context menu? | No | The modal with live preview is the whole point. Inline toggles are redundant and cramped for 8+ options. |
| Global or per-pictograph visibility? | Global | `VisibilityStateManager` is global. Per-pictograph overrides are deferred to the future pictograph exporter feature. |
| Separate modals or one multi-mode modal? | Separate modals, shared layout | Single responsibility per file. Each modal owns its domain. A shared `SettingsModalLayout` ensures visual consistency. |
| Naming convention | "[Thing] Settings" | Animation Settings, Card Settings, Pictograph Settings. Consistent pattern. |
| Responsive behavior | Drawer on mobile, modal on desktop | Full-height bottom drawer on mobile. Centered modal (~600px wide) on desktop. Both show large preview + toggles. |

## Architecture

### Shared Layout Component

**`SettingsModalLayout.svelte`** — Responsive shell used by all three settings modals.

```
┌─────────────────────────────────────────┐
│  [icon] Pictograph Settings          ✕  │  ← Title bar
├─────────────────────────────────────────┤
│                    │                    │
│   Live Preview     │   Toggle Sections  │  ← Desktop: side-by-side
│   (the actual      │                    │
│    component you   │   ☑ Grid           │
│    right-clicked)  │   ☑ Hand Points    │
│                    │   ☐ TKA Glyphs     │
│                    │   ...              │
│                    │                    │
└─────────────────────────────────────────┘

Mobile: stacked vertically (preview top ~40%, toggles bottom ~60% scrollable)
Desktop: side-by-side (preview left, toggles right)
```

**Props:**
- `title: string` — e.g., "Pictograph Settings"
- `icon: string` — FontAwesome class
- `open: boolean` (bindable)
- `preview: Snippet` — the live preview content (pictograph, animation canvas, or card thumbnail)
- `controls: Snippet` — the toggle sections

**Responsibilities:**
- Responsive breakpoint detection via `$derived` reading `window.innerWidth` (768px threshold). Conditionally renders `{#if isMobile}<Drawer>{:else}<BaseModal>{/if}`. A `matchMedia` listener updates a reactive `$state` on resize.
- On mobile: renders as full-height bottom drawer via `Drawer.svelte` (`src/lib/shared/foundation/ui/Drawer.svelte`)
- On desktop: renders as centered modal via `BaseModal.svelte` (size `"lg"`)
- Backdrop, close-on-escape, focus management (delegated to BaseModal/Drawer)
- Two-pane layout with preview and controls slots

### Three Settings Modals

#### 1. PictographSettingsModal.svelte (NEW)

**Location:** `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte`

**Preview:** Renders the actual pictograph beat the user right-clicked on, at a large size. Uses `PictographContainer` with the specific `StepData`.

**Toggles (from `VisibilityStateManager`):**

| Toggle | Setting Key | Default |
|--------|------------|---------|
| Grid | `showGrid` | true |
| Hand Points | `handPointVisibility` ("all" / "active") | "all" |
| Non-Radial Points | `nonRadialPoints` | true |
| TKA Glyphs | `tkaGlyph` | true |
| VTG Glyphs | `vtgGlyph` | false |
| Elemental Glyphs | `elementalGlyph` | false |
| Position Glyphs | `positionsGlyph` | false |
| Reversal Indicators | `reversalIndicators` | true |
| Step Numbers | `stepNumbers` | true |
| Blue Motion | `blueMotion` | true |
| Red Motion | `redMotion` | true |

**Dependent glyph behavior:** TKA, VTG, Elemental, and Position glyphs require both motions visible. When either motion is hidden, dependent glyph toggles show as disabled with a tooltip explaining why. The existing `getGlyphVisibility()` already factors in motion dependency automatically — it checks `areAllMotionsVisible()` for glyphs in the `DEPENDENT_GLYPHS` array. The modal can also use `isGlyphDependent(glyphType)` to determine which toggles need the disabled treatment.

**State flow:** All toggles call `VisibilityStateManager` methods directly. The preview updates reactively via observer registration. Changes are persisted immediately (localStorage + Firebase for authenticated users).

#### 2. AnimationSettingsModal.svelte (REFACTOR of CanvasSettingsModal)

**Location:** `src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte`

**Changes from current `CanvasSettingsModal`:**
- Rename "Canvas Settings" → "Animation Settings" in the title (line 166)
- Rename directory from `canvas-settings-modal/` to `animation-settings-modal/`
- The existing modal already has its own two-pane layout (preview left, controls right) that works well. Rather than stripping it to use `SettingsModalLayout`, just add the mobile drawer path: detect mobile breakpoint and render the existing content inside a `Drawer` on mobile, keeping the current `BaseModal` on desktop. This avoids a risky refactor of a complex component (8 category components + effect picker) while still delivering the mobile drawer experience.
- Rename the context menu entry from "Effect Settings..." → "Animation Settings..."
- Keep all existing category components (FireCategory, CharcoalCategory, LedCategory, TrailsCategory, PlaybackCategory, EffortCategory, PathShapeCategory, DisplayCategory)
- Keep the EffectPicker

**Preview:** The existing `AnimatorCanvas` instance with independent RAF playback (already implemented).

#### 3. CardSettingsModal.svelte (NEW)

**Location:** `src/lib/features/choreo-card/components/CardSettingsModal.svelte`

**Preview:** Renders the choreo card thumbnail that the user right-clicked on. Uses the existing card rendering pipeline.

**Toggles (from `ImageCompositionStateManager` + `VisibilityStateManager`):**

Pictograph visibility section:
| Toggle | Source |
|--------|--------|
| Hand Points | `VisibilityStateManager` |
| Grid | `VisibilityStateManager` |
| TKA Glyphs | `VisibilityStateManager` |

Card composition section:
| Toggle | Source |
|--------|--------|
| Word | `ImageCompositionStateManager` |
| Start Position | `ImageCompositionStateManager` |
| Difficulty | `ImageCompositionStateManager` |
| Step Numbers | `ImageCompositionStateManager` |
| Creator Name | `ImageCompositionStateManager` |
| Notes | `ImageCompositionStateManager` |
| Birthday | `ImageCompositionStateManager` |
| QR Code | `ImageCompositionStateManager` |

### Context Menu Changes

#### Pictograph Context Menu (NEW)

**Builder:** `PictographContextMenuBuilder.ts`
**Host:** `PictographContextMenuHost.svelte`
**Location:** `src/lib/shared/pictograph/shared/components/context-menu/`

Minimal menu:
```
┌────────────────────────┐
│ 🔧 Pictograph Settings… │
└────────────────────────┘
```

Future addition (separate design): "Export Pictograph..." entry.

**Integration point:** `StepCell.svelte` currently has a `handleContextMenu` that only prevents default when `onLongPress` is active. This will be updated to:
1. Always prevent default on right-click
2. Open the `PictographContextMenuHost` at click coordinates
3. Pass the specific `StepData` for the right-clicked beat to the settings modal

#### Animation Canvas Context Menu (SIMPLIFY)

**Current state:** Inline toggles for Effects, Efforts, Path Shape, Display, plus "Effect Settings..." entry.

**New state:** Remove inline toggles. Single entry:
```
┌──────────────────────────┐
│ 🔧 Animation Settings…   │
│ ─────────────────────── │
│ 🔀 Disassemble           │  ← keep if applicable
└──────────────────────────┘
```

The "Animation Settings..." entry opens `AnimationSettingsModal`. Disassemble toggle remains as a quick action since it's not a visibility setting.

#### Choreo Card Context Menu (SIMPLIFY)

**Current state:** Display submenu with 11 inline toggles, plus Re-render and Send to... actions.

**New state:**
```
┌────────────────────────┐
│ 🔧 Card Settings…      │
│ ─────────────────────  │
│ 🔄 Re-render            │  ← keep if applicable
│ 📤 Send to…             │  ← keep if applicable
└────────────────────────┘
```

The "Card Settings..." entry opens `CardSettingsModal`. Re-render and Send to... remain as quick actions since they're operations, not settings.

### File Changes Summary

| Action | File |
|--------|------|
| **CREATE** | `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte` |
| **CREATE** | `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte` |
| **CREATE** | `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts` |
| **CREATE** | `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte` |
| **CREATE** | `src/lib/features/choreo-card/components/CardSettingsModal.svelte` |
| **REFACTOR** | `CanvasSettingsModal.svelte` → `AnimationSettingsModal.svelte` (rename + wrap in layout) |
| **REFACTOR** | `canvas-settings-modal/` → `animation-settings-modal/` (directory rename) |
| **SIMPLIFY** | `CanvasContextMenuBuilder.ts` — remove inline toggles, single "Animation Settings..." entry |
| **SIMPLIFY** | `CardDesignerContextMenuBuilder.ts` — remove Display submenu, single "Card Settings..." entry |
| **MODIFY** | `StepCell.svelte` — add context menu handler, integrate PictographContextMenuHost |
| **MODIFY** | `CanvasContextMenuHost.svelte` — update imports for renamed modal |
| **DELETE** | `src/lib/shared/settings/components/tabs/visibility/example-data.ts` (stale orphan) |

### State Flow Diagram

```
User right-clicks pictograph in step grid
  → StepCell.svelte prevents default, calls PictographContextMenuHost.openContextMenu(x, y)
    → Context menu renders: "Pictograph Settings..."
      → User clicks entry
        → PictographSettingsModal opens with the specific StepData
          → Preview: PictographContainer renders the beat at large size
          → Toggles: Each calls VisibilityStateManager methods
            → Observer fires → preview re-renders with new visibility
            → VisibilityStateManager persists to localStorage/Firebase
```

Same pattern for animation canvas and choreo card, substituting their respective managers and modals.

## Future Work (Out of Scope)

- **Pictograph Exporter:** Right-click → "Export Pictograph..." → Modal with temporary per-pictograph visibility overrides, PNG/SVG export. Would be added as a second entry in the pictograph context menu.
- **Per-pictograph visibility overrides:** Only relevant in the context of export. Global settings remain the default.

## Internationalization

All context menu labels and toggle labels should use i18n keys from `messages/en.json`. New keys should follow the existing naming pattern (e.g., `settings.pictograph.title`, `settings.card.toggleGrid`). The project has a translation system in place — all user-facing strings go through it.

## Testing

Per the earned tests philosophy: no tests needed. These are UI components with visual feedback. If toggles don't work, you see it immediately. The underlying `VisibilityStateManager` already has proven persistence logic.

## Migration

- The `CanvasSettingsModal` rename is a breaking change for imports. All consumers of the old path must be updated.
- The choreo card context menu simplification removes inline toggles that some users may rely on. The "Card Settings..." modal provides the same controls with a better preview experience.
- The animation canvas context menu simplification removes quick inline toggles. Power users who liked the inline submenus lose one click of convenience but gain the live preview modal.
