# Semantic Summer Tree Wave R2 Verdict

Status: candidate-only. No Forest production asset, layout, runtime material, or scene file was changed.

## Bottom line

R2 proves that Meshy trees can retain separate bark and foliage controls after composition. It also produces six readable summer silhouettes instead of one repeated tree. It does not prove that Meshy should replace the Poly Haven near-field trees across the board.

Three candidates clear the visual gate as useful near-to-mid assets: beech, birch, and tulip tree. Hickory and sycamore are useful at mid or far distance. Hornbeam keeps a recognizable fluted form, but its source atlas still contaminates some branch and canopy surfaces. It should not enter a hero or walk-up placement.

| Candidate | Visual verdict | Honest role |
| --- | --- | --- |
| Cathedral European beech R2 | Broad oval crown, visible scaffold limbs, controlled roots. Leaf masses remain coarser than the Poly Haven reference. | Near, mid |
| Fluted European hornbeam R2 | Distinct compact form and fluted trunk. Residual warm material contamination remains visible inside the crown. | Mid, far only |
| Airy silver birch | Strongest species read in the wave. White bark, narrow crown, and open spacing survive close inspection. | Near, mid |
| Tall tulip tree R5 | Tall clean trunk and broken crown give the palette a needed vertical silhouette. | Near, mid, far |
| Shagbark hickory | Strong upright mass and dark bark. Canopy clumps are still broad and repeated. | Mid, far |
| Mottled American sycamore R2 | Pale mottled scaffold and wide crown read clearly. Some foliage remains rounded and fused. | Mid, far |

The requested willow was not accepted. Three willow attempts produced fused hanging curtains. Eastern cottonwood then produced a mostly bare crown with cotton-like tassels. Tulip tree became the ecologically coherent fallback after those repeated failures.

## Paid generation ledger

- 13 Meshy 6 geometry previews at 20 credits each: 260 credits.
- 6 PBR refinements at 10 credits each: 60 credits.
- Total: 320 credits against the authorized 400-credit cap.
- Balance at wave start, inferred from final balance plus recorded spend: 1,975.
- Final balance: 1,655.
- Every preview and refinement task ID is recorded in `meshy-tasks.json` and `semantic-wave-r2-metrics.json`.

## Asset contract

Each accepted runtime GLB contains one mesh with two primitives and two materials: Bark and Foliage. Both materials have base-color and normal textures. Metallic is zero, roughness is at least 0.88, and emission is absent. The files range from 1.43 to 1.99 MiB and from 98,059 to 103,322 triangles.

The semantic split ranges from 2.34% to 4.86% bark triangles. This is enough for independent grading, wind exclusion, and shadow policy without returning to the failed single-atlas treatment.

## Evidence

- `semantic-contact-sheet.png`: final front, three-quarter, silhouette, human-height, and bark/root proofs.
- `preview-contact-sheet.png`: accepted geometry before paid refinement.
- `raw-contact-sheet.png`: refined Meshy output before semantic separation.
- `semantic-wave-r2-metrics.json`: GLB structure, dimensions, hashes, material settings, credit totals, and all task IDs.
- `semantic-split-metrics.json`: per-candidate bark and foliage triangle counts.
- `forest-semantic-summer-r2.blend`: six-candidate neutral review composite in `blender/candidates`.

`node scripts/verify-forest-semantic-tree-wave-r2.mjs` passed every structural, material, size, triangle, semantic-split, and credit-ledger assertion.

## Production recommendation

Keep this wave isolated. Use the beech, birch, and tulip tree in a registered Forest composition proof beside the strongest Poly Haven assets. Place hickory and sycamore behind that layer. Exclude hornbeam from near-frame work unless its source geometry is separated by authored mesh groups rather than atlas inference.

The wave improves species variation and semantic control. Poly Haven remains the stronger source for leaf-scale fidelity at walk-up distance.
