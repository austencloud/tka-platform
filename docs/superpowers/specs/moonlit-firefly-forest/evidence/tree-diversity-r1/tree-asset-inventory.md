# Forest tree asset inventory

## Production finding

The live 295-tree woodland declared eight variant names but reduced to four
actual Poly Haven source meshes: `island_tree_01` (100 placements),
`tree_small_02` (86), `jacaranda_tree` (74), and `island_tree_02` (35).
Different labels did not create different silhouettes.

## Accepted summer palette

All eleven accepted sources are already optimized, alpha-tested, and covered by
Poly Haven's CC0 license in `scripts/forest-natural-tree-assets.json`.

| Structural source      | Runtime triangles | Intended role                             |
| ---------------------- | ----------------: | ----------------------------------------- |
| Jacaranda broad canopy |           229,080 | Mature clearing-rim crown, used sparingly |
| Island tree 01         |           127,506 | Gnarled middle-story spreader             |
| Tree small 02          |           164,792 | Slender broadleaf and young gap tree      |
| Island tree 02         |            86,016 | Damp-hollow and runoff-bank spreader      |
| Island tree 03         |           165,764 | Lush broadleaf understory                 |
| Fir tree 01 A          |            58,887 | Mature conifer ridge silhouette           |
| Fir tree 01 B          |            34,487 | Mature conifer ridge silhouette           |
| Fir tree 01 C          |             7,104 | Distant mature conifer silhouette         |
| Fir sapling A          |            15,648 | Cool-rise understory                      |
| Fir sapling B          |             9,634 | Cool-rise understory                      |
| Fir sapling C          |             9,771 | Cool-rise understory                      |

The two leafless derivatives are valid assets but excluded from the summer
population. The composition uses conifers for 18.3% of placements and keeps
them concentrated on cool rises and depth ridges.

## Conditional sources

Winter contains two additional CC0 Poly Haven families, `fir_sapling` and
`pine_sapling_small`. Their source geometry is sound, but neither has passed the
Forest vegetation-aware split and alpha pipeline. They remain reserve material,
not production dependencies.

Autumn includes six TKA/Meshy silhouettes. Their opaque, season-authored
materials prevent independent bark and leaf control. They are not accepted for
the summer canopy without a new semantic-material pipeline.

## Rejected sources

- The Forest Meshy oak, elm, hornbeam, and failed beech use one opaque material
  per tree. They preserve the green-trunk and sculpted-foliage failure.
- The SpeedTree ORCA oak is evaluation-only under CC BY-NC-SA 3.0 and cannot
  enter commercial production.
- Winter snow conifers carry snow in their opaque assets and belong to Elsa's
  season.
- KayKit and the 61-model legacy vegetation library are intentionally low-poly,
  faceted, and untextured. They do not meet the Forest's art direction.

## Canonical implementation chain

`scripts/forest-tree-layout.json` ->
`scripts/prepare-forest-composition-sources.mjs` ->
`scripts/build-forest-environment.py` -> Forest GLB optimizers ->
`ForestScene.svelte` and `ForestNearFrameLayer.svelte`.
