# Dependency & Asset Cleanup

**Date:** 2026-05-23
**Status:** Backlog

---

## Phase 1: Remove Unused Dependencies

### Verified zero-import packages (remove from `dependencies`)

| Package | Listed size | Evidence |
|---|---|---|
| `@austencloud/code-quality` | ~npm pkg | zero imports in src/, scripts/, config |
| `@austencloud/dev-scripts` | ~npm pkg | zero imports anywhere |
| `@austencloud/drawer` | ~npm pkg | zero imports anywhere |
| `@austencloud/feedback-cli` | ~npm pkg | zero imports anywhere |
| `@austencloud/feedback-services` | ~npm pkg | zero imports anywhere |
| `@austencloud/feedback-types` | ~npm pkg | zero imports anywhere |
| `@austencloud/feedback-ui` | ~npm pkg | zero imports anywhere |
| `@austencloud/image-loader` | ~npm pkg | zero imports anywhere |
| `@austencloud/image-loader-svelte` | ~npm pkg | zero imports anywhere |
| `@austencloud/sidebar` | ~npm pkg | zero imports anywhere |
| `@internationalized/date` | ~80KB | zero imports; `date-fns` covers all usage |
| `google-auth-library` | ~npm pkg | only used in `firebase-functions/` (separate package.json) and `scripts/lib/cloud-functions-client.js` |

**Command:**
```bash
pnpm remove @austencloud/code-quality @austencloud/dev-scripts @austencloud/drawer @austencloud/feedback-cli @austencloud/feedback-services @austencloud/feedback-types @austencloud/feedback-ui @austencloud/image-loader @austencloud/image-loader-svelte @austencloud/sidebar @internationalized/date google-auth-library
```

### Packages NOT removed (have live imports)

The following were initially suspected but verified as actively used:

| Package | Import count | Why it stays |
|---|---|---|
| `@mediapipe/tasks-vision` | 2 files | `HandLandmarker.ts`, `ImageModeHandLandmarker.ts` |
| `h264-mp4-encoder` | 5 files | WASM fallback video encoder for Firefox |
| `@tiptap/*` (5 packages) | 0 in src | **REMOVE** -- see below, missed on first pass |
| `@tauri-apps/*` plugins (5 packages) | 4 files | Desktop module dynamic imports (`TauriAuthBridge.ts`, `DesktopInitializer.ts`, `DesktopDataSeeder.ts`) |
| `jszip` | 2 files | `print-zip-exporter.ts`, `ChoreoCardExport.svelte` (dynamic imports) |
| `@capgo/capacitor-updater` | 1 file | `hooks.client.ts` |
| `realtime-bpm-analyzer` | 1 file | `bpm-analyzer.ts` |
| `@resvg/resvg-js` | vite.config.ts + mcp-server | Externalized in build; used by mcp-server. See misplaced deps below |

### Re-check: @tiptap packages (zero imports confirmed)

```bash
pnpm remove @tiptap/core @tiptap/extension-color @tiptap/extension-link @tiptap/extension-text-style @tiptap/starter-kit
```

**Total packages removed: 17**

---

## Phase 2: Fix Misplaced Dependencies

### `typescript-eslint` -- move from `dependencies` to `devDependencies`

Used only in `eslint.config.js` (dev tooling). Currently listed in `dependencies`.

```bash
pnpm remove typescript-eslint && pnpm add -D typescript-eslint
```

### `svelte-confetti` -- move from `devDependencies` to `dependencies`

Used at runtime in `src/lib/shared/delight/components/ConfettiBurst.svelte`.

```bash
pnpm remove svelte-confetti && pnpm add svelte-confetti
```

### `stripe` -- remove from `devDependencies`

Only used in `firebase-functions/src/merch/` (separate package). Should not be in root package.json at all.

```bash
pnpm remove stripe
```

### `@resvg/resvg-js` -- evaluate removal from root

Currently in root `dependencies`, externalized in vite.config.ts, only used by `mcp-server/` and `mcp-server-pkg/` which have their own `node_modules`. If those packages declare their own dependency on `@resvg/resvg-js`, remove from root. If not, leave as-is until mcp-server gets its own package.json entry.

**Action:** Check `mcp-server/package.json` for `@resvg/resvg-js`. If present, remove from root. If absent, add it there and remove from root.

---

## Phase 3: Security Audit

**Current state:** 112 vulnerabilities (10 low, 57 moderate, 42 high, 3 critical)

### Critical vulnerabilities

| Package | Advisory | Path | Fix |
|---|---|---|---|
| `protobufjs` <7.5.5 | Arbitrary code execution | `firebase > @firebase/firestore > @grpc/proto-loader > protobufjs` | `pnpm update firebase` or add override `"protobufjs": ">=7.5.5"` |
| `fast-xml-parser` <4.5.4 | Entity encoding bypass via regex injection | `firebase-admin > @google-cloud/storage > fast-xml-parser` | `pnpm update firebase-admin` or override |
| `basic-ftp` <5.2.0 | Path traversal in downloadToDir | `@size-limit/preset-app > ... > basic-ftp` | `pnpm update @size-limit/preset-app` or override |

### High vulnerabilities (actionable)

| Package | Fix |
|---|---|
| `fabric` <7.2.0 (stored XSS via SVG export) | `pnpm update fabric` |
| `minimatch` (ReDoS, 2 instances) | `pnpm update eslint rimraf` |
| `devalue` <5.6.4 (prototype pollution) | `pnpm update @sveltejs/kit` |

**Command (try all at once):**
```bash
pnpm update firebase firebase-admin fabric @sveltejs/kit @size-limit/preset-app rimraf eslint
```

**If transitive deps won't update, add overrides to `package.json`:**
```jsonc
"overrides": {
  "protobufjs": ">=7.5.5",
  "fast-xml-parser": ">=4.5.4",
  "basic-ftp": ">=5.2.0",
  "fabric": ">=7.2.0",
  "devalue": ">=5.6.4"
}
```

---

## Phase 4: Static Asset Compression

### Avatar GLBs -- 695 MB total (12 files, 15-119 MB each)

| File | Size (MB) |
|---|---|
| ch01.glb | 58.7 |
| ch07.glb | 49.2 |
| ch10.glb | 118.6 |
| ch12.glb | 50.2 |
| ch18.glb | 15.3 |
| ch21.glb | 55.7 |
| ch22.glb | 62.5 |
| ch24.glb | 56.6 |
| ch34.glb | 26.6 |
| ch41.glb | 47.1 |
| ch42.glb | 58.7 |
| ch44.glb | 95.7 |

**Action:** Apply Draco + meshopt compression via `@gltf-transform/cli` (already in devDependencies).

```bash
for f in static/models/avatars/*.glb; do
  npx gltf-transform optimize "$f" "$f" --compress draco --texture-compress webp
done
```

Expected reduction: 60-80% (695 MB -> ~140-280 MB).

### austen-fire.jpg -- 15.2 MB

**Action:** Resize to max 2048px wide, convert to WebP.

```bash
npx sharp-cli -i static/images/austen-fire.jpg -o static/images/austen-fire.webp --resize 2048 --webp
```

Then update all references from `austen-fire.jpg` to `austen-fire.webp` and delete the original.

Expected size: ~200-400 KB.

### Codex PNGs -- 122.1 MB / 47 files in `static/guide/level-1/images/double-staff-codex/`

Average 2.6 MB each. These ARE used by guide pages (`CodexType12.svelte`, `CodexType36.svelte`).

**Action:** Convert to WebP, update references in the two Svelte components.

```bash
for f in static/guide/level-1/images/double-staff-codex/*.png; do
  npx sharp-cli -i "$f" -o "${f%.png}.webp" --webp
done
```

Expected reduction: 90%+ (122 MB -> ~10-12 MB). Delete originals after updating imports.

### Tree PNGs -- 11.6 MB / 82 files in `static/images/trees/curated/`

**Action:** Convert to WebP.

```bash
for f in static/images/trees/curated/*.png; do
  npx sharp-cli -i "$f" -o "${f%.png}.webp" --webp
done
```

### Screenshot directories -- 249.8 MB / 242 files (zero src references)

| Directory | Files | Size (MB) |
|---|---|---|
| `static/screenshots/app-development/` | 152 | 122.1 |
| `static/screenshots/dev-snapshots/` | 42 | 45.1 |
| `static/screenshots/guide-artboards/` | 47 | 82.6 |

Zero imports in `src/`. These are development artifacts, not served to users.

**Action:** Move to `.gitignore`'d location or delete. If needed for reference, archive to R2.

```bash
# Delete dev-only screenshots
rm -rf static/screenshots/app-development/
rm -rf static/screenshots/dev-snapshots/
rm -rf static/screenshots/guide-artboards/
```

---

## Phase 5: Stale Root File Cleanup

Total stale root files: ~26.8 MB. All of the following are development artifacts with zero references in source code.

### Playground HTMLs (delete)

```
brainstorm-rail.html
ocean-3d-playground.html
ocean-platforms-playground.html
ocean-redesign-playground.html
ocean-vibe-explorer.html
playground-celestial-2d.html
playground-performer-rail.html
playground-prop-selection.html
playground-qr-layout-verify.html
playground-qr-scan-layout.html
playground-theme-decisions.html
playground-theme-unification.html
playground-viewer-header.html
stats.html
```

### Screenshot PNGs (delete)

```
card-badge-check.png
page-0.png
screenshot-gaps.png
screenshot-grid.png
screenshot-now.png
```

### Temporary/debug text files (delete)

```
.tmp-snapshot.txt
.tmp-snapshot2.txt
.tmp-snapshot3.txt
.tmp-snapshot4.txt
.tmp-snapshot5.txt
.tmp-snapshot6.txt
.tmp-snapshot7.txt
.tmp-snapshot8.txt
all_t_keys.txt
check-output.txt
Etka-platformcheck-output.txt
snapshot.txt
snapshot2.txt
snapshot3.txt
svelte-check-unknown-errors.txt
t_keys.txt
td_keys.txt
```

### ESLint/audit output JSON (delete)

```
eslint-output.json
eslint-output2.json
eslint-output3.json
eslint-output4.json
eslint-output5.json
eslint-output6.json
eslint-output7.json
eslint-output8.json
eslint-warnings.json
orientation-audit-report.json
```

### Static playground HTMLs (delete)

These are in `static/` and have zero src references:

```
static/formation-playground.html
static/kickstarter-preview.html
static/playground-qr-inner.html
static/playground-qr-scan.html
static/rail-playground.html
static/render-compare.html
static/render-pictograph.html
```

**Command (root files):**
```bash
rm brainstorm-rail.html ocean-3d-playground.html ocean-platforms-playground.html ocean-redesign-playground.html ocean-vibe-explorer.html playground-celestial-2d.html playground-performer-rail.html playground-prop-selection.html playground-qr-layout-verify.html playground-qr-scan-layout.html playground-theme-decisions.html playground-theme-unification.html playground-viewer-header.html stats.html card-badge-check.png page-0.png screenshot-gaps.png screenshot-grid.png screenshot-now.png .tmp-snapshot.txt .tmp-snapshot2.txt .tmp-snapshot3.txt .tmp-snapshot4.txt .tmp-snapshot5.txt .tmp-snapshot6.txt .tmp-snapshot7.txt .tmp-snapshot8.txt all_t_keys.txt check-output.txt Etka-platformcheck-output.txt snapshot.txt snapshot2.txt snapshot3.txt svelte-check-unknown-errors.txt t_keys.txt td_keys.txt eslint-output.json eslint-output2.json eslint-output3.json eslint-output4.json eslint-output5.json eslint-output6.json eslint-output7.json eslint-output8.json eslint-warnings.json orientation-audit-report.json
```

**Command (static playground HTMLs):**
```bash
rm static/formation-playground.html static/kickstarter-preview.html static/playground-qr-inner.html static/playground-qr-scan.html static/rail-playground.html static/render-compare.html static/render-pictograph.html
```

---

## Phase 6: One-Time Script Cleanup

86 scripts in `scripts/` match the pattern of one-time migration/backfill/fix operations. These have already run and serve no ongoing purpose.

**Action:** Move to `scripts/_archive/` (or delete if git history is sufficient).

<details>
<summary>Full list of 86 one-time scripts</summary>

```
backfill-arena-loops.cjs
backfill-artifacts.cjs
backfill-compositional.cjs
backfill-daily-scans.ts
backfill-dates.cjs
backfill-deck-metadata.cjs
backfill-deck-slicetype.cjs
backfill-encoded-from-inline.cjs
backfill-encoder-hash.cjs
backfill-loop-metadata.js
backfill-loop-types.cjs
backfill-period.cjs
backfill-shortcode-encoded-targeted.js
backfill-shortcode-encoded.ts
backfill-start-position.cjs
backfill-strip-sequence-suffix.cjs
backfill-user-loop-types.cjs
cleanup-empty-public-sequences.cjs
cleanup-festival-images.cjs
cleanup-old-locations.cjs
cleanup-orphaned-public-sequences.cjs
cleanup-orphaned-public-sequences.js
cleanup-orphaned-sequences.js
convert-animation-to-glb.py
convert-buugeng-stl.cjs
convert-fbx-avatars.cjs
convert-fbx.mjs
convert-fish-pack.py
convert-mixamo-to-gltf.py
convert-sprite-to-groups.js
convert-to-camelcase.cjs
delete-all-thumbnails.js
delete-cap-labels-collection.cjs
delete-orphan-shortcodes.ts
delete-specific-duplicates.js
fix-blur-violations.cjs
fix-durations.cjs
fix-font-sizes.cjs
fix-gallery-imports.cjs
fix-legacy-step-format.js
fix-orphaned-feedback.js
fix-prop-types.js
fix-reduced-motion.cjs
fix-sequence-count.js
fix-sequence-lengths.cjs
fix-sequence-word-names.js
fix-shortcode-encoded-blobs.js
fix-shortcode-orientations.js
fix-skew-arrow-coords.cjs
fix-static-rotation.js
fix-uuid-word-sequences.js
fix-version-changelog.js
fix-vtg-orientations.js
migrate-all-public.js
migrate-backgrounds-to-nightsky.cjs
migrate-birthdays.cjs
migrate-colors-to-tokens.cjs
migrate-compositional.cjs
migrate-compositional.ts
migrate-festival-images.cjs
migrate-gamma-case.js
migrate-loop-labels-collection.cjs
migrate-loop-period.cjs
migrate-loop-types.js
migrate-orphaned-feedback.js
migrate-remove-report-emails.js
migrate-remove-user-emails.js
migrate-screenshots.cjs
migrate-shortcode-encoding.cjs
migrate-strict-loop-types.cjs
migrate-theta-firebase.cjs
migrate-theta-to-uppercase.cjs
migrate-to-iti-auth.cjs
migrate-to-iti.cjs
migrate-usernames.js
normalize-arrow-sprite-v2.cjs
normalize-arrow-sprite.cjs
normalize-sequences.cjs
purge-thumbnail-cache.js
remove-position-fields.js
remove-stale-start-positions.cjs
remove-stray-semicolons.cjs
strip-color-fallbacks.cjs
strip-desktop-assets.cjs
strip-font-fallbacks.cjs
strip-noise-comments.cjs
```

</details>

---

## Phase 7: Stale i18n Keys

`messages/en.json` has 2,695 top-level keys. An estimated ~1,260 are stale (no corresponding `$t()` call in source).

**Action (2 steps):**

1. **Regenerate types:**
   ```bash
   npm run i18n:types
   ```

2. **Prune stale keys:**
   ```bash
   npm run i18n:validate:fix
   ```

   This runs `scripts/validate-i18n.cjs --fix`, which removes keys from `messages/en.json` that have no `$t()` reference in source.

3. **Verify no regressions:**
   ```bash
   npm run i18n:validate
   npm run check
   ```

---

## Execution Order

| Step | Phase | Risk | Estimated savings |
|---|---|---|---|
| 1 | Phase 5: Delete stale root files | None (zero references) | 26.8 MB disk |
| 2 | Phase 1: Remove 17 unused packages | Low | install speed + lockfile size |
| 3 | Phase 2: Fix 3 misplaced deps | Low | correctness |
| 4 | Phase 6: Archive one-time scripts | None | directory clutter |
| 5 | Phase 7: Prune i18n keys | Low (validate after) | type accuracy |
| 6 | Phase 3: Security audit fixes | Medium (test after) | 112 -> target <10 vulns |
| 7 | Phase 4a: Delete dev screenshots | None (zero references) | 249.8 MB disk |
| 8 | Phase 4b: Convert codex/tree PNGs to WebP | Medium (update 2 Svelte imports) | ~120 MB disk |
| 9 | Phase 4c: Compress avatar GLBs | Medium (verify visual fidelity) | ~400-550 MB disk |
| 10 | Phase 4d: Resize austen-fire.jpg | Low (update refs) | ~15 MB disk |

**Total estimated disk savings:** ~810-960 MB

---

## Verification Checklist

After each phase:

- [ ] `pnpm install` succeeds
- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] `npm run test:ci` passes (if tests exist for affected areas)
- [ ] `pnpm audit` shows reduced vulnerability count (after Phase 3)
