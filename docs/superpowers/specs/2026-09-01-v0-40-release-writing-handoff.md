# v0.40 Release Writing — Handoff (2026-09-01)

## Mission

Write the user-facing release notes for the next Flow Arts Composer release. The recommended version is `v0.40.0`, not the feedback script's patch-only suggestion, because the release contains more than 100 user-facing feature commits plus a large compatibility, 3D, desktop, and mobile stabilization pass. Use the `changelog` and `ai-bust` skills. Write for actual users, keep claims specific, and follow `docs/reference/ai-writing-guide.md`. Do not create a changelog entry, version commit, tag, or GitHub release until Austen explicitly approves the release preview.

## Done — verified

- The release stabilization branch was integrated into local `main` at merge commit `497279b38a`. Before integration, `npm run wt:finish -- codex/release-stabilization --nonvisual` ran `svelte-check` with 0 errors and 0 warnings.
- The push through `497279b38a` completed the required native hook: the production native surface verified 1,006 JavaScript assets, Gradle completed 366 tasks, 1,531 Unicode APK filenames matched byte-for-byte, and an 849.1 MiB debug APK was produced. Git then pushed `main` successfully.
- GitHub Web App CI run [33556724747](https://github.com/austencloud/tka-platform/actions/runs/33556724747) for `b5233021da` passed the full browser component suite and critical QR regressions. Its root suite passed 12,799 assertions and exposed three stale contracts.
- The three stale contracts were reconciled on `codex/release-ci-fixes`: `0abbec3621` tracks the intentional Composer state rename, and `cb2029746b` tracks Autumn's approved world-space ground shader and fog defaults. Focused proof: `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/landing-route-morph.test.ts tests/unit/3d-autumn/autumn-finish-systems.test.ts tests/unit/3d-viewer/scene-config-defaults.test.ts` passed 3 files and 47 tests.
- Desktop workflow run [33550999015](https://github.com/austencloud/tka-platform/actions/runs/33550999015) passed its signing preflight in branch mode, offline sequence export, Windows, macOS x86_64, and macOS ARM64 jobs at stabilization SHA `1093fa7d81`. Unsigned branch builds completed; signed release-only steps correctly skipped.
- The latest published tag is `v0.39.0`. Repository inspection found 338 user-facing conventional commits since that tag at the time of inventory: 102 features, 225 fixes, and 11 performance changes.
- Existing desktop assets from `v0.37` and `v0.39` have zero downloads. No Windows installer or updater manifest has ever been successfully released.

## Believed done — unverified

- The two CI-fix commits have not yet been integrated into `main`, pushed, or exercised by a new full GitHub CI run.
- The final release note wording has not been approved by Austen.
- The current `main` may continue to move while other agents finish work. Recompute the final commit inventory immediately before writing release artifacts.
- The desktop workflow is proven on the stabilization SHA, but the final release tag still needs its own signed build after signing credentials are configured.

## In flight

- Worktree: `E:/tka-platform-release-ci-fixes`
- Branch: `codex/release-ci-fixes`
- Clean commits not yet integrated: `0abbec3621` and `cb2029746b`
- The worktree uses a `node_modules` junction to `E:/tka-platform/node_modules`; unlink it before worktree removal.
- Primary `main` was at `629402e061` when this handoff was written and was 13 commits ahead of the last fetched `origin/main`. The primary checkout also contains an intentionally untouched untracked `human-generator/` third-party trial directory.

## Loose ends (ranked)

1. Bring `codex/release-ci-fixes` current with the latest `main`, run the three focused tests again, finish the worktree into `main`, and push all remaining committed work.
2. Watch the exact new `main` SHA through Web App CI. Do not call the release ready until component tests, root tests, package tests, production build, and offline verification are green.
3. Draft a concise `v0.40.0` preview for Austen. Recommended content is below. Keep gated/internal work out.
4. Stop at the release skill's confirmation gate and ask Austen to approve `v0.40.0`, the note wording, and updater-key rotation. Do not tag or publish before that answer.
5. After approval, rotate the Tauri updater key, configure GitHub secrets, update the committed public key, prove a signing round-trip, then follow the release skill through changelog, version, tag, and GitHub release.

## Recommended release-note content

### Added

- A clearer, intent-first Create entrance for guests and signed-in users, with keyboard shortcut hints.
- Direct 3D performer manipulation with mouse, touch, and keyboard controls, plus responsive inspectors and avatar controls.
- One Sequence Viewer flow across pictographs, tunnels, and 3D performance while preserving playback and controls.
- For signed-in users, rebuilt Choreo Card Scan Atlas tools and stronger collection workflows.
- SpiroAnim links that open hydrated patterns in the viewer and return to the player.
- Verified offline desktop sequence bundles for Windows and both macOS architectures.

### Fixed

- Compatibility for older saved and shared sequences, including hand identity, colors, grids, settings, QR codes, short codes, and collections.
- Responsive Create and Construct controls, mobile touch targets, option filtering feedback, and generator failure handling.
- Safari profile-photo fallback behavior.
- 3D picking and dragging, anatomical staff grip alignment, collision handling, and scene startup reliability.
- Android builds with Unicode assets and SDK discovery from Git worktrees.

### Performance

- Faster 3D startup and effect activation, distance-aware culling, and less per-frame geometry churn.

## Decisions already made

- On 2026-09-01, Austen said to take the recommendation and proceed with release preparation.
- Recommend `v0.40.0`. The scope is a minor release, not a `v0.39.1` patch.
- Exclude anything still dark-flagged or internal: Mandala, Stage, Learn experiments, Toys, the gated broader Atlas/Glossary experience, internal analytics plumbing, test labs, and museum-only prototypes.
- Qualify account-only work in plain language. Fuse, account collection improvements, Scan Atlas account tools, settings color sync, and viewer solo-hand modes should not be presented as guest capabilities.
- The Create front door itself is available to guests and signed-in users.
- Preserve the distinction between the signed-in Choreo Card Scan Atlas tools and the broader production-gated Atlas/Glossary experience.

## Gotchas

- `node scripts/release.js --dry-run` sees 12 completed feedback items but misses roughly 290 user-facing commit candidates. Do not let its patch-version suggestion drive the release level.
- The repository currently lacks `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets. The local private key matches the committed public key but is encrypted and its password was not found in repository env files, process env, Windows Credential Manager, sanitized PowerShell history, memory, or docs.
- The safe signing recommendation is key rotation because prior desktop assets have zero downloads, so no known external updater installation would be stranded. Rotation is still a material release action and must wait for Austen's explicit confirmation.
- A previous manual desktop branch run accidentally created a draft release named after the branch. It had no tag and zero downloads and was deleted. The workflow now separates unsigned branch smoke builds from signed tagged releases and fails tag builds early when signing secrets are absent.
- Do not mention broad Atlas, Glossary, Mandala, Stage, Learn, or Toys work merely because commits exist. Their current product gates make those claims misleading.
