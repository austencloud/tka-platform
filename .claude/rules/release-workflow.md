# Release Workflow

Full workflow is in the `/release` skill (loads on demand).

Start with: `node scripts/release.js --dry-run`

Key rule: a release is NOT complete until the GitHub Release is created via `gh release create`.
