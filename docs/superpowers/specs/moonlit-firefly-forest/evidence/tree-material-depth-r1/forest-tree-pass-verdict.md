# Forest tree material and depth verdict

## Result

The downstream tree failure was caused by runtime treatment, not broken Poly Haven source channels. The correction preserves the source luminance structure, lowers repeated Jacaranda use, preserves near-frame foliage resolution, and avoids the geometric shadow islands produced when alpha-card crowns cast through the current optimized multi-material path.

## Measured outcomes

- Visible Jacaranda atlas sample: 264,113 pixels at the production alpha cutoff.
- Pixels brightened by the Day foliage grade: 0%.
- Luminance standard-deviation retention: 100%.
- P90/P10 contrast retention: 100%.
- Exact Jacaranda placements: 118 before, 74 after, a 37.29% reduction.
- Authored source variants: 8 across 295 environment trees.
- Environment runtime: 4 instanced tree nodes, 295 instances, 4 unique source meshes, and 38,528,996 estimated tree-triangle submissions per render pass.
- Near-frame runtime: 4 tree nodes, 4 instances, 3 unique source meshes, and 410,672 estimated tree-triangle submissions per render pass.
- Optimized assets: 17,066,972-byte environment GLB and 13,382,036-byte near-frame GLB.
- Near-frame foliage base-color and normal maps remain 1024px; response maps remain compact.

## Shadow decision

Full near-frame tree casting was tested and rejected because the optimized alpha-card crowns produced large geometric shadow islands on the clearing. Near-frame trees receive light and shadow depth; rocks and deadwood cast. This keeps useful contact structure without reintroducing the polygon carpet.

## Verification

- Forest atmosphere, foliage-grade, and shadow-role tests: 14/14 passed.
- Environment GLB contract: passed.
- Near-frame GLB contract: passed.
- Svelte check: 0 errors and 0 warnings.
- Fixed Day hero, close trees, Day world, Night hero, 375px phone, and 960x412 landscape views were inspected in the in-app browser.

The remaining visual ceiling is the inherent canopy density and silhouette quality of the selected source trees. The washed-out abstract-painting failure is no longer present.
