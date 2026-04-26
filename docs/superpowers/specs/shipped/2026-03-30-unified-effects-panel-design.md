# Unified Effects Panel Design

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Shared effects UI component for Export panel and Effects Lab

---

## Problem

The Export panel and Effects Lab have completely different UIs for effect selection and configuration. The Export panel uses our new LedSection with 22 patterns and color presets dumped inline. The Effects Lab uses the old LedControlPanel with just Solid/Rainbow. They share no components, no state flow, and no design language. Both are overwhelming in different ways.

Additionally, users who just want to pick a look are forced to confront the same controls as power users who want to tweak glow radius and bloom intensity.

## Solution: Progressive Disclosure with Presets

**Two user journeys, one component:**

1. **Casual user**: Taps an effect. Sees 4 visual presets. Taps one. Done. Never sees a slider.
2. **Power user**: Taps "Customize [Effect] Settings" button. Gets the full sandbox with all parameters.

The effect controls are a single shared `EffectsPanel` component used in both locations.

---

## Architecture

### Shared Component: `EffectsPanel`

Props:
- `showPlayback: boolean` — whether to render BPM + transport controls (true in both locations)
- `showExportControls: boolean` — whether to render FPS, Resolution, Timing, Loops, Download (true in Export, false in Lab)
- `showSource: boolean` — whether to render Source picker (false in Export, true in Lab)
- `advancedDefaultOpen: boolean` — whether advanced tuning is expanded by default (false in Export, true in Lab)

### Layout Structure

```
┌─ Playback ──────────────────────────┐
│       − [ 60 BPM ] +               │
│    ‹  «  [ ⏸ ]  »  ›              │
└─────────────────────────────────────┘

┌─ Source (Lab only) ─────────────────┐
│   Pick  |  Library  |  Infinite     │
│   Skip  |  Shuffle                  │
│   AABB...  8 beats  D = copy        │
└─────────────────────────────────────┘

┌─ FPS + Resolution (Export only) ────┐
│   FPS:  [30] [60] [120]            │
│   RES:  [720p] [1080p] [4K]        │
└─────────────────────────────────────┘

┌─ Effects ───────────────────────────┐
│  [None] [Fire] [LED] [Trails] [Coal]│
└─────────────────────────────────────┘

┌─ Effect Presets (per-effect) ───────┐
│  CHOOSE A LOOK                      │
│  ┌──────────┐ ┌──────────┐         │
│  │  preset1  │ │  preset2  │        │
│  └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐         │
│  │  preset3  │ │  preset4  │        │
│  └──────────┘ └──────────┘         │
│                                     │
│  ● Solid · Brightness 4 · 1.0x     │
│                                     │
│  [ Customize LED Settings ]         │
└─────────────────────────────────────┘

┌─ Timing + Loops (Export only) ──────┐
│  TIMING:  [Start Pos] [End Hold]    │
│  LOOPS:   [ − ]  4x  [ + ]         │
└─────────────────────────────────────┘

┌─ Download (Export only) ────────────┐
│  [ ⬇ Download Animation ]          │
│           ~43.4s                    │
└─────────────────────────────────────┘
```

### Playback Controls

Centered, Lab-style layout (replaces the cramped BPM-only row):
- Row 1: BPM (- / value / +) centered
- Row 2: Transport (prev / rewind / play-pause / forward / next) centered
- Play-pause button is slightly larger and accent-colored

### Effect Buttons

5 buttons in a horizontal row: None, Fire, LED, Trails, Coal.
- 48px min-height
- Each has an icon + label
- Active effect gets its color: LED = green, Fire = orange, Trails = blue, Coal = purple, None = neutral
- Tapping an effect shows its preset section below

### Effect Presets

Each effect type has 4 visual preset cards in a 2x2 grid:

**LED Presets:**
| Preset | Color | Pattern | ColorMode |
|--------|-------|---------|-----------|
| Green Glow | #00ff88 | Solid | Unified |
| Ice Blue | #4488ff | Solid | Unified |
| Rainbow | — | Rainbow | Unified |
| Prop Colors | — | Solid | Prop-Matched |

**Fire Presets:**
| Preset | Description |
|--------|-------------|
| Classic Fire | Default orange/red flame |
| Blue Flame | Cool-toned fire |
| Spirit Fire | Purple flame |
| Ghost Fire | Green/teal flame |

**Trails Presets:**
| Preset | Description |
|--------|-------------|
| Clean Trace | Thin, crisp trail lines |
| Soft Glow | Thicker with blur |
| Thin Line | Minimal, sharp |
| Prop Match | Blue trail / red trail |

**Charcoal Presets:**
| Preset | Description |
|--------|-------------|
| Violet Ember | Default purple spark |
| Hot Coal | Red/pink spark |
| Jade Dust | Green spark |
| Ash | Neutral gray spark |

Each preset card:
- Min-height 80px, tappable
- Shows a visual preview (glow dot, trail line, etc.)
- Shows a name
- Active preset has effect-colored border

### Current Settings Summary

Below the preset grid, a single-line summary shows the current configuration:
- Small colored dot + text description
- e.g. "Solid · Brightness 4 · Speed 1.0x"
- Gives the user confidence about what's applied without showing controls

### Customize Button

A proper 44px button (not a link): "Customize [Effect] Settings"
- Opens the full parameter sandbox
- For LED: pattern picker (22 patterns), color presets + custom picker, speed slider, brightness, and advanced (glow radius, bloom intensity, trail persistence, color mode)
- For Fire: color curve, intensity, spread
- For Trails: mode, width, opacity, color
- For Charcoal: density, spread, color

### "None" Selected

When "None" is the active effect, the preset section is empty. The space goes to FPS/Resolution/Timing/Loops in the Export panel, or Source/Playback in the Lab.

---

## Touch Targets

Every interactive element: **44px minimum** in both width and height. No exceptions.

- Effect buttons: 48px height
- Preset cards: 80px+ height
- Chip buttons (FPS, resolution, timing): 44px height
- Transport buttons: 44px diameter (play-pause: 48px)
- BPM +/- buttons: 44px diameter
- Loop +/- buttons: 44px
- Customize button: 44px height, full width
- Download button: 48px height, full width

---

## Sidebar Width

The sidebar is 340px on desktop. Controls have room to breathe. Do not design for 280px.

---

## Components to Create

| Component | Purpose |
|-----------|---------|
| `EffectsPanel.svelte` | Top-level orchestrator with layout slots |
| `PlaybackControls.svelte` | Centered BPM + transport row (shared) |
| `EffectSelector.svelte` | 5 effect buttons (None/Fire/LED/Trails/Coal) |
| `EffectPresets.svelte` | 2x2 preset grid + summary + customize button |
| `LedPresets.svelte` | LED-specific preset definitions + customize view |
| `FirePresets.svelte` | Fire-specific preset definitions + customize view |
| `TrailPresets.svelte` | Trails-specific preset definitions + customize view |
| `CharcoalPresets.svelte` | Charcoal-specific preset definitions + customize view |

### Components to Remove

| Component | Replaced By |
|-----------|------------|
| `LedSection.svelte` | `EffectsPanel` + `LedPresets` |
| `LedColorPresetRow.svelte` | Absorbed into `LedPresets` customize view |
| `LedPatternGrid.svelte` | Absorbed into `LedPresets` customize view |
| `LedControlPanel.svelte` (Effects Lab) | `EffectsPanel` + `LedPresets` |
| `EffectPicker.svelte` | `EffectSelector` |

### Files to Modify

| File | Change |
|------|--------|
| `ExportVideoDrawer.svelte` | Replace LedSection + EffectPicker with EffectsPanel |
| `EffectsLabPlaybackHost.svelte` | Replace LedControlPanel + effect tabs with EffectsPanel |
| `AnimationSettingsModal.svelte` | Replace LedSection + EffectPicker with EffectsPanel |

---

## State Management

All effect state flows through `AnimationVisibilityStateManager` (the existing global singleton). No new state layer. The presets are just convenience functions that set multiple state values at once:

```typescript
function applyLedPreset(presetId: string): void {
  const preset = LED_PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  vm.setLedPrimaryColor(preset.primaryColor);
  vm.setLedPatternId(preset.patternId);
  vm.setLedBrightness(preset.brightness);
  // etc.
}
```

---

## What This Does NOT Change

- The 22 pattern evaluators (already built and working)
- The WebGL LED renderer
- The LedTipTracker
- The TipEvaluationContext system
- The color preset data types (LedColorPresets.ts)
- The pattern registry

These are all backend/engine pieces. This spec is purely about the UI layer that sits on top.
