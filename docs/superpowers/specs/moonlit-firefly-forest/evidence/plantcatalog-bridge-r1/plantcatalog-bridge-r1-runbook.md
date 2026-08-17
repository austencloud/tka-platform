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
