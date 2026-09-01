# Unified Viewer Custom Colors

## Outcome

Tunnel and Mandala share one authored custom color pair. The blue family is
presented as Left and the red family as Right:

| Shared value | Tunnel label | Mandala label |
| ------------ | ------------ | ------------- |
| Blue / left  | Left prop    | Left pathway  |
| Red / right  | Right prop   | Right pathway |

Changing either picker updates both viewers immediately. The pair remains
available while another appearance is selected, but it only affects Tunnel in
Custom mode and Mandala with the Custom palette. Color edits never change those
mode selections.

## Ownership

`createViewerCustomColorState` owns the live pair. It is a small Svelte rune
factory passed to both controllers; there is no module-level reactive singleton.
The shell-owned Tunnel controller creates the state for the sequence viewer,
and every Mandala controller mounted beside it receives that same instance from
`ArtPane`. The Create workspace's focused Mandala panel reads and edits the same
canonical preference while keeping its other Mandala look ephemeral.

`viewer-custom-color-preferences.ts` owns validation, migration, and browser
storage. `LabeledColorPairPicker.svelte` remains the single UI owner.

## Persistence and migration

The canonical preference is versioned under `tka_viewer_custom_colors`.
Legacy Tunnel and Mandala view records remain readable:

1. A valid canonical preference wins.
2. When only one legacy pair differs from its historical default, that authored
   pair wins.
3. When both are authored and differ, Tunnel wins deterministically. Neither
   legacy record is deleted, so the alternate remains recoverable.
4. Otherwise Tunnel, then Mandala, then the canonical dark-stage pair provides
   the seed.

Saved Tunnel artifacts continue carrying their exact pair. Opening one hydrates
the live shared state so Mandala reflects the artifact, but viewing alone does
not replace the canonical preference. Before staging an artifact, the current
preference is materialized; the artifact pair travels through a one-use session
handoff. An explicit picker edit is what persists a new preference.

Embedded editors that opt out of both view and color persistence receive an
ephemeral custom-color state. The focused Create Mandala panel opts into color
persistence only, so its spin, depth, and other look settings remain local.

## Accessibility

Both locations show a visible semantic label and exact hex value in addition to
the swatch. The button accessible name contains the same visible label. Mandala
uses `Pathway colors` as the group name instead of inheriting Tunnel's `Prop
colors` name.

## Verification

- Unit-test normalization, legacy selection, canonical round-trip, and staged
  artifact consumption.
- Unit-test one shared state through both controllers, including mode
  independence and non-persisting artifact hydration.
- Run focused Vitest files with the repository jsdom config and run the scoped
  Svelte/TypeScript check.
- In the live viewer, edit Tunnel Custom and confirm Mandala Custom changes;
  edit Mandala and confirm Tunnel changes. Exercise desktop, mobile, and 4K
  viewports because the longer pathway labels can affect the picker grid.
