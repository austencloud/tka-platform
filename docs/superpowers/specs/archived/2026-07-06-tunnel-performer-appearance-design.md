# Tunnel Performer Appearance — per-performer props + colors

Status: draft for review (2026-07-06). Builds on the tunnel primitive engine
(`docs/architecture/tunnel-looks.md`, `2026-07-06-tunnel-primitives-design.md`).

## Problem

The tunnel overlays symmetry copies ("performers") of the open sequence. Today
every performer is visually identical:

- **Props:** the 2D renderer draws *every* layer with the **global**
  `bluePropType`/`redPropType` (`canvas-2d-animation-renderer.ts:438,496`) — one
  prop image for the whole ring. `AdditionalLayerProps` carries only prop
  *positions*.
- **Colors:** the fire/trail path already colors each layer separately
  (`frame-parameter-builder.ts` `getExtendedPropColors` → `tunnelPropColor`) —
  Rainbow rides this. So the glowing per-performer color exists; it is auto-fanned,
  not pickable, and the prop *type* is uniform.

Austen wants each performer (and ideally each hand) to be able to carry its own
prop + color, with the compose module's granularity and saveable prop-combination
presets — the tunnel as a per-performer costume rig.

## Decision — the "Performer Set" model

Do NOT expose up-to-16 individual performer pickers (32 controls that break when
`fold` changes). Instead: a short **ordered set of performer skins** that the
copies **cycle** through by arm index.

```ts
// tunnel-appearance.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/** One performer's costume: a prop + optional color per hand (compose's PropPreset,
 *  extended with color). */
export interface PerformerSkin {
  blueProp: PropType;
  redProp: PropType;
  blueColor?: string; // "#rrggbb"; undefined = theme/base color
  redColor?: string;
}

export type ColorMode = "rainbow" | "skin" | "mono";

export interface TunnelAppearance {
  /** 1..N skins. Arm k wears skins[k % skins.length]. */
  skins: PerformerSkin[];
  /** rainbow = auto-fan (today's spectrum); skin = each skin's colors;
   *  mono = base blue/red for all. */
  colorMode: ColorMode;
}
```

`skinForArm(appearance, armIndex) = appearance.skins[armIndex % length]`.

- **1 skin** = uniform (today's behavior; the default).
- **2 skins** = alternating props/colors around the ring — composes with the
  Invert/Echo/Speed alternate-arm modulators for free.
- Fully granular: each skin defines each hand's prop + color.
- Orthogonal to geometry: `TunnelAppearance` is **separate** from the symmetry
  `TunnelConfig`. You pick a mandala shape AND an appearance independently. Both
  persist in `tunnel-view-state`.

Rainbow stays as a `colorMode`, not a special case — it overrides skin colors with
the auto-fan.

## Engine changes (the load-bearing work)

### Per-layer prop type
- `AdditionalLayerProps` (`trail-capture-types.ts`) gains optional
  `bluePropType?: string; redPropType?: string` (+ `blueColor?`/`redColor?`).
- `canvas-2d-animation-renderer.ts`: the additional-layers loops (lines ~424, 482)
  use the layer's own prop type instead of the global `params.bluePropType`; fall
  back to global when absent. Prop textures must be preloaded for every distinct
  prop type in the set (`loadPropTextures` per type; cache keyed by prop type).
- `frame-parameter-builder.ts`: thread per-layer prop type through the frame
  params; extend the propColors builder to accept **explicit** per-layer colors
  (colorMode `skin`) alongside the existing auto-spectrum (`rainbow`) and base
  (`mono`) paths.

### Per-layer color
- Mostly present. `getExtendedPropColors` already emits a color per layer; add a
  branch: `rainbow` → `tunnelPropColor` (today), `skin` → the skin's blue/red
  color, `mono` → base pair.
- Prop-**sprite** tint (recoloring the prop art per performer) is DEFERRED — in the
  glowing tunnel the trail/fire color is what reads as "performer color"; the prop
  sprite is secondary. Phase later if wanted.

## Presets + UI

Appearance is a **second preset axis**, using the exact presets-primary /
tuner-secondary shape we shipped for geometry:

- **Built-in appearance presets** (named `TunnelAppearance`s): e.g. *Classic*
  (1 staff skin), *Duel* (2 skins staff vs sword), *Rainbow* (1 skin + rainbow
  colorMode), *Spectrum Swords*, etc. Curated by eye in the playground.
- **Custom + user-saved**: a parallel `tunnel-user-appearances` store mirroring
  the just-shipped `tunnel-user-presets.svelte.ts` pattern (localStorage-backed
  `$state` singleton, hardened on load, add/remove) — keeps geometry presets and
  appearance presets as separate libraries.
- **Granular tuner** (behind Customize): a performer-set editor — add/remove skins,
  and per skin a per-hand prop picker. **Reuse** `BentoPropGrid` /
  `PropSelectionSheet` (the compose per-hand picker) and `PresetChip` for the skin
  chips — do NOT hand-roll a prop picker.
- **Color mode** control: a `SegmentedControl` (Rainbow / Skin / Mono). Move the
  existing "Rainbow spectrum" toggle here (consolidate color control out of
  Effects).

Placement: a dedicated **Appearance** rail section in the Art settings panel
(peer of Tunnel / Effects / Effort / Playback). The per-hand picker is too large
to fold under the Tunnel section without crowding the mandala presets.

## Reuse (never-hand-roll)

| Need | Reuse |
|---|---|
| Per-hand prop picker | `BentoPropGrid.svelte`, `PropSelectionSheet.svelte` |
| Prop-combo chip | `PresetChip.svelte` / `PresetChipBar.svelte` |
| Prop enum + sections | `PropType`, `PROP_PICKER_SECTIONS` |
| Preset store pattern | `tunnel-user-presets.svelte.ts` |
| Presets-primary / tuner UX | the just-shipped `ArtSettingsPanel` tunnel section |
| Single-select color mode | `SegmentedControl` |
| Per-layer trail color | `tunnelPropColor` (rainbow branch) |

## Phasing (ship value each step)

1. **Engine — per-layer prop type.** `AdditionalLayerProps` + renderer + texture
   preload. Prove it by feeding a hardcoded 2-skin set through the playground.
2. **Engine — explicit per-layer color.** `colorMode` branch in the propColors
   builder; Rainbow stays the default.
3. **Model + presets.** `tunnel-appearance.ts`, `skinForArm` cycle, persistence,
   built-in appearance presets, color-mode control.
4. **Granular UI.** Performer-set editor reusing `BentoPropGrid`/`PropSelectionSheet`
   + save-as-appearance-preset.

## Risks / gaps

- **Texture memory / load:** N distinct prop types = N texture sets. Preload +
  cache; cap the distinct-prop count per set (e.g. ≤4 skins) so a dense fold-8 ring
  doesn't thrash. Flag if the fire path chokes on many textures.
- **Prop-sprite tint** deferred (trail color carries the performer identity).
- **Export path:** the offscreen tunnel exporter must thread the same per-layer
  prop/color (it pre-loads layer textures — see `ArtSettingsPanel` export-freeze
  note). Phase 1 must not break export.
- **Reduced motion / perf cap:** appearance adds no copies, so the image budget is
  unchanged; texture load is the only new cost.

## Testing

- `tunnel-appearance.test.ts`: `skinForArm` cycling (1/2/3 skins across arm
  indices), colorMode resolution, appearance preset round-trip.
- Playground: an appearance row on `/test/tunnel-looks` to judge skins/colors by eye.

## Related

`never-hand-roll.md`, `chip-primitives.md`, `no-checkboxes.md`,
`primitive-discovery.md`, `tunnel-looks.md` (ADR), `feedback_3d_prop_color_swap`,
`feedback_reuse_pictograph_renderer`.
