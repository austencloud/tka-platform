# Tunnel Cast Removal — Design

**Date:** 2026-07-08
**Status:** Shipped 2026-07-08
**Area:** `src/lib/shared/sequence-viewer/tunnel/*`, `ArtSettingsPanel.svelte`

## Problem

The tunnel "Cast" tab (per-performer appearance, shipped 2026-07-06) confused
users and earned its removal. Two root causes, both from Austen:

1. **Two different "performer" counts collided.** The Cast tab's roster had an
   "Add performer" button (`addSkin`) that added a costume slot but changed
   nothing on screen — because the *rendered* copy count comes from the tunnel
   effect config (`imageCount` = fold × mirror × flip), not the roster. "When I
   add performers it doesn't actually change anything because I actually have to
   change the tunnel effect in order to make the tunnel different."
2. **Built-in casts hijacked the prop type.** `APPEARANCE_PRESETS`
   (Solo/Duel/Troupe/Fans/Hoops) each hardcoded a prop — Fans→fan, Hoops→minihoop,
   Duel→sword, Troupe→club+fan, and even Solo→staff (wrong if the global prop
   isn't staff). A named button silently rewriting your prop is the wrong pattern;
   nobody opens the tab wanting "make everyone hold fans." "It is unlikely people
   will use these in this way."

Plus a copy bug: the tunnel preset picker was labeled **"Choose a mandala"** —
but "Mandala" is a *separate* art type with its own presets.

## Decision

Rip out the entire per-performer appearance feature. Tunnel copies always use the
viewer's global prop. Keep only the tunnel symmetry presets + the Customize tuner
(the tuner's Performer Ring is unaffected — it visualizes the real copy count,
which is the *correct* place "performers" appears). Rename the mislabeled preset
copy.

The average person's tunnel mental model is "my sequence, mandala'd, with **my**
prop" — which the global prop already delivers. Per-copy different props is an
inherently niche aesthetic that isn't worth the confusion it caused.

## Changes

**Deleted:**
- `AppearanceSection.svelte` — the Cast editor UI
- `tunnel-appearance.ts` — `APPEARANCE_PRESETS`, `PerformerSkin`, `TunnelAppearance`,
  `skinForArm`, `copyPropTypes`, `coerceSkins`, `skinsEqual`, `DEFAULT_APPEARANCE`, `MAX_SKINS`
- `tunnel-appearance.test.ts`
- `tunnel-user-appearances.svelte.ts` — the saved-cast store

**Edited:**
- `tunnel-view-controller.svelte.ts` — removed `skins`, `appearanceCustomized`,
  `activeAppearancePresetId`, `centerSkin`/`centerBluePropType`/`centerRedPropType`,
  `syncCenterToGlobal`, `setSkinProp`/`addSkin`/`removeSkin`/`applyAppearance`/`resetAppearance`,
  the `#globalBlue/RedProp` fields. `additionalLayersAt` no longer sets per-layer
  prop types → every copy inherits the global prop. `spectrum` kept.
- `TunnelArtView.svelte` — center pair passes the global prop straight to the
  canvas (dropped the `appearanceCustomized`/`centerBlue` indirection + the
  `syncCenterToGlobal` effect).
- `tunnel-view-state.ts` — dropped `skins`/`appearanceCustomized` from persisted
  state; a stored `section: "appearance"` migrates to `"tunnel"` (no dead tab).
- `ArtSettingsPanel.svelte` — removed the `Cast` rail tab, `"appearance"` from
  `TunnelRailId`, the appearance branch, and the `AppearanceSection` import.
  Relocated the **Rainbow / Uniform** color toggle (`controller.spectrum`, a real
  tunnel color mode) into the **Effects** section — it formerly lived in Cast.
  Renamed "Choose a mandala" → "Choose a tunnel preset" (+ aria-label, save
  placeholder, comments).

**Left alone (deliberate):** the shared **additional-layers** render plumbing
(`AdditionalLayerProps.bluePropType`/`redPropType`, `perLayerTypes`,
`loadAdditionalLayerPropTextures`) predates the cast, is shared, and its
export-side files were another agent's in-flight work. Its per-layer prop-type
fields stay optional and simply go unused — the tunnel never sets them.

## Verification

- `npm run check` → 0 errors, 0 warnings
- `vitest run src/lib/shared/sequence-viewer/tunnel` → 39/39 pass (incl. the 11
  Performer Ring tuner tests — tuner unaffected)
- `curl https://localhost:5173/test/tunnel-looks` → HTTP 200

## Non-Goals

- No change to the symmetry model, baking, sampling, or video export.
- The Customize tuner (Performer Ring, Copies ×N) is unchanged.
