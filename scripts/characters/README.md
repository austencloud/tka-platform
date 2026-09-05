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
