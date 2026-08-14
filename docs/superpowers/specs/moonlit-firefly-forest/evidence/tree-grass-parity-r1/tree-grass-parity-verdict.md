# Forest tree and grass parity verdict

Verified 2026-08-14.

## Accepted production result

- The environment contains 295 trees across 11 real source silhouettes and 13 habitat clusters.
- No source exceeds 20 percent of the population.
- The close layer contains 128,855 grass clumps: 62,141 carpet, 48,101 meadow, 11,336 seed-height, and 7,277 worn-path clumps.
- The worn trail remains grassed, directionally flattened, asymmetric, and feathered into the meadow.
- Day grass stays dry and matte across hero, path, and tree-review cameras.
- The locked Night frame stays dark and matte without the former silver-frost response.
- The environment GLB is 20,887,796 bytes, below its 20 MiB ceiling.
- The near-frame GLB is 18,846,988 bytes, below its 18 MiB ceiling.

## Meshy production decision

The semantic English oak trial was rejected after live integration. Its bark and foliage were independently controllable, but the sculpted crown read as a bright foam mass beside the Poly Haven leaf canopies. The oak was removed from all three environment placements and from the west-depth frame slot. The natural-tree baseline was rebuilt from source afterward.

Two paid candidate waves remain available outside production:

- R1 spent 150 credits on oak, maple, and elm candidates.
- R2 spent 320 credits on 13 previews and six PBR refinements. European beech, silver birch, and tulip tree are the strongest near-to-mid candidates. Hornbeam, hickory, and sycamore remain mid/far candidates.
- Total Meshy spend for the semantic tree program: 470 credits. Final balance: 1,655.

Candidate evidence:

- `../semantic-tree-family-r1/semantic-contact-sheet.png`
- `../semantic-tree-wave-r2/semantic-contact-sheet.png`
- `../semantic-tree-wave-r2/semantic-wave-r2-verdict.md`

## Runtime proof

- `forest-natural-baseline-day-hero.png`
- `forest-natural-baseline-day-path.png`
- `forest-natural-baseline-day-trees.png`
- `forest-natural-baseline-night-hero.png`
- `forest-semantic-oak-day-hero.png` records the rejected live oak trial.

The current revision produced no new browser console errors. One warning belongs to the superseded revision 407 load timeout from before the rebuilt GLBs existed.

## Verification

- `verify-forest-environment-glb.mjs`: passed.
- `verify-forest-near-frame.mjs`: passed.
- `measure-forest-tree-diversity.mjs`: 295 trees, 11 sources, largest share 0.20.
- Focused Vitest suite: 5 files and 26 tests passed.

