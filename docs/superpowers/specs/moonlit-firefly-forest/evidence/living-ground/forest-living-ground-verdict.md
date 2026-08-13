# Forest Living Ground Verdict

Status: implemented and visually accepted by the production agent on 2026-08-12.

The Forest now uses a continuous world-space ecological atlas instead of a
flat olive floor or polygon-by-polygon material islands. The runtime combines
the existing Autumn living-grass PBR family with three CC0 Poly Haven Forest
families through one causal mask:

- neutral transition soil;
- living summer meadow;
- canopy leaf litter;
- damp runoff soil.

The mask is authored from the existing path, tree, habitat, stage, campsite, and prop contracts. Tree contact, deadwood decomposition, drainage, foot traffic, stage wear, and campsite wear therefore respond to scene causes instead of decorative scatter.

Walking-distance detail is independent of the 400-metre macro atlas. A world-space shader blends the four surface families at 2.8 and 7.4 metre frequencies and derives restrained surface normals from the blended detail. The Blender floor keeps its PBR normal and roughness maps. Physical grass remains habitat-masked and now reads as fuller summer sward without invading the performance core or paths.

## Proof

- Ground atlas: 4096 × 4096, 4,229,077 bytes, 52.69 luminance range, 51.01 average chroma.
- Runtime family mask: 1024 × 1024, 440,401 bytes.
- Environment: 17,067,076 bytes; one continuous terrain material; 0.380 m verified living-ground relief; 4.8 m flat performance core.
- Near frame: 12,351,892 bytes; 3,292 grass clumps across 15 authored habitat patches; 149 mushroom parts.
- Ecological population: 295 trees, 339 plants, 21 habitat patches, and 47 trail samples.
- Focused unit verification: 33 tests passed.
- Svelte verification: 0 errors and 0 warnings.
- Fresh Day and Night browser loads: 0 console errors.

## Visual evidence

- `forest-living-ground-day-r234.png`
- `forest-living-ground-floor-r229.png`
- `forest-living-ground-night-r231.png`
- `forest-floor-ecology-mask.png`

The locked Night lighting values were not edited. The new ground keeps its authored albedo under that master instead of receiving the daylight material-grade path.

## Night specular regression, 2026-08-12

Production playback exposed a silver stipple across the moon-facing half of the
clearing. The ground-detail strength controlled albedo variation, but the
shader-added normal perturbation remained at full strength. The baked meadow
roughness map also contained low values that could resolve as thousands of
small highlights under the Night key.

The runtime patch now owns normal and roughness response as well as color
detail. Night attenuates both the baked and shader-added normal response and
enforces a 0.96 roughness floor. Day retains the stronger walking-distance
relief with a 0.82 roughness floor. The Night lighting configuration remains
unchanged.

- Regression test: 2 of 2 focused ground-detail tests passed.
- Svelte verification: 0 errors and 0 warnings.
- Browser proof: the former silver field and hard highlight boundary are absent
  in the Night hero view; the Day hero retains its path and habitat detail.
- Evidence: `forest-living-ground-night-dry-r235.png` and
  `forest-living-ground-day-dry-r236.png`.
