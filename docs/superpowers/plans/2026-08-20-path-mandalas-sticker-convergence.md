# Path Mandalas → Sticker Lab Convergence

**Approved:** 2026-08-20

## Outcome

Sticker Lab becomes the single catalog-to-mandala-shape workspace. Its Shapes
surface supports both solo-prop and combined two-hand browsing, delegates shape
identity to the shared mandala fingerprint owner, and retains Path Mandalas'
inspection and overlap-calibration behavior. The separate Path Mandalas Lab tab
is removed only after saved sticker sheets continue to load through a real
representative sequence reference.

## Capability ownership

- Shared mandala services own geometry, rendering, `shapeKey`, and `orbitKey`.
- Sticker Lab owns catalog shape browsing, sheet mutations, persistence, and
  sticker output.
- Choreo Card's catalog loader remains the source of catalog pages.
- Path Mandalas' `pathMandalaLab.deckTiers` data is not Sticker data. The merge
  neither reads nor deletes that localStorage key.

## Migration

1. Add a feature-local catalog index that adapts solo and combined paths to the
   shared fingerprints. Solo groups use rotation/reflection-invariant orbit
   identity; combined groups preserve exact quantized shape identity.
2. Separate a sticker primitive's geometric identity from the representative
   sequence used to reload its paths. Bump the persisted schema and migrate old
   proxy-keyed records without discarding their source references.
3. Route both Sticker Lab and Sequence Viewer additions through one pure sheet
   mutation owner.
4. Recompose Shape Browser as catalog navigation plus a shape gallery. Preserve
   member drill-down, spotlight inspection, and preview-only overlap controls.
5. Remove the Path Mandalas registration and component after parity.

## Verification

- Unit tests for solo/combined grouping, identity construction, schema
  migration, mutation deduplication, and legacy path hydration.
- Existing Sticker SVG/PDF and shared fingerprint/index tests.
- One full `npm run check` and `npm run build` after focused tests.
- Visual inspection at 1920×1080, 2560×1440, 3840×2160, 1440×900,
  820×1180, 960×412, and 375×667.

## Removal gate

Delete `PathMandalaLab.svelte` and its Lab wiring only when:

- Solo and Combined catalog groups are available in Sticker Lab.
- Combined members can be added and survive a reload.
- Existing v1/v2 sheets migrate without losing sticker configuration.
- Sequence Viewer additions use geometric identity.
- Preview calibration is visibly available but clearly labeled as not changing
  exported sticker output.
