# Performer Hub — Bottom-Left Integrated Panel

**Date:** 2026-05-23
**Inspiration:** The Sims character management UI
**Status:** Design approved, ready for implementation

## Overview

Replace the current bottom-center PerformerRail + right-rail per-performer controls with a single integrated "Performer Hub" component anchored at the bottom-left of the 3D viewer. The hub combines performer selection (vertical spine) and per-performer controls (horizontal detail band) into one cohesive glass component.

The right rail (`Animation3DSidePanel`) stays for global/scene-level settings (environment, proportions, avatar model, global effects). It dims when a performer is selected since per-performer controls live in the hub.

## Architecture: Unified Viewer Engine

Single viewer engine, two context modes (same component tree, different enabled fields):

- **Sequence Mode** (current Sequence Viewer): all performers locked to one sequence. Detail panel shows speed, effects, avatar swap, prop size. No sequence reassignment.
- **Stage Mode** (future tab): performers can have different sequences. Detail panel adds sequence picker, formation controls, performer naming. Same hub component with more fields unlocked.

Stage Mode is out of scope for this spec. The hub is designed so Stage Mode only needs to enable additional fields, not restructure the component.

## Component: PerformerHub

### Layout

```
  [+]           ← Add performer (dashed chip)
  ───
  [3]           ← Performer chips stack upward
  [2] ← selected (colored border + glow)
  [1]
  ───
  [All]         ← Deselect, show all performers
  ┌──────────────────────────────────────────────────────────┐
  │ Identity       │ Controls         │ Effects              │
  │                │                  │                      │
  │ (A) Austen     │ SPEED            │ 4-column grid of     │
  │ BOOK · 4 beats │ [.25 .5 1x 1.5 2]│ effect chips from    │
  │ [P2]           │                  │ effect-registry.ts   │
  │                │ PROP SIZE        │                      │
  │ [Change Avatar]│ ──●── 1.3×      │                      │
  └──────────────────────────────────────────────────────────┘
```

- **Spine** and **detail band** share one continuous glass background (`rgba(20, 22, 32, 0.78)` + `backdrop-filter: blur(20px) saturate(140%)`)
- Spine sits at top-left of detail band — left edges aligned
- Detail band extends horizontally to the right
- Border radius: spine gets `14px` top corners, detail band gets `14px` on right side and bottom-right. The junction between spine and detail is seamless (no border between them)

### Spine (Performer Roster)

Replaces `PerformerRail.svelte`. Vertical instead of horizontal.

- Chips: 48×48px (slightly smaller than current 56×56 to fit vertical space better)
- Order bottom-to-top: All → separator → 1 → 2 → 3 → separator → Add (+)
- Chip styles: identical to current `PerformerRail` chips (performer-color dot, number, active glow) adapted to the shared glass background instead of individual chip backgrounds
- Max performers: respects `STAGE.MAX_VIEWER_PERFORMERS` (currently 8)
- Selection: `viewer.selectPerformerScope(index)` — same API as current rail

### Detail Band (Per-Performer Controls)

Three-column horizontal layout. Only visible when a performer is selected (`selectedPerformerIndex !== null`).

**Column 1 — Identity** (~200px):
- Avatar circle: 40×44px, bordered with performer color. Shows initials now; will show uploaded photo when avatar upload ships.
- Name: performer name (defaults to avatar model name, editable in Stage Mode)
- Sequence label: word + beat count (e.g., "BOOK · 4 beats")
- Performer badge: "P1", "P2", etc. in performer color
- "Change Avatar" button: opens avatar model picker (connects to existing `AVATAR_DEFINITIONS`)

**Column 2 — Controls** (~180px):
- Speed bar: 0.25× / 0.5× / 1× / 1.5× / 2× — segmented button matching existing speed control style. Writes to `performer.settings.speed` (cascade: null = inherit viewer default).
- Prop size slider: existing `PerformerPropSizeSlider` component, compact variant. Writes to `performer.settings.propScale`.

**Column 3 — Effects** (flex: 1, fills remaining width):
- 4-column grid of effect chips
- Source: `EFFECTS` array from `effect-registry.ts` (16 effects) + Motion
- Chip style: matches existing `EffectsSettingsPanel` chip style (icon + label, `color-mix` active state with per-effect color)
- Toggle: `performer.toggleEffect(effectId)` for per-performer effects
- Per-performer effect Set uses `EffectId` union. Available per-performer: trails, fire, led, charcoal, zap (→electricity), sparkles, bloom, frost, silk, pulse, motion (11 effects). Hidden from per-performer toggle: echo, water, bubbles, petals, smoke, ink (6 effects — Phase 2.5 migration maps them to canonical EffectId). The hub detail panel only renders the 11 available effects when in per-performer mode.

### Animation

- Detail band: slides in from collapsed (max-height + opacity transition, 280ms ease-out)
- On performer change: cross-fade detail content (performer color, name, badge update)
- Spine chips: same spring easing as current rail chips (`cubic-bezier(0.2, 0, 0.13, 1.5)`)

## Right Rail Behavior

`Animation3DSidePanel.svelte` stays structurally unchanged. Two behavioral additions:

1. **Dim when performer selected**: when `selectedPerformerIndex !== null`, apply `opacity: 0.3; pointer-events: none` to the right rail. Per-performer controls are in the hub. When `selectedPerformerIndex === null`, right rail is fully active.

2. **Effects section context**: right rail effects section continues to control global effects (tipEffectMap wildcard). The hub detail panel controls per-performer effects (performer.settings.effects Set). These are already separate APIs — no conflict.

## State Integration

No new state managers. Hub reads/writes existing state:

| Hub control | State target | API |
|---|---|---|
| Performer selection | `viewer.selectedPerformerIndex` | `viewer.selectPerformerScope(index)` |
| Speed | `performer.settings.speed` | Direct write (cascade: null = inherit) |
| Prop size | `performer.settings.propScale` | Direct write |
| Effects toggle | `performer.settings.effects` Set | `performer.toggleEffect(id)` |
| Avatar change | `performer.avatarModelId` | Existing avatar assignment |
| Add performer | `performerManager` | `viewer.spawnPerformerFromUI()` |

## Files to Create/Modify

### New
- `src/lib/shared/3d/components/controls/PerformerHub.svelte` — the integrated component
- `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte` — detail band (extracted for readability)
- `src/lib/shared/3d/components/controls/PerformerSpine.svelte` — vertical chip rail

### Modify
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` — swap `PerformerRail` import for `PerformerHub` (line 22, 373)
- `src/lib/shared/3d/components/panels/Animation3DSidePanel.svelte` — add dim behavior when performer selected

### Remove
- `src/lib/shared/3d/components/controls/PerformerRail.svelte` — replaced by PerformerSpine

## Out of Scope

- User-uploaded avatar photos (needs Firebase storage pipeline)
- Performer naming/renaming (Stage Mode feature)
- Multi-sequence assignment per performer (Stage Mode feature)
- Formation editing UI in hub (formation controls exist in performerManager but aren't exposed in hub)
- Stage Mode tab creation
- Mobile responsive layout for the hub (desktop-first, mobile adaptation later)

## Design Tokens Reference

All styling must use existing CSS custom properties from `app.css` and `panel-design-system.css`:

- Panel: `--theme-panel-bg`, `var(--glass-blur)` via `rgba(20, 22, 32, 0.78)` + `backdrop-filter: blur(20px) saturate(140%)`
- Chips: 48×48px, `border-radius: 12px`, `border: 1px solid var(--stroke)`
- Text: `var(--theme-text)`, `var(--theme-text-dim)`, `var(--theme-text-muted)`
- Effects: per-effect colors from `EFFECTS` registry, `color-mix(in srgb, var(--color) 20%, transparent)` active state
- Performer colors: `getPerformerColor(index)` from `performer-colors.ts`
- Touch targets: minimum 44px (`var(--min-touch-target)`)
- Transitions: `var(--duration-fast)` (150ms), `var(--duration-normal)` (200ms), `var(--ease-out)`
