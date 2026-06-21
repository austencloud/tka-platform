# Unified Sidebar Pill Nav — Design Spec

## Goal

Replace the current CellEditorPanel's flat chip grid with a 5-pill tabbed navigation system. Unify Effects, Style, Playback, Display, and Export into a single sidebar architecture that works in both Compose (Arrange tab) and Viewer contexts.

## Architecture

**Two-tier layout**: structural controls on top (Grid selector + Layer management), configuration controls below (5-pill nav). Structural controls define *what exists*; configuration controls define *how it looks/sounds/exports*.

**Three navigation variants** built as switchable A/B test: (A) horizontal pill bar + segmented scope buttons, (B) vertical icon rail + breadcrumb scope, (C) hybrid horizontal pills + breadcrumb scope. User picks their preference; delete the losers.

**Theme-aware**: all UI chrome uses `var(--theme-accent)` from the existing `@austencloud/theme` system. Effect identity colors are fixed and theme-independent.

## Component Hierarchy

```
ArrangeSidebar
├── GridSection (collapsible — auto-collapses when cell selected)
├── CellEditorPanel (when cell selected)
│   ├── CellHeader ("Cell N" + badges)
│   ├── LayerSection (structural — layer chips, add/remove/copy/paste)
│   ├── ModeToggle (Simple / Advanced)
│   ├── PillNav / IconRail / HybridNav (variant A/B/C)
│   ├── ScopeSelector (when Advanced mode, pills that support scope)
│   └── PillBody (one of 5, based on active pill)
│       ├── EffectsPillBody
│       ├── StylePillBody
│       ├── PlaybackPillBody
│       ├── DisplayPillBody
│       └── ExportPillBody
└── Footer (Download button — context-aware label)
```

## Navigation Variants

### Variant A: Horizontal Pill Bar + Segmented Scope

Five pills in a horizontal row. Each pill shows: icon, label, current value subtitle. Active pill highlighted with `var(--theme-accent)` tint. Below the pills, a segmented scope selector (Cell | Layer | Hand | Tip) when scope is relevant.

### Variant B: Vertical Icon Rail + Breadcrumb Scope

44px-wide icon column on the left edge. Five icons stacked vertically. Active icon gets accent-color left border + background tint. Main panel to the right shows breadcrumb scope navigation (Grid > Cell 3 > L1 > Left > Thumb) and pill body content.

### Variant C: Hybrid Horizontal Pills + Breadcrumb Scope

Horizontal pill bar (same as Variant A) but replaces the segmented scope selector with breadcrumb-style scope navigation.

### Variant Selection

Stored in user settings (localStorage). Defaults to Variant A. Settings UI provides a 3-way toggle. All three share the same pill body components — only the nav chrome and scope display differ.

## Scope System

Scope controls what level of the hierarchy the current pill's settings apply to.

| Pill | Scopes Available | Default |
|------|-----------------|---------|
| Effects | Cell → Layer → Hand → Tip | Cell |
| Style | Cell → Layer → Hand | Cell |
| Playback | Cell → Layer | Cell |
| Display | (none — global) | — |
| Export | (none — global) | — |

**Layer scope** only appears when the cell has 2+ layers (tunnel mode). When single-layer, the scope selector skips from Cell straight to Hand.

**Echo exception**: when Echo effect is active, Tip scope is disabled (Echo operates at Hand level, not Tip level).

## Pill Bodies

### Effects Pill Body

- **4×4 icon-only grid** (16 effects, no text labels, 18px icons)
- Active effect: colored border + tinted background using effect's identity color
- Inactive effects: `rgba(255,255,255,0.55)` (dimmed but visible)
- "Choose a Look" accordion — preset selector per effect
- "Customize [Effect]" accordion — opens per-effect parameter panel
- At Hand scope: shows hand assignment rows (Blue Hand: [effect], Red Hand: [effect]) with "Grid targets: [Hand]" indicator and per-hand grid
- At Tip scope: shows single-tip effect selector with breadcrumb context

**Effect identity colors (fixed, theme-independent):**

| Effect | Color | Icon |
|--------|-------|------|
| Trails | `#60a5fa` | `fa-route` |
| Fire | `#f97316` | `fa-fire` |
| LED | `#22c55e` | `fa-lightbulb` |
| Coal | `#78716c` | `fa-diamond` |
| Zap | `#eab308` | `fa-bolt` |
| Sparkle | `#f59e0b` | `fa-star` |
| Echo | `#8b5cf6` | `fa-clone` |
| Bloom | `#fbbf24` | `fa-sun` |
| Water | `#06b6d4` | `fa-droplet` |
| Bubbles | `#67e8f9` | `fa-circle-notch` |
| Petals | `#f472b6` | `fa-leaf` |
| Smoke | `#94a3b8` | `fa-smog` |
| Ink | `#475569` | `fa-paint-brush` |
| Frost | `#7dd3fc` | `fa-snowflake` |
| Silk | `#c084fc` | `fa-wind` |
| Pulse | `#ef4444` | `fa-bullseye` |

### Style Pill Body

- **Transform actions**: 3×2 grid (Mirror, Flip, Rotate, Swap Colors, Rewind, Shift Start) — immediate actions, not toggles
- **Colors section**: prop color pickers (Blue hand color, Red hand color)
- **Effort selector**: 4×2 grid (Linear, Glide, Dab, Press, Punch, Elastic, Bounce, Anticip.)
- **Effort params**: Weight + Time sliders (labeled "EFFORT PARAMS · [EFFORT]")
- **Motion Paths**: Arc / Linear toggle (two large cards with icons)
- At Hand scope: per-hand assignment rows, grid targets indicator, then effort grid + params for targeted hand

### Playback Pill Body

- **BPM control**: value display + stepper (−/+) or slider
- **Transport controls**: step-back, play/pause, step-forward, stop (44px circular buttons)
- At Layer scope (multi-layer): per-layer offset controls

### Display Pill Body

No scope selector (global).

**Overlays group** (toggle chips, theme-accent colored when on):
- TKA Glyph, Step #, Word, Progress, Loop Label, Level, Props, Effects (quick on/off), Blue Hand Visible, Red Hand Visible

**Grid group** (toggle chips, blue-accent colored when on):
- Grid (master toggle), Hand Points, Non-Radial Points, Outer Points, Center Point

### Export Pill Body

No scope selector (global).

- **Frame Rate**: 3-option row (30 fps, 60 fps, 120 fps)
- **Resolution**: 4-option row (720p, 1080p, 4K, 8K)
- **Timing**: Start Hold / End Hold toggles
- **Loops**: stepper control (−/value/+)
- **Estimate**: computed duration display

## Simple vs Advanced Mode

Toggle at top of CellEditorPanel, above pill nav.

| Feature | Simple | Advanced |
|---------|--------|----------|
| Scope selector | Hidden | Visible |
| Per-hand assignment | Hidden | Visible |
| Per-tip assignment | Hidden | Visible |
| Effect grid | Visible (applies to whole cell) | Visible (applies to current scope) |
| Effort params | Visible (cell-level) | Visible (scoped) |
| Hint text | "Switch to Advanced for per-hand effects" | Hidden |

## Download Button

Footer button with context-aware label:

| Context | Label |
|---------|-------|
| Viewer / single cell, 1 layer | Download Video |
| Cell with 2+ layers | Download Tunnel |
| Full grid (no cell selected) | Download Arrangement |

Gradient background: `var(--theme-accent)` → `var(--theme-accent-strong)`.

## Design Tokens

All pill nav UI inherits from CellEditorPanel's existing token system:

```css
--chip-radius: 22px;        /* pill-shaped chips */
--action-radius: 10px;      /* rectangular action buttons */
--badge-radius: 4px;        /* status badges */
--surface-idle: rgba(255, 255, 255, 0.05);
--surface-hover: rgba(255, 255, 255, 0.08);
--stroke-idle: rgba(255, 255, 255, 0.08);
--stroke-hover: rgba(255, 255, 255, 0.12);
```

**Active state** uses theme accent via `color-mix()`:
```css
background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
color: var(--theme-accent);
```

## Accessibility

- **Font**: minimum 12px for all text
- **Touch targets**: minimum 44px on all interactive elements
- **Contrast**: AAA (7:1) for normal text, 4.5:1 for large text (≥14pt bold)
- **3-tier brightness hierarchy**:
  - Primary (0.85): active labels, body content
  - Secondary (0.72): inactive pill labels, metadata
  - Chrome (0.7): section headers (13px bold uppercase, structural dividers)
- **Non-text contrast**: 3:1 minimum for icons and UI components (WCAG 1.4.11)
- **Reduced motion**: `prefers-reduced-motion: reduce` disables all transitions/animations
- **Keyboard**: arrow keys navigate pills, Enter/Space activates, Escape closes expanded sections

## Files Affected

**Modified:**
- `ArrangeSidebar.svelte` — wire new CellEditorPanel structure
- `CellEditorPanel.svelte` — major restructure: add pill nav, mode toggle, scope selector
- `cell-editor-panel-state.svelte.ts` — add active pill, scope level, mode state
- `ChipGrid.svelte` — replaced; contents distributed across pill bodies:
  - View group (Effects, Blue vis, Red vis) → Effects pill + Display pill
  - Timing group (Speed, Offset) → Playback pill
  - Style group (Transform, Colors, Effort, Display) → Style pill + Display pill

**New:**
- `PillNav.svelte` — Variant A: horizontal pill bar
- `IconRailNav.svelte` — Variant B: vertical icon rail
- `HybridNav.svelte` — Variant C: horizontal pills + breadcrumb
- `ScopeSelector.svelte` — segmented scope (Cell/Layer/Hand/Tip)
- `BreadcrumbScope.svelte` — breadcrumb scope for variants B/C
- `EffectsPillBody.svelte` — 4×4 icon grid + presets + customize
- `StylePillBody.svelte` — effort selector + params + motion paths
- `PlaybackPillBody.svelte` — BPM + transport + layer offset
- `DisplayPillBody.svelte` — overlay + grid visibility toggles
- `ExportPillBody.svelte` — frame rate + resolution + timing + loops
- `ModeToggle.svelte` — Simple/Advanced switch

**Preserved (no changes):**
- `LayerSection.svelte` — stays as structural control above pills
- `DisplaySection.svelte` — absorbed into DisplayPillBody
- All existing expanded section components (TransformSection, SpeedSection, etc.) — reused inside pill bodies where applicable

## Migration Strategy

Incremental: build new pill components alongside existing ChipGrid. CellEditorPanel gains a feature flag (`usePillNav: boolean`) that switches between old ChipGrid layout and new pill nav layout. Once validated, remove old path and flag.
