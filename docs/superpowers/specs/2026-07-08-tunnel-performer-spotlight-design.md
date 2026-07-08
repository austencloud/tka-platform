# Tunnel Speed — Per-Performer Identity + Spotlight (design)

**Status:** Shipped 2026-07-08. Supersedes the persistent-`speedPattern` model from
`2026-07-08-tunnel-speed-per-performer-design.md` (that morning's presets became
one-tap fills; see below).

## Problem

Two findings on the just-shipped Speed feature:

1. **Presets were weak.** On the default Duo (fold 2) there is one copy, so
   Alternating and Accelerando both collapse to 2× — indistinguishable. They only
   diverge at 3+ copies. Austen: the presets show "no difference" and "the
   per-performer settings are intuitive enough."
2. **Per-performer editing gets unreadable fast.** With Mirror/Flip/fold spawning
   up to 16 copies, you can't tell which copy a row controls. Austen wants each
   performer color-coded (a swatch in the sidebar so you know which two props to
   look for) and a **spotlight**: selecting a performer dims the others in the
   tunnel so the chosen one is unmistakable.

## Decisions

- **Presets → one-tap fills.** Drop the persistent `speedPattern` mode.
  `speedOverrides` (arm → multiplier) is the single source of truth. Alternating /
  Accelerando are buttons that WRITE concrete per-performer values; Reset clears.
  The drawer always shows exactly what each performer got.
- **Color identity.** Each performer row shows a two-tone swatch from
  `tunnelPropColor` — the exact hues the render fans in Rainbow mode (a stable
  identity tag in Uniform, where the render collapses to base blue/red).
- **Spotlight.** Selecting a performer (click a row) sets a transient
  `selectedArm`; every other family dims in the render. Click again to clear.

## Model (`tunnel-config.ts`)

- `speedPattern` removed. `speedOverrides: Record<arm, multiplier>` only;
  `effectiveSpeed(cfg, arm) = overrides[arm] ?? 1`.
- `speedFill(kind, count)` produces the concrete override map for a fill
  (`alternating` = the legacy `[1,2,0.5]` cycle; `accelerando` = slow→fast sweep);
  only non-1× arms stored, so the map + `configKey` stay minimal.
- `resolveSpeedOverrides(raw, count)` migrates every older shape at load: current
  `speedOverrides`, the short-lived `speedPattern`, and the legacy boolean `speed`.
- `configKey`/`configsEqual` are overrides-only.
- Spotlight helper (`tunnel-prop-colors.ts`): `spotlightFactor(selectedArm,
  familyIndex)` → 1 for the selected family (0 = base, k = copy arm k), else
  `SPOTLIGHT_DIM` (0.12); `dimHex(hex, factor)` scales a color toward black.

## Controller (`tunnel-view-controller.svelte.ts`)

`applySpeedFill(kind)`, `setPerformerSpeed(arm, rate)` (setting 1× clears the
override), `resetSpeed()`, `hasSpeedOverrides`, `selectPerformer(arm)` (toggle),
`selectedArm` (transient — not in the config/persistence), and a `speedPerformers`
derived (rows: arm, label, rate, blueHex, redHex). An `$effect` drops a stale
`selectedArm` when the cast shrinks so a dangling selection can't dim everyone.

## UI (`ArtSettingsPanel.svelte`)

Speed section: a Fill row (`FilterChipBase mode="action"` × Alternating /
Accelerando / Reset) over a per-performer list. Each row = a select button
(two-tone swatch + label) + the `[¼× ½× 1× 2× 4×]` `SegmentedControl` ("You" is a
locked 1×). The selected row is highlighted; a hint names the spotlit performer.
No new primitives; reserved widths + `tabular-nums` keep the layout stable.

## Render spotlight (the ~10-file thread)

A `tunnelSelectedLayer: number | null` rides the exact path `tunnelSpectrum`
already travels (AnimatorCanvas → CanvasSurface → AnimatorProps →
`RenderPropsState`/`RenderSceneParams`/`TrailOverlayRenderParams`). Because the
stage is black, "dim" = scale a non-selected family toward black at the four
independent color sites (no single choke point):

- **Trails** (`trail-overlay-web-gl2`): scale each tip's envelope by
  `spotlightFactor` (base = family 0, layer i = family i+1).
- **Prop glyphs** (`canvas-2d-animation-renderer`): multiply `globalAlpha` per
  base/layer draw.
- **Fire flame** (`frame-parameter-builder.getExtendedPropColors`): scale each
  family's `rgb01` (selection added to the cache key).
- **Tip-effects** (`animation-render-loop.resolveTipColor`): `dimHex` the result.

## Deferred

LED tip dimming (niche) · per-performer speed + spotlight in the video export
(export path unaffected, as before). This per-performer identity is the data
`project_tunnel_choreo_reconstruction` will consume.

**Update (same day):** the base ("you", arm 0) is now speed-editable too — the
`arm < 1` guard was lifted so `speedOverrides[0]` applies in `basePropsAt`, and
`coerceSpeedOverrides`/`speedKey` accept arm 0. Every pair can be tuned, so the
mandala can be speed-symmetric with no pair stuck at 1×. The drawer's base row is
a full ×-ladder like the copies (no locked "1×").

## Tests / verify

`tunnel-config.test.ts` (overrides-only `effectiveSpeed`, fills, migration,
`configKey`), `tunnel-prop-colors.test.ts` (`spotlightFactor`/`dimHex`),
`performer-ring-model.test.ts`. Full `npm run check` = 0/0; tunnel unit tests
47/47; rig routes 200. On-screen dim/swatch is Austen's live confirm (in-app
viewer panel; not a curl-able route).
