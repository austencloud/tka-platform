# Menagerie effect — split creatures out of Silk

**Date:** 2026-07-06
**Status:** Design approved, spec under review
**Related:** `effects-earn-their-slot.md`, `never-hand-roll.md`, effects-unification project

## Problem

Silk carries a hidden `form` axis: `"ribbon"` (velocity ribbon) vs `"serpent"`
(a fixed-length creature whose head is the prop tip). `form` is a **mode
discriminator** — it decides which of Silk's other fields even render. That fork
produced a shipped bug: `applyPreset` shallow-merges `{...current, ...patch}`,
and the 6 ribbon presets omitted `form`, so selecting Dragon (`form:"serpent"`)
then a ribbon preset left `form` stuck on `"serpent"` — the ribbon palette
painted onto the serpent creature, with no obvious way back to ribbon. The
immediate leak was patched (every silk preset now pins `form`, guarded by a
test), but the underlying fragility — one effect wearing two skins — remains:
every future preset must remember to pin the mode, the Customize panel forks its
fields by `form`, and the preset row mixes "Classic ribbon" with "Dragon
creature" under one identity.

The creature mode also **earns its own slot** (per `effects-earn-their-slot.md`)
and should not live as a Silk sub-mode.

## Decision

Split the creature mode out of Silk into a new effect, **Menagerie**. Silk
returns to a single-purpose velocity ribbon. Menagerie owns the creatures.

Locked choices (from brainstorming, 2026-07-06):

- **Name:** Menagerie (container concept — "a collection of animals"; scales as
  more creatures are added).
- **Creatures:** Snake · Dragon · **Caterpillar** (new — completes the comedic
  triad: two cool sinuous reptiles + one absurd segmented bug).
- **Roster:** Menagerie **replaces Frost**. Roster stays at 16 effects.
- **Icon / color:** `fa-dragon` / `#3aa655`.
- **Frost retirement:** **staged** — remove from roster now, delete dormant code
  in a follow-up spec.

## Earns-its-slot statement

- **Unique observable:** the prop tip becomes the **head** of a living creature
  whose fixed-length body follows and undulates behind the motion — embodiment /
  character. No other effect renders a persistent creature.
- **Confusable with:** Silk (now a pure velocity ribbon). Mechanically distinct —
  fixed-length follow-the-leader chain + travelling-wave undulation + creature
  ornament vs a velocity-scaled, lifetime-faded ribbon. Trails / Ghost are path /
  afterimage, no character.
- **Test:** "Menagerie is a tweak to Silk" is false — different render model, not
  a parameter change. Passes.

## Architecture

### The renderer extraction

`src/lib/shared/effects/renderers/silk-2d-renderer.ts` is ~800 lines: ~330
ribbon, ~470 serpent. The two paths share only the Catmull-Rom spline helpers
(`traceForward` / `traceBackward`), palette resolution, and the emitter-iteration
frame.

1. Extract the shared spline helpers into
   `src/lib/shared/effects/renderers/ribbon-trace.ts` (pure functions, no
   behavior change). Imported by both renderers.
2. **Silk** keeps only the ribbon path. `Silk2DRenderer` drops the serpent
   branch (`renderSerpent` / `drawSerpent` / `drawDorsalCrest` / `drawWhiskers` /
   `drawSerpentHead` / `serpentWidth` / `hashPhase` and the serpent chain state).
3. **Menagerie** gets a new `menagerie-2d-renderer.ts` = the extracted serpent
   code, verbatim behavior, plus the Caterpillar ornament branch.

Isolation check: after the split each renderer has one clear purpose (Silk =
velocity ribbon; Menagerie = creature chain), a single param interface, and no
shared mutable state. Either can be understood and tested without the other.

### The intent split

`SilkIntent` loses `form`, `creature`, `bodyLength`, `slither`. It keeps
`intensity / width / duration / flutter / tautness / palette / customColor /
trackingMode`.

New `MenagerieIntent`:

```ts
export interface MenagerieIntent {
  /** Which creature ornaments the chain. */
  creature: "snake" | "dragon" | "caterpillar";
  /** Named palette (same registry as silk). "custom" uses customColor. */
  palette: "satin" | "velvet" | "ethereal" | "shadow" | "gold_leaf" | "ember" | "custom";
  /** Hex - used only when palette === "custom". */
  customColor: string;
  /** 0-1. Overall opacity + width multiplier. */
  intensity: number;
  /** 0-1. Base body half-width. */
  width: number;
  /** 0-1. Body length. Maps to ~120-480px fixed arc-length. */
  bodyLength: number;
  /** 0-1. Undulation amplitude (the wag). Ramps 0 at head → max at tail. */
  slither: number;
  /** Which staff end(s) the creature tracks. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

### Palettes

`menagerie-palettes.ts` reuses the silk palette registry swatches (satin /
velvet / ethereal / shadow / gold_leaf / ember + custom derivation). If the
registry is shared verbatim, hoist it to a common module rather than copy it
(never-hand-roll). Same `resolveSilkPalette` logic, renamed / shared.

### Caterpillar ornament

Same fixed-length chain + travelling-wave locomotion as snake/dragon. New
`creature === "caterpillar"` branch:

- **Body:** segment banding — alternating tint rings along the body (reads as
  segments). Tiny leg-nubs: short strokes perpendicular to the body at each
  segment, alternating walking phase.
- **Head:** rounded, two forward-curling antennae (thinner than dragon horns),
  plain eyes, no tongue, no crest, no whiskers.
- **Stretch (not core):** inchworm vertical-arch locomotion. Ships as lateral
  slither like the others for v1.

### Params / translator

New `Menagerie2DParams extends MenagerieIntent` with the derived serpent extras
currently on `Silk2DParams` (`resolvedPalette`, `baseHalfWidth`,
`motionReferenceSpeed`, `bodyLengthPx`, `segmentCount`, `slitherAmpPx`).
`Silk2DParams` drops those serpent-only extras. `canvas2d-translator.ts` gains a
`menagerie` branch; the silk branch loses the serpent derivations.

### Wiring seams (the standard "add an effect" surface)

- `effect-registry.ts`: add `{ id: "menagerie", label: "Menagerie", icon:
  "fa-dragon", color: "#3aa655" }` to `EFFECTS`; add `menagerie` to
  `presetGroups` + `customizeLoaders`. **Remove the `frost` meta entry** from
  `EFFECTS` (its preset-group / customize-loader map entries become dead but
  harmless — registration loops over `EFFECTS`).
- `effects/registry.ts` (renderer registry): register the Menagerie renderer;
  Frost renderer registration goes dormant (unreferenced).
- `effects-config.ts` + `defaults.ts`: add `MenagerieIntent` + default; add
  `menagerie: null` to `activePresets`. Keep `FrostIntent` + default in place
  for now (dormant — removing it forces touching the WebGL passes; deferred).
- `canvas2d-types.ts` + `canvas2d-translator.ts`: add Menagerie params + branch.
- `effect-primary-param.ts`: add Menagerie primary param (e.g. `bodyLength` or
  `slither`).
- `menagerie-presets.ts` + `MenagerieCustomize.svelte`: new files (see below).

### Presets

`menagerie-presets.ts` (`MENAGERIE_PRESETS`) — lean, one clear anchor per
creature plus a couple of palette variants:

- **Serpent** — snake / velvet (was silk-serpent).
- **Dragon** — dragon / ember (was silk-dragon).
- **Caterpillar** — caterpillar / (green-leaning palette; ethereal or a fitting
  swatch).
- Optional palette variants (e.g. Basilisk = snake/shadow, Wyrm = dragon/gold) —
  kept to ≤5 total. Every preset pins `creature` (the mode discriminator — same
  invariant that fixed the silk bug), enforced by a guard test.

Silk's own presets: the 2 serpent presets (`silk-serpent`, `silk-dragon`) are
removed from `SILK_PRESETS`; the 6 ribbon presets stay (they already pin
`form:"ribbon"` from the leak fix, which becomes moot once `form` leaves
`SilkIntent` — drop the now-dead `form` key from those patches in the same pass).

### Customize panels

- `MenagerieCustomize.svelte`: Palette, Creature (Snake / Dragon / Caterpillar),
  Tracking, Intensity, Width, plus Advanced (Length, Slither). No `form` toggle.
  Reuses `OptionChipRow` + `AdvancedControls` (existing primitives).
- `SilkCustomize.svelte`: drop the Form row, the Creature row, and every
  `form === "serpent"` conditional. Flat ribbon controls (Palette, Tracking,
  Intensity, Width, Flutter, Advanced: Duration, Tautness).

## Migration (v29 → v30)

One version bump, two independent operations, mirroring the established
rename/move migrations (motion→echo v6, water→goo v27, echo→ghost v29):

1. **Silk serpent → Menagerie.** If persisted `silk.form === "serpent"`:
   - Create `menagerie` config from silk's serpent fields:
     `{ creature: silk.creature, palette: silk.palette, customColor:
     silk.customColor, intensity: silk.intensity, width: silk.width, bodyLength:
     silk.bodyLength, slither: silk.slither, trackingMode: silk.trackingMode }`
     (missing fields fall back to `DEFAULT_EFFECTS_CONFIG.menagerie` via the
     merge).
   - Reset silk to ribbon: delete `form / creature / bodyLength / slither` from
     the silk block (the merge reseeds silk's own defaults).
   - Rewrite `tipEffectMap`. A tip assignment stores only the effect id, and
     there is exactly one silk config, so `silk.form` is **global** — if it was
     `"serpent"`, every silk-assigned tip was rendering the creature. So the
     rule keys off the global form at migration time: when `silk.form ===
     "serpent"`, remap **all** `effect: "silk"` tip entries → `"menagerie"`.
     When it was `"ribbon"`, leave silk tips as `silk`. (No per-tip ambiguity —
     there was never a per-tip form.)
   - `activePresets`: `silk-serpent` / `silk-dragon` → `menagerie-serpent` /
     `menagerie-dragon`. `activeEffect`: if `=== "silk"` and the global form was
     serpent → `"menagerie"`.
2. **Frost retirement.** Neutralize persisted Frost usage so no saved sequence
   references a dead effect:
   - `tipEffectMap` entries `effect: "frost"` → removed (tip falls back to none).
   - `activeEffect === "frost"` → `"none"`.
   - `activePresets.frost` → dropped.
   - `frost` config block + default stay (dormant) — not deleted this pass.

Serpent users keep their creature look under the new id. Frost users lose Frost
(the intended retirement). Ribbon Silk users are untouched.

Add the `// v29 → v30:` comment block to `migrations.ts` and bump
`EFFECTS_CONFIG_VERSION`.

## Frost retirement — staged rationale

Frost is not only a 2D canvas effect: it has a WebGL / render-graph path
(`web-gpu-backend`, `web-gl2-backend`, `shader-library`, `effect-passes`,
`render-pass`, `frost-overlay-renderer`, `effect-translators`, `webgl3d-*`). A
full physical deletion is cross-cutting and touches the render graph. Mixing that
into the new-effect change bloats blast radius and risks regressions in unrelated
GPU paths.

- **This spec:** remove Frost from the roster (`EFFECTS`) + neutralize persisted
  usage via migration. Frost code goes dormant (unregistered, unreachable from
  UI). Reversible.
- **Follow-up spec:** physically delete dormant Frost code (2D renderer, WebGL
  passes, shaders, palettes, customize, `FrostIntent`, tests) once the roster
  change is confirmed stable.

Rejected alternative: full delete now — larger, riskier, less reviewable diff.

## Testing

- **Menagerie preset guard:** every `MENAGERIE_PRESETS` patch pins `creature`
  (same class of invariant that fixed the silk `form` leak).
- **Migration unit test:** (a) serpent silk config → menagerie with fields
  carried, silk reset to ribbon; (b) ribbon silk config untouched; (c) frost
  `tipEffectMap` / `activeEffect` / `activePresets` neutralized; (d) a config
  already at v30 passes through unchanged.
- **Renderer extraction is behavior-preserving:** move the existing
  `silk-2d-renderer` serpent tests to `menagerie-2d-renderer.test.ts`;
  `silk-2d-renderer.test.ts` keeps only ribbon assertions.
- **Registry / preset-data counts:** `effect-registry.test.ts` and
  `preset-data.test.ts` updated — still **16** effect groups (Frost out,
  Menagerie in).
- **Caterpillar:** a smoke test that `creature: "caterpillar"` renders without
  throwing (the ornament branch is exercised).

## Components created / changed

**Created:**
- `renderers/menagerie-2d-renderer.ts` (+ `.test.ts`) — grep found no existing
  creature/chain renderer; this is the extracted serpent code.
- `renderers/ribbon-trace.ts` — shared spline helpers hoisted from silk renderer.
- `domain/menagerie-palettes.ts` — or a shared palette module both silk +
  menagerie import (prefer sharing over copying).
- `presets/menagerie-presets.ts`.
- `customize/MenagerieCustomize.svelte` — reuses `OptionChipRow` +
  `AdvancedControls` (existing primitives; nothing hand-rolled).

**Changed:**
- `silk-2d-renderer.ts` (drop serpent), `silk-presets.ts` (drop 2 serpent
  presets + dead `form` key), `SilkCustomize.svelte` (drop form fork),
  `effects-config.ts` (SilkIntent trim + MenagerieIntent), `defaults.ts`,
  `canvas2d-types.ts`, `canvas2d-translator.ts`, `effect-registry.ts` (add
  menagerie, remove frost meta), `effects/registry.ts`, `effect-primary-param.ts`,
  `migrations.ts` (v30), `preset-data.test.ts`, `effect-registry.test.ts`.

## Out of scope (follow-up)

- Physical deletion of dormant Frost code (own spec).
- Menagerie 3D / WebGL path (this spec is 2D-canvas only — matches where the
  serpent renderer lives today).
- Inchworm vertical-arch caterpillar locomotion (stretch).
- Additional creatures beyond the initial three.
