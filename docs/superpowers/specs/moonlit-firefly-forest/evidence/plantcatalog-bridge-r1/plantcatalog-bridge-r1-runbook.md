# PlantCatalog Bridge R1

This gate proves one deterministic PlantCatalog tree from its source `.tpf`
through PlantFactory, Blender, glTF conditioning, fixed-camera renders, and the
existing Forest candidate boundary. It does not replace a production tree.

## Authority

- Accepted tracker decision: `YmJWyFZKDT6sCFn6Htrt`
- Manifest: `scripts/forest-plantcatalog-bridge.json`
- PlantFactory script: `scripts/plantfactory/forest_plantcatalog_bridge_r1.py`
- Existing downstream owners stay unchanged: Forest source staging, authored
  tree layout, Blender environment assembly, optimizer, and GLB verifier.

## One in-app proof run

1. Close PlantFactory if it is already running.
2. Open PowerShell and run:

   ```powershell
   & 'C:\Program Files\e-on software\PlantFactory\Application\PlantFactory.exe' '-immediate-python' '--python' 'E:\tka-platform\scripts\plantfactory\forest_plantcatalog_bridge_r1.py' '--'
   ```

3. Leave PlantFactory open while it loads and exports the oak.
4. The run is complete when the Python console prints
   `PLANTCATALOG BRIDGE COMPLETE`.

PlantCatalog assets must be opened with PlantFactory's catalog-aware
`LoadPlantCatalogFile(speciesName, seed)` API. Passing the protected catalog
`.tpf` path to the ordinary `LoadPlant` API fails with `VRLLPFS462`.

The script checkpoints each job before geometry work and after a valid FBX is
written. Running it again skips a completed job when the source hash, seed,
season, health, age, and export contract still match.

If PlantFactory reports an error, the exact exception and traceback are stored
in `blender/plantcatalog-bridge-r1/state/plantfactory-export-state.json`.

## Automated post-export gate

After the PlantFactory marker exists, Codex runs
`scripts/run-forest-plantcatalog-postexport.ps1`. That script:

- imports the FBX and maps into Blender;
- identifies wood and foliage from material names, texture names, and sampled
  cutout alpha;
- rejects the tree unless both semantic families exist;
- restores foliage alpha and dry nonmetallic material response;
- normalizes height and ground origin;
- authors a `COLOR_0` rooted-wind mask;
- exports and optimizes one candidate GLB;
- renders front, three-quarter, silhouette, human-height, bark, and canopy
  proof views;
- validates geometry, materials, alpha, wind data, dimensions, provenance, and
  file budgets.

Production integration starts only after this contact sheet passes visual
review. The Forest layout, clearing, ground, paths, stage, campsite, cameras,
and locked Night Master remain untouched during R1.
