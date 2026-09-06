# Character intake

This directory owns the path from a locally downloaded rigged character to a
reviewable Flow Arts Composer catalog candidate.

## 1. Download the source

For Mixamo, download through Adobe's signed-in website. Use FBX Binary, T-pose,
and skin included. Do not automate the download or copy the source file into
Git.

## 2. Record provenance

Copy `mixamo-provenance.example.json` beside the downloaded model and replace
every placeholder. The two `unknown` rights values deliberately make the
example fail. Change them only after checking the current source terms and
recording the evidence used for that decision.

## 3. Run intake

```powershell
pnpm run characters:intake -- `
  --source D:\Downloads\character.fbx `
  --provenance D:\Downloads\character.provenance.json `
  --output D:\TKA-character-intake `
  --stage-bakeoff
```

`--stage-bakeoff` copies the optimized result into the ignored local review
slot at `static/models/avatars/bakeoff/intake-current.glb`. Open the five paths
listed in `catalog-candidate.json`. The permanent slot is named
`intake-current`.

Use `--replace` to rebuild an existing intake directory. `--skip-optimize` and
`--skip-thumbnail` exist for diagnostics and tests; their warnings prevent the
output from looking like a completed production build.

The optimizer ends with two material passes. The first re-measures alpha modes
so a body mislabelled `BLEND` does not draw see-through. The second recognises
a Mixamo non-PBR export by its `*_Glossiness` sheet: Blender hands that sheet
over as metallic-roughness without inverting it and leaves a 0.5 metallic
factor, so cotton renders as half-metal latex. The pass turns glossiness into
roughness, clears the metallic channel and factor, and leaves any file without
a glossiness sheet untouched.

## Batch: a folder of downloads at once

Stamp a sidecar beside each download instead of editing JSON by hand. The two
rights values are typed by you, from the terms you read; the command refuses to
default them. `--slot` fills the id, name, and description from the curation
queue in `docs/research/mixamo-character-curation-queue-2026-08-31.json`.

```powershell
pnpm run characters:provenance -- `
  --source D:\Downloads\mixamo\Malcolm.fbx --slot 1 `
  --commercial-use allowed --runtime-distribution allowed `
  --evidence-note "Mixamo FAQ read 2026-09-05: characters are royalty-free for commercial use inside the app"
```

Then run every model that has a sidecar. Each character is staged under its
own name, so a batch of twelve can be compared in one bake-off session.

```powershell
pnpm run characters:intake-batch -- `
  --downloads D:\Downloads\mixamo `
  --output D:\TKA-character-intake
```

The summary table reports rig mapping, finger chains, normal-map and
roughness-texture coverage, any material still declared `BLEND`, the largest
source texture, and the optimized size. The same material audit is in every
`character-intake-report.json` under `optimized.materials`.

## Generate performers with Meshy

`characters:meshy` builds performers that do not exist in any catalog. Each
manifest asset runs text-to-3D preview (Meshy 7, A-pose), a PBR refine, and
Meshy auto-rigging, then lands as `<id>.glb` beside a `<id>.provenance.json`
sidecar, so the folder feeds `characters:intake-batch` unchanged. The four
festival performers live in `meshy-performers.json`.

```powershell
pnpm run characters:meshy -- `
  --manifest scripts/characters/meshy-performers.json `
  --output D:\Downloads\meshy-performers --dry-run
```

Drop `--dry-run` to spend credits. The run prices the batch against the
manifest cap and the live balance first, checkpoints every task id in
`.meshy-state.json` before polling so a rerun resumes instead of paying twice,
and never retries a POST. `--only <id>` limits the run; `--force` regenerates
an asset whose look was rejected. The unrigged refine is kept in `raw/` for
reference. Meshy needs `MESHY_API_KEY` in the environment or in `.env`.

The sidecar records paid-plan ownership from Meshy's help center. Never publish
one of these models to the Meshy Community: that releases it under CC0.

## Give a Meshy performer finger bones

Meshy's rigger emits 24 bones and no fingers, so a Meshy performer cannot drive
the runtime finger grip and holds a prop with a floating hand. Mixamo's
auto-rigger does emit finger chains, so the route is Meshy for the mesh and
Mixamo for the skeleton.

Mixamo rejects the A-pose Meshy ships. Every attempt on the raw mesh — welded
or not, FBX or OBJ, at all four skeleton LODs — returns `ERROR occured on rig:
Unknown error while generating motion`. Bake a real T-pose first:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe" --background `
  --python scripts\characters\meshy-tpose-bake.py -- `
  D:\Downloads\meshy-performers\marcus.glb D:\Downloads\meshy-tpose marcus
```

The script poses the arms with the Meshy rig itself, bakes the pose into the
mesh, drops the 24-bone skeleton, welds the ~2100 loose parts Meshy leaves into
one shell, removes the stray icosphere, and writes an unrigged FBX and OBJ.

Upload the FBX at https://www.mixamo.com, keep **Standard Skeleton (65)** so
the fingers come through, place the chin, wrist, elbow, knee and groin markers,
and download **FBX Binary**, **T-pose**. Write a provenance sidecar that cites
both licences — Meshy paid-plan ownership for the mesh, Adobe Mixamo terms for
the rig, with `rawSourceRedistribution` set to `forbidden` because of the
Mixamo half — then run `characters:intake` on the download. The report should
read `Fingers: complete 30-bone chains`.

## Texture size: how clear it stays when the camera moves in

The optimizer caps every texture at 1024 px. That ceiling was measured at the
default TKA camera, where the shipped characters lost nothing visible. It is
also where a character starts to soften once the camera moves in, because a
1024 sheet has to cover a whole body.

`--texture-size 2048` keeps a source's detail up to 2048 px. The cost is about
four times the texture bytes and GPU memory for that character, so it is a
per-character decision, not a new default. Run the batch at the default first
and read the table's **Source tex** column: a source that never exceeds 1024
gains nothing from a higher ceiling. Rerun the ones worth it with
`--replace --texture-size 2048`, compare the **MiB** column, and judge the
difference in the bake-off before promotion. A performer roster of three or
four hero characters can afford 2048; a crowd cannot.

## Reviewing staged characters

`--stage-bakeoff` (on by default in the batch command) copies each optimized
character to `static/models/avatars/bakeoff/intake-<id>.glb` and records it in
`intake-manifest.json` beside it. The bake-off route reads that manifest and
lists every staged character under **Staged intakes**; deep links use
`?candidate=intake-<id>`. The single `intake-current.glb` slot still receives
the most recent intake.

The route's **Lighting** control switches a prefiltered room environment on and
off for the same candidate and pose. The production viewer lights performers
with an ambient and one key light and sets no environment map, so **Studio
lights** is the honest baseline and **Room environment** shows what the same
character's roughness and metalness would do with one.

## 4. Promote after review

The command never uploads or edits the deployed catalog. Review all five poses,
run the sequence collision audit, confirm materials and transparency in the
browser, then use the generated hashes and proposed metadata in the release
change.
