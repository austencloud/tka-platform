# Living Autumn Clearing

## Outcome

Replace Autumn's generic gradient-and-confetti treatment with a composed enchanted dusk clearing. The scene should feel like a place: a harvest moon framed by crooked trees, a dark pond catching its reflection, a perched owl, and leaves that enter from believable branches. The central field stays visually quiet so application content remains legible.

## Authored source material

The tree art comes from the existing curated Forest catalog:

- `dead_04.png`: broad left hero tree
- `dead_05.png`: windswept right hero tree, mirrored toward the clearing
- `dead_06.png`: crooked midground tree

These exact assets and placements are part of the composition. Autumn does not use random species selection, ecological placement, procedural tree generation, `BareTree`, Perlin noise, or newly generated tree art.

## Composition

All positions use normalized scene coordinates and are resolved for the active aspect ratio.

- Deep plum sky shifts to muted ember at the horizon.
- A warm full moon sits behind the upper-left edge of the central opening.
- `dead_06` establishes a hazy midground silhouette.
- `dead_04` anchors the left edge and leans inward.
- A mirrored `dead_05` anchors the right edge and sweeps inward.
- A curved foreground bank frames the lower edge.
- A small off-center pond reflects the moon without occupying the content-safe center.
- One owl perches on the left hero tree. Its eyes blink on a deterministic cycle.
- Leaf release zones align with the authored branches. Respawned leaves enter from those zones instead of the full top edge.

The central quiet zone spans roughly the middle 40 percent of the scene width and the middle 55 percent of its height. Hero silhouettes may frame this zone but must not fill it.

## Motion and interaction

- Trees remain structurally still. Pointer movement adds only a restrained depth offset to the moon, midground tree, and foreground silhouettes.
- Leaves use a continuous breeze plus a fixed-duration eased gust envelope. No noise field is involved.
- Wind presets alter real motion parameters. Density presets alter the real particle count.
- Reduced motion freezes parallax and decorative animation while preserving the complete composed frame.
- Touch receives the composed scene without hover-dependent behavior.

## Implementation scope

Shared backgrounds package:

- Add targeted loading to the existing curated tree image loader so Autumn requests only three assets.
- Add an Autumn composition geometry module with tests for bounds and the quiet zone.
- Add an Autumn scenery renderer for sky, moon, silhouettes, pond, bank, fog, stars, and owl.
- Rework Autumn leaf spawning and wind behavior around authored release zones and real presets.
- Integrate the scene, accessibility, pointer input, and layer visibility in `AutumnBackgroundSystem`.

TKA application:

- Wire Autumn Lab controls to the actual system capabilities.
- Forward preview pointer coordinates through the existing lab canvas shell if needed.

No package publishing is part of this implementation while the shared package checkout contains unrelated uncommitted work. Local package output may be injected temporarily for visual verification and then restored.

## Risks and mitigations

- **4K memory pressure:** keep only snug tree image caches. Do not allocate a stack of viewport-sized offscreen canvases.
- **Asset loading:** render the sky and landscape immediately, then add silhouettes when the three targeted images resolve.
- **Content competition:** test every required viewport with the Lab chrome visible and preserve the central quiet zone.
- **Shared worktrees:** edit only Autumn files, the targeted loader, and the explicitly identified TKA integration files. Do not stage, revert, or publish unrelated changes.

## Verification

- Focused unit tests cover composition bounds, the quiet zone, and the fixed gust envelope.
- Run focused package tests and package type/build checks.
- Run focused TKA checks for modified application files.
- Visually inspect the Autumn Lab at 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, and 375×667.
- At one desktop viewport, verify density, wind, gust, layer visibility, pointer parallax, and reduced-motion behavior.
- Check the browser console for errors before restoring any temporary local package injection.
