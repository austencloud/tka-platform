---
status: archived
---
# Grid Setup Wizard with Level Gating & Premium Tiers

**Date:** 2026-03-21
**Status:** Draft (product design — not implementation-ready)
**Feedback:** rmbwjBwnaDpmoW1fvJ0d

## Problem

The grid mode toggle (Diamond/Box/Merged + Center) is bolted onto the assemble header as inline pills. There's no indication that this affects the entire sequence. No persistence. No progressive disclosure. No connection to the level system or premium gating.

## Vision

When starting a new assembly, the user is asked "what kind of grid?" in a deliberate configuration step. This choice is persisted and locked for the sequence. Advanced grid modes are gated by level progression and premium status.

## Level Tiers

| Tier | Grid Options | Level Req | Premium? |
|------|-------------|-----------|----------|
| **Foundation** | Diamond OR Box | L1-3 | Free |
| **Centric** | Diamond+Center OR Box+Center | L4 | Premium |
| **Merged** | All 8 perimeter points + optional Center | L5 | Premium |
| **Interradial** | Any grid + interradial orientations | L6 | Premium |

### Rationale

- L1-3 covers turns progression (0, whole, half+float) on a single 4-point grid. Free tier.
- L4 adds the center point — one new grid point, hash motions, centric orientations. First premium gate.
- L5 adds merged grids (all 8 perimeter points). More complex state space. Premium.
- L6 adds interradial orientations (8 orientations instead of 4). Not a grid change — it's an orientation adjustment that applies on top of any grid mode. Premium.

## Wizard Flow

### Step 1: Grid Mode Selection

Presented as a visual picker (not text pills). Each option shows a mini grid preview:

- **Diamond** — 4 cardinal points (N/E/S/W)
- **Box** — 4 intercardinal points (NE/SE/SW/NW)
- **Merged** — all 8 points (locked if below L5 or not premium)

### Step 2: Center Toggle

- Toggle to add center point to the chosen grid
- Locked if below L4 or not premium
- Shows a preview of what center adds

### Step 3: Confirm & Start Building

- Shows the final grid configuration
- "Start Building" button enters the assemble flow
- Grid mode is now locked for the entire sequence

## Persistence

- Grid mode preference saved to user settings (Firebase)
- Last-used grid mode is the default for next assembly
- Center toggle preference also persisted

## Premium Gating UX

- Locked options show a lock icon + "Premium" badge
- Tapping a locked option shows the premium upgrade prompt
- Free users can still SEE what Merged and Center look like (preview) but can't build with them

## Integration with Existing System

- The current inline pills (GridModePicker) remain for the orientation explainer (educational, no gating)
- The assemble flow replaces the pills with the wizard on first entry
- `assemble-state.svelte.ts` already has `gridMode` and `showCenter` — wizard just sets these before building starts

## Dependencies

- Premium gating system (design spec exists, implementation pending)
- Level progression system (levels defined, gating UI not built)
- Hash arrow SVGs (needed for center to render properly in pictographs)
- Centric letter database (empty — needed for letter lookup in centric sequences)

## Out of Scope for This Spec

- Arrow SVG creation for hash motions
- Centric CSV data population
- Fractional turn orientation at center
- The actual premium payment/subscription system
- Level progression unlock mechanics
