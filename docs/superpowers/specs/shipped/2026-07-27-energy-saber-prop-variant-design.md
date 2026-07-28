# Energy Saber and Energy Staff Premium Prop Pair

**Feedback:** `DVS2RLzH0qdBezLPGIWu`  
**Date:** 2026-07-27  
**Status:** Shipped 2026-07-28 (`2526ce0033` props + premium visibility, `0270db3769` 3D scene-prop seam)  
**Product labels:** Energy Saber, Energy Staff  
**Feedback shorthand:** Lightsaber

## Decision summary

Build the work in two stages.

1. Add three comparable energy-saber concepts to the existing
   `/test/sword-variants` comparison page. This stage changes no saved settings,
   prop enum, picker, or premium behavior.
2. Integrate Core and Twin as a matched premium pair. Core becomes the
   Sword-family Energy Saber. Twin becomes the Staff-family Energy Staff.

The comparison stage is intentionally isolated. It lets the shape, glow, hilt,
small-size readability, and light-theme behavior settle before production data
gains two prop identifiers.

## Confirmed codebase state

Every line below was read in source on 2026-07-27. Where an earlier draft was
wrong, the correction is marked.

- `PropType.SWORD = "sword"` is the production sword identifier in
  `src/lib/shared/pictograph/prop/domain/enums/prop-type.ts`.
- Four asset families exist per prop, and three of them are mandatory for a new
  identifier because separate consumers read separate folders:
  `static/images/props/pictograph/<id>.svg` (pictograph render, via
  `prop-svg-loader.ts`), `static/images/props/animated/<id>.svg` (3D prop plane,
  `PropPlane2D.svelte:38` builds that path unconditionally with no fallback),
  `static/images/props/<id>.svg` (the Flow Arts MCP renderer,
  `mcp-server/src/core/standalone-renderer.ts:515`), and
  `static/images/props/buttons/<id>.svg` (picker tile).
- **Correction:** `static/images/props/variants/` holds **twelve** sword
  concepts, not five. `sword-knight`, `sword-saber`, `sword-flamberge`,
  `sword-claymore`, `sword-khopesh` are the five wired into
  `src/routes/test/sword-variants/+page.svelte`; `metallic`, `kevlar`,
  `hybrid`, `falchion`, `rapier`, `gladius`, `scimitar` are earlier studies that
  the page does not render.
- The animation path treats `sword-*` identifiers as animated-only
  (`isAnimatedOnlyProp` in
  `src/lib/shared/animation-engine/services/svg-generator.ts:204`), because no
  `pictograph/` counterpart was ever authored for them. A production identifier
  ships a `pictograph/` asset and therefore must NOT match that carve-out.
- Motion coloring is shared by browser and Node renderers through
  `packages/render-core/src/svg-color.ts`. `src/lib/shared/utils/svg-color-utils.ts`
  is a re-export facade. SvelteKit consumes the package source. The globally
  wired Flow Arts MCP runs through `tsx` against workspace source, while
  compiled Node consumers use `packages/render-core/dist/`. A production change
  to `SELECTIVE_COLOR_PROP_TYPES` therefore needs focused package verification
  plus a Codex restart for the source-backed MCP.
- `SELECTIVE_COLOR_PROP_TYPES` already lists `sword` plus the five `sword-*`
  concept ids, so the naming convention is established.
- The premium capability exists in both registries as
  `capability:props:premium-cosmetics`
  (`src/lib/shared/subscription/domain/capability-flag-configs.ts:46`,
  `capability-nudges.ts:25`). `checkPremiumGate`, `PremiumBadge`, and
  `PremiumNudge` all live under `src/lib/shared/subscription/`, outside
  `features/premium/`, so they survive the module being off.
- **Correction:** the premium module is `tier: "off"` in
  `src/config/feature-flags.ts:86`, and the comment there states `off` hides it
  in EVERY build, dev included. `__FEATURE_PREMIUM__` is therefore a
  compile-time constant `false` right now, not a runtime switch that dev flips.
  A dev/admin escape hatch has to use a different mechanism (see Picker).
- **Correction:** the live picker is `BentoPropGrid.svelte`, and it reads
  `PROP_PICKER_SECTIONS`, not `VARIANT_PROP_TYPES`. Its docstring says the flat
  grid is deliberately separate from the category and variant maps. Adding the
  new identifier to `VARIANT_PROP_TYPES` / `BASE_TO_VARIANTS` would put it in
  the Sword _variant cycle_ consumed by other surfaces, and
  `getNextVariation()` / `getAllVariations()` are pure functions with no gate of
  any kind. That is a free path to a paid prop.
- **Correction:** the play-earned lock is currently inert.
  `PROP_LOCKING_ENABLED = false` in
  `src/lib/shared/gamification/domain/prop-pool.ts:16`, whose comment reads
  "every prop is selectable from the start". The hazard is the reverse of what
  the earlier draft described: `handleTileClick` in `BentoPropGrid.svelte:73`
  gates on `isPropUnlocked()` **first** and returns early, so if locking is ever
  re-enabled, a premium prop that is in neither `CORE_PROPS` nor
  `UNLOCKABLE_POOL` becomes permanently unclickable.
- Both short-code codecs declare `PROP_TYPE_ENCODE` as an exhaustive
  `Record<PropType, string>` (`sequence-encoder.ts:80`,
  `legacy-sequence-codec.ts:110`), so a new enum member is a compile error until
  it is encoded in both. `sword` is `"W"`. `"R"` is a decode-only compatibility
  alias mapping retired fractalgeng links to buugeng. Unused single characters
  remain in both tables.
- The display registry is also exhaustive
  (`Record<PropType, PropTypeDisplayInfo>`), so a missing label or button asset
  is a compile error too. Every other registry listed under "Silent-fallback
  registries" below is a plain string map with a default, and fails quietly.
- Flow Arts MCP topic `static-props` was called during this workflow. It
  identifies double staves as the canonical TKA prop and identifies the
  consistent thumb and pinky references as the basis of orientation. The
  requirement for visibly different Twin emitters is an implementation
  inference from that canon, not a quoted domain rule.

## Reuse verdict

**Extend `src/routes/test/sword-variants/+page.svelte`. It already covers the
comparison need.**

The concept round will also reuse:

- `applyMotionColorToSvg()` for blue and red rendering;
- the existing dark/light background toggle;
- the existing raw, blue, and red swatch layout;
- the established `sword-*` asset naming convention;
- native SVG gradients and filters.

No new component, state module, service, dependency, or interaction pattern is
needed. Native SVG supplies gradients, masks, and blur filters.

References:

- [MDN SVG filters](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_filters)
- [MDN SVG gradients](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Gradients)
- [W3C SVG filter effects](https://www.w3.org/TR/SVG11/filters.html)

## What the color pipeline actually does

The earlier draft's SVG guidance was directionally right and mechanically
vague. `applyColorToSvg` in `packages/render-core/src/svg-color.ts` is a set of
regex passes, and its exact behavior decides what an energy blade can be made
of.

1. **Only `fill` is rewritten.** The two passes match `fill="…"` and `fill:…`.
   `stroke` is rewritten only when `transformStroke: true`, and no prop path
   passes it. So strokes are a guaranteed color-stable channel.
2. **`stop-color` is never touched.** A region painted with `fill="url(#grad)"`
   does not match either pass, and the gradient's stops are not scanned. A
   gradient-filled blade is therefore frozen and would render identically for
   blue and red. Gradients are for the halo falloff and the hilt, never for the
   region that must carry motion color.
3. **Selective mode inverts the usual intuition.** Every `sword-*` id is in
   `SELECTIVE_COLOR_PROP_TYPES`, so `shouldPreserveColor` runs with
   `selectiveMode: true` and preserves any fill with luminance below 0.4 **or**
   saturation above 0.05. Consequences, exactly:
   - a dark hilt (luminance < 0.4) is preserved with no extra work;
   - a saturated accent (saturation > 0.05) is preserved, including a warm
     near-white such as `#FFF6E8`, which is how a pale core survives;
   - a neutral light fill (`#FFFFFF`, `#E8E8E8`, any pure gray) is **recolored**.
     Pure white is preserved in non-selective mode only. Do not rely on it.
4. **ID suffixing is per call site, and it matters in exactly one path.**
   `id="…"` and `url(#…)` are suffixed only when `makeClassNamesUnique` is set.
   `prop-svg-loader.ts:285` sets it, `standalone-renderer.ts:554` sets it, and
   the comparison page sets it. `svg-generator.ts:389` does not. That gap is
   harmless: the animation and 3D paths rasterize each prop into its own
   `<img>` data URL (`canvas-2d-image-loader.ts:341`), so two props never share
   a document there. The collision risk is real only in the pictograph and MCP
   paths, where both props are inlined into one SVG, and both of those suffix.
5. **Canvas2D rasterizes at viewBox size, then scales.** `createImageFromSVG`
   sets `img.width`/`img.height` to the viewBox dimensions before `drawImage`.
   Filters do render inside a data-URL `<img>`, but a halo authored in a 64-unit
   tall box is resampled when the canvas draws it larger. Author the blade tall
   enough that the glow survives upscaling.
6. **Padding must be symmetric about the prop center.** The torch precedent
   (`IPropTextureLoader.ts:117`) grew its viewBox symmetrically so the hand
   pivot and the trail attachment stayed fixed. Asymmetric padding to fit a halo
   moves the pivot and silently shifts placement, tip reach, and mandala radius.

## Concept set

**Cut from five to three.** The earlier set was four single-blade variants plus
one twin. A, B, C, and D differed only in blade treatment: plain, faint nodes,
ragged edge, side vents. `BentoPropGrid` renders tiles at 52px in flat mode and
79px to 100px in section mode. Faint nodes and an irregular plasma edge are
sub-pixel there, so at the size the choice is actually made, three of the four
would have been the same picture. Guard's difference lived mostly in the hilt,
which is the part a pictograph shows least, and its side vents add width right
at the pivot, where sword's `BIG_BILATERAL_PROPS` beta offset already puts the
other prop close. Pulse and Guard are dropped before authoring rather than
drawn and then rejected.

What remains is a real choice with three distinguishable answers: a clean
single blade, a single blade with personality, and the twin. The twin is the
only one that changes anything but pixels.

All three concepts use the same comparison rules:

- a neutral dark-metal hilt;
- blade energy mapped through the real blue/red motion-color pipeline;
- a pale core that stays readable at small sizes;
- no internal SVG animation;
- no borrowed franchise marks, hilt silhouettes, or names;
- enough viewBox padding to prevent halo clipping;
- a visible blade edge on both dark and light backgrounds.

### A. Core

**Parent:** Sword  
**Recommendation:** Lead candidate

A straight capsule blade with a narrow pale core, one saturated edge, and a
restrained outer halo. The emitter is compact and the grip has two clear bands.

Why it earns a slot:

- reads immediately at picker size;
- keeps the motion-color distinction clear;
- adds little visual noise to pictographs;
- gives animation and export the lowest filter cost of the set.

### B. Rift

**Parent:** Sword

A rigid centerline surrounded by an irregular plasma edge. Two short edge forks
suggest instability without animating or changing the tracked tip.

Why it earns a slot:

- strongest personality in the single-blade group;
- still preserves one stable tip and one stable pivot;
- fits the fun-prop intent without turning the pictograph into a particle scene.

Risk:

- the edge can become visual static below 48 pixels. The compact sample decides
  whether it survives.

### C. Twin

**Parent:** Staff

A centered grip with two equal energy blades extending in opposite directions.
The emitter silhouettes differ so the two ends remain visually trackable.

Why it earns a slot:

- directly tests the staff interpretation requested by the feedback;
- retains the dual-end landmark structure used by staff-family props;
- looks different from every single-blade option.

Risk:

- this is a physical-family decision, not only an art choice. Production must
  use two-tip tracking and staff-family placement.
- **Two symmetric glowing ends erase the landmark the staff family runs on.**
  `.claude/rules/tka-domain.md` puts the whole orientation system on one end
  being a consistent thumb reference and the other a consistent pinky
  reference. Sword solves this with asymmetry, and
  `prop-classification.ts:216` even labels its ends "Tip End" and "Hilt End".
  A perfectly mirror-symmetric twin gives no visual cue for assigning those
  references. Production must strengthen the difference through emitter length
  and cap shape while the blades stay equal.

## Concept-gallery implementation

### Files to modify

- `src/routes/test/sword-variants/+page.svelte`
  - Add an anchored `Energy saber concepts` group before the current sword
    study so the requested decision is visible on entry.
  - Preserve the current sword rows unchanged.
  - Add a compact blue sample beside raw, blue, and red samples.
  - Keep the existing dark/light toggle.
  - Display the parent family and one-line tradeoff for each concept.

### Files to create

- `static/images/props/variants/sword-energy-core.svg`
- `static/images/props/variants/sword-energy-rift.svg`
- `static/images/props/variants/staff-energy-twin.svg`

Concept assets live under `variants/` only. Do not put them in `animated/`
during the comparison stage: `svg-generator.ts` routes `sword-*` ids to
`animated/`, and a file landing there makes the concept reachable by the
animation path before anyone has chosen it.

These files are new because the artwork does not exist internally. The page,
color transform, comparison structure, and UI remain reused.

### SVG contract

- Use a `0 0 width height` viewBox.
- Keep the physical pivot centered in the viewBox.
- Paint every motion-colored blade layer with a flat neutral light `fill` hex
  (saturation at or below 0.05, luminance at or above 0.4). Never a gradient:
  see item 2 of the color-pipeline section.
- Paint the pale core with a warm or cool near-white above the 0.05 saturation
  threshold, or with a stroke. Both survive the fill transform. A pure `#FFFFFF`
  core does not survive selective mode.
- Keep hilt fills below 0.4 luminance so selective mode preserves them.
- Use saturated accent fills only where the color should never change.
- Give every gradient and filter a local ID. The color pipeline will suffix IDs
  and `url(#...)` references for blue and red copies.
- Keep filters inside padded bounds.
- Limit each concept to two blur passes.
- Do not use `<animate>`, `<animateTransform>`, or script.
- Keep each SVG below 12 KB before repository compression.

## Concept-gallery acceptance criteria

- All three concepts load with HTTP 200.
- Each concept renders raw, blue, red, and compact-blue samples.
- Blade color changes between blue and red while the hilt stays neutral.
- No gradient or filter ID leaks across neighboring samples.
- No halo is clipped at the viewBox edge.
- Every concept remains identifiable in the compact sample.
- Dark and light backgrounds both preserve the blade edge.
- The page reports no browser console errors.
- The page has no horizontal overflow at 375 pixels.
- Chrome DevTools MCP checks the page at 1920 x 1080, 2560 x 1440,
  3840 x 2160, 1440 x 900, 820 x 1180, 960 x 412, and 375 x 667.
- The gallery uses the existing comparison page and introduces no new shared
  component.

## Pre-selection build findings

The completed gallery was inspected at every required viewport in dark mode and
again at 1440 x 900 in light mode.

- Core keeps the clearest single-blade silhouette at the real 52px picker
  footprint.
- Rift is visibly different at full comparison size, but its irregular edge and
  forks collapse toward Core at 52px.
- Twin remains the only unmistakably different family at 52px because of its
  center break. Its two emitter silhouettes are clear at full size and marginal
  at picker size, so production needs stronger asymmetry.

## Selection record

The 2026-07-27 selection is final:

- Core is selected as `Energy Saber`, with Sword as its physical parent.
- Twin is selected as `Energy Staff`, with Staff as its physical parent.
- Twin's production emitter shapes must be more visibly asymmetric than the
  concept asset at the 52px picker footprint.
- Rift is not shipping. Its full-size personality disappears at picker size.

Keep all three concept assets as comparison evidence until the two production
props are verified.

## Production integration

### Identifier and family

Create both production identifiers:

- `PropType.ENERGY_SABER = "energy_saber"`
- `PropType.ENERGY_STAFF = "energy_staff"`

Production identifiers deliberately do not begin with `sword-`. That prefix
activates the animation-only concept carve-out in `resolvePropSvgPath()`.

Physical behavior is copied explicitly from each parent across classification,
placement, dimension, and tip registries. Energy Saber follows Sword. Energy
Staff follows Staff. These relationships are not expressed through the existing
variant-cycle maps because those maps have no access gate.

Do not introduce a general prop-skin subsystem for this item. The existing prop
variant registry already owns asset-backed variants, selection, settings, and
display metadata. A skin subsystem would duplicate that path before a second
requirement proves it necessary.

### Production assets

Create both designs in each asset family used by the product:

- `static/images/props/pictograph/<id>.svg`
- `static/images/props/animated/<id>.svg`
- `static/images/props/buttons/<id>.svg`
- `static/images/props/<id>.svg`

Mirror the renderer-facing assets into `mcp-server-pkg/assets/images/props/` so
the fallback renderer stays compatible. The main Flow Arts MCP reads the
repository source assets directly.

### Registry and rendering updates

Two registries are compile-enforced and cannot be forgotten: the display
registry and both `PROP_TYPE_ENCODE` tables. Everything else in this list is a
plain string map with a silent default, which is where a new prop actually
breaks.

- Add both enum values to `prop-type.ts`.
- Add both labels and button assets to `prop-type-display-registry.ts`. Do not
  give either a generic category until every category consumer is access-aware.
- Add both to `PROP_PICKER_SECTIONS` so the tiles appear in `BentoPropGrid`.
- **Do NOT add either prop to `VARIANT_PROP_TYPES`, `VARIANT_TO_BASE`, or
  `BASE_TO_VARIANTS`.** Those drive `getNextVariation()`, an ungated cycle that
  would hand out the paid prop for free on any surface that offers variant
  toggling. The base-family relationship is expressed by the classification and
  tip registries below, not by the variant cycle.
- Add a `PREMIUM_COSMETIC_PROP_TYPES` set and
  `isPremiumCosmeticProp(propType)` beside the display registry. The set
  contains both identifiers.
- Add both identifiers to `SELECTIVE_COLOR_PROP_TYPES` in
  `packages/render-core/src/svg-color.ts`.
- Run the focused `@tka/render-core` build and tests after that edit. Compiled
  consumers read `dist/`; the globally wired Flow Arts MCP reads workspace
  source and picks up the edit after Codex restarts.
- `TWO_ENDED_PROPS` in `prop-tip-ends.ts`: Energy Saber stays out, Energy Staff
  goes in. Note the default is 2, so an omitted Energy Saber silently renders
  two tips.
- `PROP_TIP_POINTS` in `animation-engine/domain/types/prop-tip-points.ts`:
  mandatory. `getTipPoints` falls back to `DEFAULT_TIP_POINTS`, which is
  `STAFF_TIP_POINTS`, so a missing entry makes a single-blade saber trace two
  staff tips at staff reach in trails and mandalas. This is separate from
  `propTipEnds` and both must agree.
- `PROP_DIMENSIONS` in `animation-engine/services/IPropTextureLoader.ts`:
  mandatory. Its own docstring says a stale or missing entry shows up as a size
  pop on first paint; the fallback is 300 x 92.33.
- Prop classification is explicit in the app copy. Add Energy Saber beside
  Sword in `BIG_BILATERAL_PROPS` and Energy Staff beside Staff in
  `SMALL_BILATERAL_PROPS` within
  `src/lib/shared/pictograph/prop/domain/enums/prop-classification.ts`.
  Render-core has only unilateral lists and deliberately treats every unlisted
  prop as bilateral, so there is no bilateral row to edit there. Pin both
  production identifiers as non-unilateral in tests against the render-core
  classifier.
- Note that "bilateral" and "two-ended" are different axes. Sword is bilateral
  for beta offset and single-ended for tip tracking. Copying sword's parentage
  means copying three independent decisions, not one.
- Add end labels for both props next to their physical parent cases in
  `prop-classification.ts`.
- Add voice aliases in
  `src/lib/shared/voice-control/services/interpreters/prop-sub-interpreter.ts`,
  and extend the prop lists in `voice-control/ai/action-catalog.ts` and
  `voice-command-prompt.ts`. Public labels remain `Energy Saber` and
  `Energy Staff`. Energy Saber aliases may include `energy saber`,
  `light saber`, and `lightsaber`. Energy Staff aliases may include
  `energy staff`, `light staff`, `saber staff`, and `double lightsaber`.

### Enumeration leak audit

Adding an enum member also adds it to `getAllPropTypes()` and direct
`Object.entries(PROP_TYPE_DISPLAY_REGISTRY)` consumers. Every raw enumerator
must be reviewed before production exposure:

- `register-global-shortcuts.ts`
- `register-create-shortcuts.ts`
- `PropIndicatorButton.svelte`
- `ArenaBattleView.svelte`
- `AvatarGenerator.svelte`
- `AvatarGeneratorWizard.svelte`
- `getBasePropsByCategory()` consumers in `PropPopover.svelte` and
  `PerformerHubDetail.svelte`

Free users must not reach either premium prop through keyboard cycling, Arena,
avatar generation, 3D prop controls, or a family expansion. Use
`isPremiumCosmeticProp()` at each enumeration boundary. A surface either:

- filters the premium identifier out;
- shows it with `PremiumBadge` and the same hard gate; or
- includes it because `checkPremiumGate()` returned allowed.

`findPropTypeByValue()` must continue resolving the identifier so saved premium
settings and shared data remain readable.

### Picker and premium behavior

Both tiles remain visible in the prop selector with the existing
`PremiumBadge`.

Selection order:

1. In `handleTileClick()`, branch on `isPremiumCosmeticProp(prop)` before
   calling `isPropUnlocked(prop)`. The play-earned unlock state must never
   bypass or replace the premium decision.
2. When `__FEATURE_PREMIUM__` is false, include the tile only when
   `import.meta.env.DEV || isAdmin()` is true. Treat that exposure as
   development/admin preview access and route it directly to the existing prop
   selection callback. Do not present a checkout action whose destination is
   disabled.
3. When premium is enabled, call
   `checkPremiumGate("capability:props:premium-cosmetics")`.
4. If allowed, route through the existing prop selection callback.
5. If denied, show the existing `PremiumNudge` as a hard gate. Do not call the
   selection callback.

Premium access and play-earned access are separate:

- premium cosmetics are not added to `UNLOCKABLE_POOL`;
- `isPropUnlocked()` does not grant or deny premium access;
- the tile shows a crown, not the play-earned lock and `Earn by creating` tip.

### Persistence and sharing

- App settings persistence picks up both enum values through existing
  `bluePropType` and `redPropType` fields.
- Assign the currently unused code `"3"` to Energy Saber and `"4"` to Energy
  Staff in `PROP_TYPE_ENCODE` in both `sequence-encoder.ts` and
  `legacy-sequence-codec.ts`.
- Preserve the old `R` compatibility alias for retired fractalgeng links.
- Add round-trip tests for current and legacy short-code formats.
- Confirm that QR scan prop resolution accepts the new enum value.

### Premium capability

Reuse `capability:props:premium-cosmetics`.

Do not add another capability, nudge, feature-flag config, gate checker, badge,
or premium callout. The current registry entries already name energy-saber
style cosmetics as their intended consumer.

## Production tests

Add tests for silent failure paths:

- SVG color transform scopes gradient and filter IDs for blue and red copies.
- The pale core and neutral hilt survive motion-color replacement.
- Both prop identifiers and their distinct short codes encode and decode
  round-trip in both codecs.
- Classification, dimensions, and tip geometry match each physical parent and
  measured production asset.
- Tip count is one for Energy Saber and two for Energy Staff.
- Premium denial does not call the prop selection callback.
- Premium allowance calls it once.
- Premium cosmetics never enter the play-earned pool.
- Raw prop enumerators never expose either premium identifier without an explicit
  premium, development, or admin access decision.

Visual checks cover the picker tile, paired prop preview, a generated
pictograph through Flow Arts MCP, and animation/export surfaces after the MCP
and app renderers know both assets.

## Out of scope

- Sound effects.
- Blade color chosen independently from the blue/red motion identity.
- User-authored hilts or glow controls.
- A general cosmetic marketplace.
- Shipping the premium module.
- Shipping Rift as a production prop.

## Locked decision

Core and Twin ship together as a premium cosmetic pair. The remaining work is
implementation and verification, not product selection.
