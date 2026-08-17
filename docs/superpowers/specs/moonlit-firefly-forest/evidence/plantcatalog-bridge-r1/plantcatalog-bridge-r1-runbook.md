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

### API facts measured against PlantFactory 4.8.0.0 (2026-08-17)

Four things in this pipeline are not guessable from the docstrings, and each one
cost a failed run before it was measured.

**Load with `LoadPlant`, not `LoadPlantCatalogFile`.** An earlier version of this
runbook said the opposite. The `VRLLPFS462` failure it cited came from pointing
`LoadPlant` at `Quercus robur forest HD_~~.tpf` — the 0.1 MB *browse placeholder*
the application installer ships for every species — rather than from the API
choice. Against the real 154.7 MB file from PlantCatalog 2022.1, `LoadPlant`
works. `LoadPlantCatalogFile` is actively dangerous here: its docstring carries
no "Can throws exceptions on error", and that is literal — when it cannot resolve
a species name it opens PlantFactory's interactive **Browser** picker, which
disables the main window and blocks an `-immediate-python` run indefinitely with
nothing written to `vue.log`. Both `"Quercus robur forest"` and the LOD-qualified
`"Quercus robur forest HD"` hung that way. `catalogSpeciesName` survives in the
manifest as provenance only.

**Age, max age, and season are typed `int`; health is a `float`.** A float raises
`TypeError` from the SWIG binding. Worse, the setters and getters disagree on
units, so a wrong value is silently plausible rather than loud:

| Parameter | Set as | Reads back as |
|---|---|---|
| `seasonDay` | day of year, int in `[0, 364]` | percent of year (day 172 → 47.25) |
| `health` | fraction in `[0, 1]` | percentage (1.0 → 100.0) |
| `ageYears`, `maximumAgeYears` | years, int | years |

The bridge writes each value, reads it back, converts units, and fails on any
mismatch.

**Only int and bool export options exist in practice.** Every string-typed option
in `SetExportOption`'s own error listing (`map_output.format.*`,
`map_output.filename_prefix`, `format.*.extension`) raises `Invalid option` when
actually used, and the float `scale` raises a SWIG overload error. So texture map
format cannot be forced through this API; the output format follows the export
filename's extension, and the Blender stage renormalizes height. Those
unsettable-but-relevant values are captured under `export.recordedOptions` for
provenance. Note also that `SetExportPreset` changed *no* option value when
measured — it is recorded and applied at export time — so every option is read
back after setting, per its docstring warning that a preset "overrides most
export options set with SetExportOption".

**Modal warnings will stall a headless run.** Mid-export, PlantFactory raises
`MSGSTC_FBXTilingModeMirror` — "FBX format does not support 'Mirror' Tiling Mode.
The export will be switched to 'Repeat'." It is only a warning, but it is modal,
so the script blocks with output half-written and no error anywhere. It was
dismissed once with "Don't show again" ticked, which persists to
`%APPDATA%\e-on software\PlantFactory\Config\eonMBCheckStates.prv`. If this
bridge is ever run under a different Windows profile, that suppression will not
be there and the run will hang at ~43 files. These dialogs are custom-painted:
they expose no child windows to `EnumChildWindows` and no UI Automation
descendants, so the only way to read one is to capture the window with
`PrintWindow`.

The script checkpoints each job before geometry work and after a valid FBX is
written. Running it again skips a completed job when the source hash, seed,
season, health, age, and export contract still match.

If PlantFactory reports an error, the exact exception and traceback are stored
in `blender/plantcatalog-bridge-r1/state/plantfactory-export-state.json`.

## Two axes, and why reduction is bounded by error

A PlantCatalog material carries two independent facts, and collapsing them into
one "role" is what rejected the first proof run.

**Family** — foliage or wood — is semantic, decided by authored material and
texture names. It drives roughness and the wind mask's flutter channel, so it
answers *does this move like a leaf or like structure*. Twigs are wood: they are
opaque bark strips wrapped around solid tube geometry, and they hold the leaves
up. Epiphytes (`lichen`, `moss`, `evernia`, `parmelia`) are wood too, because a
lichen card is glued to the trunk and has to move with it.

**Surface** — cutout or opaque — is a render fact, decided by sampling alpha on
the base-colour texture. It drives alpha wiring, backface culling, and alpha
mode, so it answers *does this need a cutout to look right*. Both axes go in the
material name because both are read downstream by name, and the verifier asserts
them separately. A lichen card is wood AND cutout; no single axis holds that.

### The reduction rule follows from the surface axis

Opaque geometry is **solid** — a mesh approximating a volume. Reducing it yields
a coarser approximation of the same volume. It is also where the weight is: 64%
of `Quercus robur forest HD` is opaque wood, against 14% for the leaves.

Cutout geometry is a **card** — a flat quad whose shape lives in its alpha mask,
not in its edges. There is no surface error to bound and nothing to approximate.
Collapsing a corner does not simplify a leaf, it deletes one. Cards are
therefore never simplified. They are kept whole, or dropped whole as a named
layer, which is the epiphyte decision.

### Ratio-based decimation is the wrong instrument (measured, 2026-08-17)

Blender's COLLAPSE decimate takes a ratio and nothing else. It will reach that
ratio whatever the cost to the shape, because it has no notion of how far the
surface may move. Two failures, both visible only in rendered frames while every
triangle count stayed green:

- **One ratio for all opaque geometry.** At 0.06 the trunk was fine and the fine
  twigs were destroyed — their cross-section rings collapsed into flat ribbons,
  and a ribbon spanning two distant points is a large triangle that catches the
  sun. See `single-ratio-decimate-shards.png`. The trunk and the twigs share a
  material family but not a scale.
- **A per-material triangle budget.** Spreading an equal share of a budget
  across opaque materials distributed the damage more evenly and then deleted
  the low-detail oak's trunk outright, leaving the canopy floating above its own
  shadow.

Both are the same failure: a ratio is a budget, and a budget is not a quality
bound.

Reduction therefore happens in `optimize-forest-plantcatalog-bridge.mjs` on
`MeshoptSimplifier` with an explicit `error` bound, which abandons the ratio
once the surface would deviate too far. This is the same simplifier and the same
guard the Forest environment bake already applies to its trees, so the bridge
does not introduce a second reduction strategy. Blender keeps only the epiphyte
drop, which is semantic rather than geometric.

### Consequences for the runtime

- `EXT_meshopt_compression` matches every shipped Forest tree
  (`lush-canopy-oak.glb` is meshopt + WebP + quantization at 1.49 MiB), so no
  new decoder is needed at runtime. Blender has no meshopt importer, so the
  optimizer also writes a codec-free `-proof.glb` that the qualification renders
  read; it is the same geometry and the same materials.
- `TEXCOORD_0` is never quantized on these trees. The leaf atlas tiles outside
  `[0,1]`, and `quantize()` correctly skips it rather than wrapping the UVs.
- `forest-environment.glb`'s optimizer would otherwise simplify these leaf cards
  at ratio 0.53, because their names match its `/leaves|twig|foliage/i` test.
  `ForestPlantCatalog_` materials are exempt there — they arrive pre-reduced by a
  rule that ladder cannot express, and its own `canopy_lod` branch already
  refuses the same collapse on authored cards.
- Export and conditioning are separate sets. `reuseExportFrom` lets one
  PlantFactory run feed both LOD tiers, which differ only in reduction, and
  `activeConditioningSet` selects what is verified.

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
