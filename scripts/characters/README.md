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

## 4. Promote after review

The command never uploads or edits the deployed catalog. Review all five poses,
run the sequence collision audit, confirm materials and transparency in the
browser, then use the generated hashes and proposed metadata in the release
change.
