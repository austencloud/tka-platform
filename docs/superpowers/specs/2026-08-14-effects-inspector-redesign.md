# Effects Inspector Redesign

**Date:** 2026-08-14  
**Status:** Approved for implementation  
**Surface:** Animation panel Effects tab, shared preset presentation

## Problem

The desktop Effects tab reads like a renderer settings form. The effect browser
stays visible while a second presets layer and a third customization layer pile
up beneath it. Preset cards carry a name and one or two color dots, even when
the presets differ mainly by shape, motion, persistence, or emission behavior.

The control implementation also drifted from the approved June consolidation.
The shared manifest and `EffectControlStack` render the current 3D and compact
surfaces, while desktop still lazy-loads bespoke `*Customize.svelte` forms.

## Outcome

- Desktop uses two stable views: the effect browser and the active effect
  inspector. Selecting an effect opens its inspector. Back returns to the
  complete effect browser.
- The inspector starts with visual look cards that communicate the output's
  structure, not a decorative color swatch.
- Original and Your look remain recoverable state anchors. Your look explains
  how it is created when no tuning has been captured yet.
- Primary and tracking controls render from `effect-control-manifest.ts`.
  Fine tuning expands the same shared stack's advanced tier.
- The live animation remains the authoritative preview. Preset and control
  changes continue to apply immediately through `EffectsConfigState`.

## Ownership

- **Reuse:** `EffectsConfigState` for active effect, preset application,
  Original, Your look, persistence, and undo reporting.
- **Reuse:** `effect-control-manifest.ts` and `EffectControlStack.svelte` for
  control definitions, values, keyboard semantics, and writes.
- **Extend:** `EffectPreset` presentation with a deterministic semantic preview
  derived from the preset patch.
- **Compose:** `EffectsInspector.svelte` presents the active registration,
  semantic look cards, state anchors, and the shared control stack.
- **Keep separate:** the compact strip keeps its one-control-at-a-time contract.
  It uses the same state and manifest but is optimized for a short mobile tray.

## Interaction

### Browser

The browser shows all sixteen effects in the canonical registry order. Tapping
the active tile opens its inspector. Tapping another tile activates it and opens
its inspector. An explicit Off button replaces tap-again-to-disable ambiguity.

### Inspector

The header contains Back, the effect icon and name, and an On/Off button. Below:

1. **Looks:** Original, named presets, and Your look.
2. **Tune this look:** primary and tracking controls from the shared manifest.
3. **Fine tuning:** a disclosure for the advanced tier, present only when the
   effect has advanced controls.

The effect grid is not repeated above the inspector.

### Look cards

Each card reserves a fixed preview box and shows:

- a semantic illustration derived from the preset's patch and effect family;
- the look name;
- a compact trait line such as `Plasma · 18 strikes/s` or
  `Starburst · tight glow`.

The illustration is presentation art, not a second renderer. It reads the
canonical preset patch, so changes to style, mode, trigger, palette, or optical
fields update the card instead of drifting behind hand-authored screenshots.
The main canvas remains the exact production render.

## Layout

- Sidebar look cards use two columns at normal desktop widths and three columns
  when the panel container has room.
- Cards keep a fixed preview aspect ratio. Selection and async state changes do
  not resize the grid.
- Essential labels use the 14px minimum. Trait lines may use the 12px compact
  token.
- The active state uses the effect accent for border and a restrained fill.
  Color is never the only cue.
- The global reset moves below tuning with warning treatment and reduced visual
  weight.

## Files

- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
- `src/lib/shared/animation-engine/components/effects-panel/EffectsInspector.svelte`
- `src/lib/shared/animation-engine/components/effects-panel/EffectPresetsSection.svelte`
- `src/lib/shared/animation-engine/components/effects-panel/EffectLookPreview.svelte`
- `src/lib/shared/animation-engine/components/effects-panel/effect-look-preview.ts`
- `src/lib/shared/animation-engine/components/effects-panel/presets/types.ts`
- focused unit tests for deterministic trait and preview derivation

## Verification

1. Unit tests prove each registered named preset produces a non-empty trait line
   and a deterministic semantic preview model.
2. Existing preset matching and personal-look restoration tests remain green.
3. Focused Svelte and TypeScript validation reports no new diagnostics.
4. Runtime checks cover effect selection, Off, Original, named presets,
   Your look creation and restoration, primary tuning, and Fine tuning.
5. Visual verification covers 1920x1080, 2560x1440, 3840x2160, 1440x900,
   820x1180, 960x412, and 375x667. The desktop inspector is inspected at the
   first four sizes; the shared compact surface is inspected at the last three.

## Risks

- A symbolic preview can become decoration if it ignores the patch fields that
  distinguish presets. Tests require distinct preview signatures within each
  preset group where the patches differ.
- Removing bespoke forms can silently lose controls. The manifest's primary,
  tracking, and advanced union is compared with the old surface before the old
  desktop path is retired.
- A large preset grid can push tuning below the fold. Fixed preview height,
  container-driven columns, and the browser-to-inspector transition recover the
  vertical space currently consumed by the repeated effect grid.
