# Semantic Summer Tree Family R1 — Candidate Verdict

Candidate-only proof. No Forest layout, production GLB, runtime material, scene component, or static prop layout was changed.

## Verdict

The semantic pipeline is a clear improvement over the previous single-material Meshy workflow. Each surviving tree has independently controllable bark and foliage primitives, separate base-color textures, shared normal detail, zero metallic response, no emission, and matte roughness. The broad oak is a credible near-frame candidate. The maple and elm are useful silhouette variants, but their fused Meshy foliage masses still fall short of Poly Haven leaf-card detail at close range. This family should remain behind a visual approval gate rather than replace the live forest wholesale.

## Surviving candidates

| Candidate | Normalized dimensions | Triangles | Runtime size | Semantic split | Visual role |
| --- | ---: | ---: | ---: | ---: | --- |
| Broad English Oak R1 | 15.50 × 10.94 × 15.42 m | 82,509 | 1.56 MiB | 3.15% bark / 96.85% foliage | Best result. Veteran hero or near-frame anchor. |
| Rounded Sugar Maple R2 | 10.29 × 15.00 × 9.97 m | 81,120 | 1.31 MiB | 3.30% bark / 96.70% foliage | Mid-field deciduous variation. Crown remains somewhat shelf-like. |
| Cathedral American Elm R3 | 10.48 × 19.00 × 11.46 m | 81,324 | 1.66 MiB | 3.24% bark / 96.76% foliage | Tall vertical counterpoint. Upper-crown read is distinct but not a textbook vase. |

All three optimized GLBs contain one instancing mesh, two semantic primitives, two semantic materials, three textures, zero emissive textures, metallic factor `0`, bark roughness `0.92`, and foliage roughness `0.88`.

## Paid-task ledger

Meshy balance moved from 2,125 to 1,975. Total spend: **150 credits**.

| Candidate | Preview task | Preview credits | Refine task | Refine credits | Result |
| --- | --- | ---: | --- | ---: | --- |
| Broad English Oak R1 | `019ffe5a-1e34-77b7-b4d6-0691f70ee958` | 20 | `019ffe68-3d36-7979-a696-44a4b6cfc3ec` | 10 | Accepted |
| Layered Sugar Maple R1 | `019ffe5a-22e7-7769-88c6-f19f7d580826` | 20 | — | 0 | Rejected: conifer-like stacked crown |
| Cathedral American Elm R1 | `019ffe5a-276c-705e-bd4c-04ebba1d1b26` | 20 | — | 0 | Rejected: willow-curtain foliage |
| Rounded Sugar Maple R2 | `019ffe61-4544-7184-93f4-7f38ea60d33e` | 20 | `019ffe68-41df-7299-ac7b-01b7cd230796` | 10 | Accepted |
| Cathedral American Elm R2 | `019ffe61-4a4b-7916-b90f-687a1b55e5db` | 20 | — | 0 | Rejected: narrow columnar crown |
| Cathedral American Elm R3 | `019ffe64-f2b5-7adb-a98c-43d37d592989` | 20 | `019ffe68-4694-7a60-9d45-170de29a0225` | 10 | Accepted |

Meshy’s current API contract uses a geometry-only preview followed by a texture refine. Meshy 6 previews cost 20 credits and 2K/4K refinements cost 10 credits. Sources: [Text to 3D API](https://docs.meshy.ai/en/api/text-to-3d), [API pricing](https://docs.meshy.ai/en/api/pricing).

## Evidence and artifacts

- Visual proof: `semantic-contact-sheet.png`
- Neutral silhouette gate: `preview-contact-sheet.png`
- Raw single-material comparison: `raw-contact-sheet.png`
- Machine verification: `semantic-family-metrics.json`
- Face split measurements: `semantic-split-metrics.json`
- Resumable paid-task state: `meshy-tasks.json`
- Blender review composite: `blender/candidates/forest-semantic-summer-r1.blend`
- Runtime candidates: `static/models/forest/trees/candidates/semantic-summer-r1/*_semantic.glb`

The `_semantic_proof.glb` files are uncompressed Blender-readable twins of the optimized runtime candidates. Blender 5 does not import `EXT_meshopt_compression`; the verifier decodes and measures the actual `_semantic.glb` deliverables through Meshopt.
