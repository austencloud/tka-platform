# Forest Meadow Believability Verdict

Date: 2026-08-13

Verdict: accepted for the current Forest surface pass.

The rejected meadow used thousands of individually baked ribbons inside nine
large meshes. It showed even spacing, isolated comb silhouettes, weak root
contact, and no credible middle scale between the terrain texture and tall
grass.

The accepted system keeps the authored fifteen habitat patches but changes the
production representation to reusable colony prototypes with GPU instancing.
Each patch now resolves as overlapping sward islands built from five forms:
fine blades, basal growth, broad leaves, arching blades, and sparse seed stems.
The stage core, paths, campsite, tree placement, and locked Night lighting are
unchanged.

## Production metrics

- Authored colony instances: 4,449
- Effective plant forms: 113,998
- Basal forms: 18,000
- Fine blades: 58,671
- Broad leaves: 23,826
- Arching blades: 11,050
- Seed accents: 2,451
- GPU-instanced grass colonies in the optimized GLB: 4,449
- Near-frame asset: 12,319,092 bytes (11.75 MiB)
- Asset ceiling: 13,631,488 bytes (13 MiB)

## Visual proof

- `before-day-floor.png`: rejected uniform spike field.
- `final-day-floor.png`: accepted clustered summer sward.
- `after-day-walk-r3.png`: human-height Day proof.
- `after-night-floor-r3.png`: dry, nonshiny Night proof.
- `viewport-*.png`: fixed-camera responsive sweep from 3840 x 2160 through
  375 x 812. The 375 x 812 frame was reloaded under its native viewport and is
  recorded in `viewport-375x812-reloaded.png`.

## Contract proof

- Environment GLB verification passed.
- Near-frame GLB verification passed, including all fifteen habitat patches,
  all five plant forms, three cumulative quality tiers, 4,449 instanced
  colonies, composition margins, and the 13 MiB ceiling.
- Runtime console review reported zero warnings and zero errors.
