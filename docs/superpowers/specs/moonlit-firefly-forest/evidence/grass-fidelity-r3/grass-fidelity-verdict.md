# Forest Grass Fidelity R3 verdict

Status: structurally and visually verified.

The Forest ground now keeps a dry, stable material response across hero,
overhead, close, and grazing cameras. The grass shader suppresses the broad
grazing-angle specular response that produced silver fields, while a restrained
upward normal bias keeps thin blades from changing brightness as the camera
orbits. The terrain detail remains visible with a higher roughness floor and a
softer daytime micro-normal contribution.

Paths no longer delete every sample through their centre. A fourth grass-only
stratum places short, flattened tufts along the direction of travel. The final
build retains 49.2 percent of eligible path-core samples, leaving exposed soil
between 2,492 worn-grass clumps. Shoulders still feather into the surrounding
meadow, so the routes remain readable without looking chemically erased.

The first R3 visual build retained only 27.3 percent of path-core samples. It
passed the initial numeric contract but failed the live camera test because the
worn layer was too faint to read as grass. The rejected build was not kept. The
final contract requires 42 to 58 percent retention.

Night remains dark and matte. The locked atmospheric values were not changed.

Proof:

- `day-hero.png`
- `day-floor.png`
- `day-path.png`
- `day-world.png`
- `night-hero.png`
- `night-path.png`
- `grass-fidelity-metrics.json`

Verification:

- Forest near-frame GLB contract passed with 130,639 instanced grass clumps.
- Near-frame output is 17,478,788 bytes, below the 18 MiB contract.
- Ten focused material, ground-detail, and near-frame tests passed.
- Python and Node syntax checks passed.
- The fast project check reports no errors in the files touched by R3. The
  checkout still contains unrelated errors in other active work.
