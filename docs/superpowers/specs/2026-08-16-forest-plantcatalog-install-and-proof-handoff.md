# Forest PlantCatalog Install and Proof — Handoff (2026-08-16)

## Mission

Finish the accepted PlantCatalog R1 proof for the Moonlit Firefly Forest. Austen
wants PlantFactory/PlantCatalog to replace the Forest's weak, repetitive, and
occasionally green-trunk tree assets with botanical trees that hold up in summer
daylight. The immediate task is not production integration. First make the local
PlantCatalog collection complete, export one deterministic English oak through
the committed bridge, condition it into a runtime GLB, and present the fixed-view
contact sheet for Austen's visual approval. The governing Forest specification is
[scene-development.md](./moonlit-firefly-forest/scene-development.md), and the
bridge runbook is
[plantcatalog-bridge-r1-runbook.md](./moonlit-firefly-forest/evidence/plantcatalog-bridge-r1/plantcatalog-bridge-r1-runbook.md).

## Done — verified

### PlantCatalog bridge is committed and preflighted

- Commit `f98164d736e1965e7fd36fbb2e6f56576b888db1` (`chore(3d): forest
  plantcatalog bridge export pipeline`) owns the manifest, PlantFactory Python
  bridge, Blender conditioning, GLB optimization, six-view renderer, contact
  sheet, verifier, and post-export runner.
- `node scripts/verify-forest-plantcatalog-bridge.mjs --phase=preflight` passed
  again on 2026-08-16. It verified PlantFactory `4.8.0.0`, the `eon.py` API
  signatures, the active proof job, and the source `.tpf` contract.
- The source index exists at
  `C:\ProgramData\e-onsoftware\PlantCatalog\Broadleaf Trees\Quercus robur forest HD_~~.tpf`.
  It is 100,188 bytes and SHA-256
  `d3aa44a882358cddff3bbe4a99eb5259f42b685b2c20baa75b77ad6d1dee98cf`,
  matching `scripts/forest-plantcatalog-bridge.json`.
- PlantFactory exists at
  `C:\Program Files\e-on software\PlantFactory\Application\PlantFactory.exe`;
  Windows reports product version `4.8.0.0`.

### Download integrity was measured, not assumed

All thirteen expected PlantCatalog filenames are present in `D:\Downloads`, but
only three are complete ZIPs. The check used
`System.IO.Compression.ZipFile.OpenRead()` and enumerated each archive's central
directory and `Setup (Win).exe` entry.

| Release | Local bytes | ZIP status |
| --- | ---: | --- |
| 2019.1 | 636,189,509 | valid, 156 entries |
| 2019.2 | 654,207,826 | valid, 156 entries |
| 2019.3 | 53,681,408 | **invalid/truncated** |
| 2020.1 | 49,414,144 | **invalid/truncated** |
| 2020.2 | 42,882,787 | **invalid/truncated** |
| 2020.3 | 39,690,694 | **invalid/truncated** |
| 2021.1 | 38,005,032 | **invalid/truncated** |
| 2021.2 | 34,779,526 | **invalid/truncated** |
| 2021.3 | 1,479,929,137 | valid, 158 entries |
| 2022.1 | 40,751,922 | **invalid/truncated** |
| 2023.1 | 3,525,414,855 | **invalid/truncated** |
| 2023.2 | 32,755,862 | **invalid/truncated** |
| 2023.3 | 35,391,200 | **invalid/truncated** |

Current integrity result: **3 valid, 10 invalid, 13 present**. Do not run any
installer from an invalid archive.

### The catalog payload is not installed yet

- `C:\ProgramData\e-onsoftware\PlantCatalog` currently contains only 391 files
  totaling 47,341,946 bytes: 379 `.tpf` indexes and 12 `.png` files. This is the
  browse/index layer, not the complete plant payload.
- The last proof attempt reached `LoadPlantCatalogFile("Quercus robur forest",
  41)` and displayed PlantFactory's missing-extra-package dialog.
- There is no FBX at
  `blender/plantcatalog-bridge-r1/raw/quercus-robur-forest-hd-s41/quercus-robur-forest-hd-s41.fbx`
  and no completion marker at
  `blender/plantcatalog-bridge-r1/state/plantfactory-export-complete.json`.
  Those absence checks were repeated on 2026-08-16.

## Believed done — unverified

- Austen has visited every PlantCatalog release link and believes all downloads
  completed. File presence supports that every link was attempted, but ZIP
  integrity disproves completion for ten releases. Treat those ten downloads as
  incomplete until they open successfully with `ZipFile.OpenRead()`.
- The committed bridge is expected to export successfully once the PlantCatalog
  payload is installed. That end-to-end proof has not yet run because the missing
  packages block PlantFactory before geometry generation.

## In flight

- Branch: `main`; no task branch or worktree exists. At handoff creation, `main`
  was ahead of `origin/main` and the checkout contained unrelated dirty files
  from other live tasks. Do not revert, stage, format, or commit those files.
- The PlantCatalog bridge source files and Forest specification are clean relative
  to commit `f98164d736`.
- Local checkpoint:
  `blender/plantcatalog-bridge-r1/state/plantfactory-export-state.json` reports
  the oak job as `running` from 2026-08-15T00:02:19Z. It is stale. Re-running the
  bridge is safe because only a matching `complete` job with a nonempty FBX is
  skipped; the incomplete state is overwritten.
- `D:\Downloads\Extra_Content_2021.1_R6.zip` also exists, but it is not required
  for the PlantCatalog English-oak proof. Keep it out of this gate.

## Loose ends (ranked)

### 1. Re-download and integrity-check the ten broken archives

Austen explicitly said, "Don't take over. Just instruct me." Do not control his
browser or installer UI. Give him precise directions.

Use the stable official page:
`https://www.bentley.com/software/e-on-software-downloads/`. Under
**PlantCatalog collections**, re-download only:

`2019.3`, `2020.1`, `2020.2`, `2020.3`, `2021.1`, `2021.2`, `2022.1`,
`2023.1`, `2023.2`, and `2023.3`.

Limit concurrent downloads and wait for Chrome to finish each file. Do not use
copied CDN URLs because Bentley signs those URLs and they expire.

Validate all thirteen archives before installation:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$results = foreach ($file in Get-ChildItem -LiteralPath 'D:\Downloads' -File |
  Where-Object Name -Like 'PlantCatalog_*.zip' | Sort-Object Name) {
  try {
    $zip = [IO.Compression.ZipFile]::OpenRead($file.FullName)
    [pscustomobject]@{
      Name = $file.Name
      Bytes = $file.Length
      Valid = $true
      Entries = $zip.Entries.Count
    }
    $zip.Dispose()
  } catch {
    [pscustomobject]@{
      Name = $file.Name
      Bytes = $file.Length
      Valid = $false
      Entries = 0
    }
  }
}
$results | Format-Table -AutoSize
```

Gate: thirteen rows, all `Valid = True`.

### 2. Install each release without breaking its relative archive paths

Extract each ZIP into its own directory, for example:

`D:\Downloads\PlantCatalog-install\2019.1\`

Run that directory's `Setup (Win).exe` while its sibling `Archives` directory
remains beside it. Do not move `Setup (Win).exe` away from the extracted files,
and do not extract all releases into the same directory. Every setup expects a
relative payload such as `Archives\Archive.zeon`; moving the executable caused
the earlier `No such file or directory` failure against
`D:\Downloads\Archives\Archive.zeon`.

Install all thirteen releases into PlantFactory's default shared content
location. Close and reopen PlantFactory afterward. Confirm that opening
`Quercus robur forest` no longer shows the missing-extra-package dialog. Record
the resolved content path and post-install file/byte counts instead of assuming
the destination.

### 3. Run the single-oak PlantFactory export

Close PlantFactory first, then ask Austen to run exactly:

```powershell
& 'C:\Program Files\e-on software\PlantFactory\Application\PlantFactory.exe' `
  '-immediate-python' '--python' `
  'E:\tka-platform\scripts\plantfactory\forest_plantcatalog_bridge_r1.py' '--'
```

Monitor, but do not take over the application. The export gate passes only when:

- PlantFactory prints `PLANTCATALOG BRIDGE COMPLETE`;
- `plantfactory-export-complete.json` exists;
- the oak FBX exists and is nonempty;
- the checkpoint records the job as `complete` with exported texture maps.

If it fails, read
`blender/plantcatalog-bridge-r1/state/plantfactory-export-state.json`; the bridge
stores the exact exception and traceback there.

### 4. Run the automated candidate proof

After the completion marker exists, Codex runs its own verification work:

```powershell
pwsh -NoProfile -File scripts/run-forest-plantcatalog-postexport.ps1
```

This must condition the FBX, preserve separate wood and foliage semantics,
restore alpha-tested leaves, normalize the tree to 16 m, author rooted-wind
`COLOR_0`, optimize below the manifest budgets, render six fixed views, build a
contact sheet, and pass `--phase=proof` verification.

Show Austen:

`docs/superpowers/specs/moonlit-firefly-forest/evidence/plantcatalog-bridge-r1/plantcatalog-bridge-contact-sheet.png`

Stop for his visual verdict. Do not integrate the oak or expand the production
wave before that approval.

### 5. Only after approval, design the summer production wave

Use multiple botanically distinct PlantCatalog species and deterministic seeds,
with habitat-specific placement roles and near/mid/far budgets. Preserve the
existing Forest layout, stage, campsite, paths, grass ecosystem, cameras, and
Gate 12 Night Master while swapping only the approved tree asset layer. Register
that non-trivial production plan before implementation.

## Decisions already made

- On 2026-08-14, Austen approved a full PlantCatalog direction after rejecting
  low-poly packs, Meshy's green trunks, and repeated/sculpted foliage. He wants a
  lush, natural summer forest with genuine species and silhouette variation.
- PlantCatalog R1 is a candidate-only proof. Production integration requires a
  contact-sheet visual gate first.
- Austen does not want the agent to control the PlantFactory or download UI. Give
  him direct instructions and perform code, integrity, conditioning, and
  verification work autonomously around the human-only UI steps.
- Gate 12 revision 36 remains the locked Night Master. Tree improvement must not
  disturb the approved clearing geometry, routes, stage, campsite, cameras,
  ground ecosystem, or Night lighting.
- PlantCatalog models may be embedded in the commercial TKA project, but derived
  standalone plant assets may not be resold on marketplaces. Preserve provenance
  and the license flags in the bridge manifest.

## Gotchas

- **Ten downloads are currently corrupt.** Filename presence is not proof of a
  completed ZIP. The 3.5 GB `2023.1` file is also invalid.
- **Preserve installer adjacency.** `Setup (Win).exe` needs the extracted
  `Archives` directory beside it. Running a copied executable recreates the exact
  missing-`Archive.zeon` error already encountered.
- **Use the catalog-aware API.** Ordinary `LoadPlant(path)` fails on protected
  PlantCatalog files with `VRLLPFS462`. The committed bridge correctly uses
  `LoadPlantCatalogFile(speciesName, seed)`.
- **The `.tpf` files are indexes, not proof of installed payloads.** Preflight can
  pass while PlantFactory still raises the missing-package dialog.
- **Do not run post-export early.** It intentionally fails until PlantFactory has
  written both the FBX and completion marker.
- **Do not confuse thumbnails with exported quality.** The first decision gate is
  the generated six-view contact sheet, especially bark close-up, canopy alpha,
  human-height scale, and silhouette. Only then judge the pipeline.
- **Shared checkout.** Scope every commit to explicit paths. Never stage or revert
  unrelated dirty files from other sessions.
