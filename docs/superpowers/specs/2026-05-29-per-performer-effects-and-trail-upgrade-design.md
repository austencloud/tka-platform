# Per-Performer Effects + Trail Upgrade — Design

**Date:** 2026-05-29
**Status:** Approved (Austen: "go nuts")

## Problem

Three coupled issues in the 3D sequence viewer effects system:

1. **Per-performer selection does nothing.** The Performer Hub effects panel
   (`EffectsSettingsPanel` with a `performer` prop) writes to
   `performer.toggleEffect()` (a `Set<EffectId>`), but the 3D renderer
   (`EffectOrchestrator3D`) reads only the global `tipEffectMap`. A grep proves
   nothing in the render path consumes `effectiveEffects`. So picking an effect
   for a performer never reaches the screen.

2. **The renderer invents trails.** `EffectOrchestrator3D.svelte:378,446` does
   `const effect = resolved === "none" ? "trails" : resolved;`. With an empty or
   "none" map the renderer paints trails the state never selected, while the
   panel honestly highlights nothing. That mismatch is the reported
   "trails show but aren't selected."

3. **Trails are underwhelming.** User wants more *presence* (brighter HDR core,
   fatter taper, stronger bloom on capable tiers) and *smoothness* (the ribbon
   facets on tight arcs — only 4 Catmull-Rom subdivisions vs the 2D trail's
   ~150). `resolveTrails3D` already computes an `emissive` value but the Trail3D
   mount never passes it — emissive is dead.

Plus a consistency rider: `UnifiedEffectsSection.svelte` (compose cell editor)
hardcodes 11 effect colors that diverge from the canonical
`effect-registry.ts`.

Ground truth: acolytes render nothing (`CovenStation.svelte:333`
`showEffects={false}`); coven centers default to LED (`coven-effect-map.ts`),
rendered by `LedRenderer3D`, not the Trail3D ribbon.

## Decisions (from brainstorm)

- **One active effect per performer** (radio, not stacked layers). Maps cleanly
  onto the single-effect-per-tip renderer with no compositing rewrite.
- Trail effort biased to **presence + smoothness**. Skip the fade-envelope and
  head→tail gradient (snapping/washout were not the complaint — YAGNI).
- Keep additive blending + the Gaussian halo; gain presence through a brighter
  HDR core (which scene bloom catches) rather than more overlap, so the coven
  center does not blow out worse.

## Part A — Wire per-performer effect into render

### Model migration (the "Phase 2.5" the code already flags)

Replace the legacy per-performer `effects: Set<EffectId>` with a single
canonical `effect: EffectType | null`:

- `PerformerSettings.effect: EffectType | null` — `null` = inherit the global
  default; `"none"` = explicitly off; any `EffectType` = that effect.
- Remove `effects` from `DefaultPerformerSettings` entirely. The inherited
  default is the global `config.tipEffectMap["*"].effect` (default `"trails"`),
  resolved at the consumer — no second default store.
- Delete the legacy `EffectId` union and the dead `setDefaultEffects` /
  `toggleDefaultEffect` (zero `.svelte` callers). Unlocks all 16 effects per
  performer (echo/water/bubbles/petals/smoke/ink were unselectable because
  `toPerformerEffect` returned `null` for them).

### Cascade + render wiring

- `avatar-instance-state`: store the override (`settings.effect`), expose
  `rawEffect` (the override, `null` if inherit), `setEffect(effect | null)`,
  `resetEffects()` (→ `null`), `hasOverride.effects = settings.effect !== null`.
  Snapshot/restore become scalar.
- `Viewer3DScene.svelte:406` loop computes the cascade where both sources are in
  scope:
  ```
  const perfEffect = performer.rawEffect ?? globalTipEffectMap["*"]?.effect ?? "none";
  const perfTipMap = { "*": { effect: perfEffect } };
  ```
  Pass `perfTipMap` to `PerformerRig` (line 431) and the `effectsSlot`
  orchestrator (line 454) instead of `globalTipEffectMap`.
- `EffectOrchestrator3D`: delete the `resolved === "none" ? "trails"` fallback
  (lines 378, 446). "none" now renders nothing. Default trails preserved via
  `DEFAULT_EFFECTS_CONFIG.tipEffectMap`.
- `EffectsSettingsPanel` performer mode: radio on
  `rawEffect ?? config.tipEffectMap["*"]?.effect`. Click an effect →
  `setEffect(key)`; click the active one → `setEffect("none")`. Full
  `EFFECTS[]` grid, no hidden effects, no `toPerformerEffect` hack. Global mode
  (no performer) unchanged — still writes `config.tipEffectMap`.

Coven is unaffected — it passes its own explicit `tipEffectMap`.

## Part B — Trail upgrade (presence + smoothness)

- **Smoothness:** replace the hardcoded `subdivisions: 4` (Trail3D /
  TrailRenderer3D) with an adaptive count matching the 2D target:
  `clamp(round(150 / pointCount), 4, 12)`.
- **Presence:** wire the already-computed `resolvedTrails.emissive`
  (`brightness * 2.0`) into the Trail3D mount → `TrailMaterial3D`'s
  `uEmissiveStrength`, scaled up on HIGH/MEDIUM tiers so the HDR core pushes
  past the bloom threshold (LOW keeps the additive halo only). Slightly fatter
  default taper via the existing `tubeRadius` path.
- No envelope, no gradient (out of scope).

## Part C — Color cleanup (rider)

`UnifiedEffectsSection.svelte`: replace the 16 hardcoded `{value,icon,color,
label}` entries with `EFFECTS` / `EFFECT_COLORS` imported from
`effect-registry.ts`. One source of truth everywhere.

## Files touched

Part A: `performer-settings-types.ts`, `avatar-instance-state.svelte.ts`,
`viewer-3d-state.svelte.ts`, `scene-undo-types.ts`, `EffectsSettingsPanel.svelte`,
`Viewer3DScene.svelte`, `EffectOrchestrator3D.svelte`,
`tests/unit/3d/state/avatar-instance-state-settings.test.ts`.
Part B: `Trail3D.svelte`, `TrailRenderer3D.ts`, `EffectOrchestrator3D.svelte`,
`TrailMaterial3D.ts`.
Part C: `UnifiedEffectsSection.svelte`.

## Verification

- `npm run check` clean on all touched files.
- Live screenshot: select a performer in the Performer Hub, pick a non-trail
  effect (e.g. fire), confirm the panel highlights it AND the render switches.
  Pick "none" → nothing renders. Trails visibly smoother + brighter.

## Out of scope

Layered multi-effect per performer; per-performer trail *styling* (styling stays
global via `effectsState.trails`); reconciling the 2D animation-engine effect
panel; fade-envelope / head→tail gradient.
