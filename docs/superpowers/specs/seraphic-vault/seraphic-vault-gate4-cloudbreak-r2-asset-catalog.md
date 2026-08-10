# Olive Cloudbreak Gate 4 asset catalog

Date: 2026-08-10

Status: Gate 4 reopened, reuse inventory complete, asset selection awaiting visual approval

Museum decision: `wLtsIC1y0UhIDwu88ULw`

> Historical inventory: revision 4 has now produced the two foreground olives,
> optimized the selected CC0 coastal rocks, and returned the resulting spatial
> composition to Gate 1. See
> `./seraphic-vault-gate1-r4-asset-production.md` for the active review package.

## Review surface

Open the live catalog in the Codex in-app browser:

`https://127.0.0.1:5176/test/celestial-integration?view=assets`

The catalog renders the candidates inside the approved Cloudbreak shell with the
placeholder olive trees and distant procedural mesas hidden. It reuses the
scene's sky, cloud panorama, sun, lagoon, limestone shelf, lighting, shared
orbit camera, and shared segmented-control owner.

The three views answer different questions:

- **Cohesion** places the four viable foreground candidates into the approved
  composition.
- **Trees** compares three production-detail forest models with the legacy
  low-poly ceiling.
- **Stone** compares the reusable scan geometry under one proposed Cloudbreak
  limestone material.

## Decision matrix

| Candidate               | Source                        |                              Weight | Verdict        | Cloudbreak role                                                         |
| ----------------------- | ----------------------------- | ----------------------------------: | -------------- | ----------------------------------------------------------------------- |
| Forked Forest Elm       | TKA Forest ImageGen + Meshy 6 |  1.09 MB / 77,769 rendered vertices | Adapt          | Best existing olive gesture; needs olive-specific leaves or replacement |
| Lush Canopy Beech       | TKA Forest ImageGen + Meshy 6 |  1.10 MB / 95,985 rendered vertices | Adapt          | Secondary framing shape; too lush to read as a final olive              |
| Young Hornbeam          | TKA Forest ImageGen + Meshy 6 |  0.99 MB / 53,853 rendered vertices | Distant only   | Small mesa or depth accent                                              |
| Vegetation Pack Oak     | Legacy repository asset       |     0.01 MB / 588 rendered vertices | Exclude        | Useful quality-floor comparison; too toy-like for this scene            |
| Poly Haven `boulder_01` | Poly Haven, CC0               | 1.51 MB / 197,352 rendered vertices | Reuse geometry | Lagoon bank and shelf anchor with shared limestone material             |
| Poly Haven `rock_07`    | Poly Haven, CC0               |  0.58 MB / 44,382 rendered vertices | Reuse geometry | Repeatable shoulder stone with shared limestone material                |
| Poly Haven `stone_01`   | Poly Haven, CC0               | 1.01 MB / 158,946 rendered vertices | Exclude        | Too expensive for a small repeated detail                               |
| Vegetation Pack Rock A  | Legacy repository asset       |     0.01 MB / 240 rendered vertices | Distant only   | Tiny mesa scatter where faceting cannot be read                         |

The exact file paths, digests, source labels, rights, weights, and vertex counts
live in `src/routes/test/celestial-asset-catalog/catalog.ts` and are protected by
`tests/unit/3d-viewer/celestial-asset-catalog.test.ts`.

## Inventory outside the rendered shortlist

The existing library also contains large coastal scans and modular vegetation
cliffs. They do not enter the cohesion view:

- `coast_rocks_05.glb` is 15.10 MB and renders 2,183,790 vertices before any
  repetition. It would need a deliberate decimation and silhouette test before
  becoming a production candidate.
- `sand_rocks_small_01.glb` is 11.00 MB and renders 1,588,989 vertices. Its low
  clustered profile does not solve the floating-mesa or shelf-edge silhouette.
- The vegetation cliff kit is cheap enough for distant dressing, but it shares
  the low-poly language rejected by the tree and rock comparison.
- Snowy conifers, palms, autumn-red hero trees, columns, monuments, ruins, and
  feather-era celestial models conflict with the approved natural refuge.

## Recommended production target

Keep the approved Gate 1 through Gate 3 composition. Gate 4 should now use:

1. Poly Haven boulder and rock geometry with one Cloudbreak limestone material,
   varied by scale, rotation, and restrained roughness response.
2. The young hornbeam only for a tiny distant living accent if its silhouette
   survives the registered cameras.
3. A Meshy hunt limited to the gaps this inventory could not fill:
   - one unmistakable mature olive family with two silhouette variants;
   - one eroded limestone shelf or mesa-edge family suitable for the lagoon and
     distant floating platforms.

The forked elm and broad canopy remain useful visual references during that
hunt. Neither should be promoted to the final foreground tree without Austen's
explicit approval.
