# Autumn 2D Redesign for Opus — Handoff (2026-08-06)

## Mission

Redesign the Autumn 2D background so it has a deliberate authored identity instead of the old gradient-plus-falling-leaves treatment. Austen has rejected the current prototype as "not quite right" and explicitly wants Opus to take over. Treat the current result as working machinery and visual evidence, not an approved art direction. The attempted direction is recorded in [the living Autumn clearing design spec](./active/2026-08-06-living-autumn-clearing-design.md), but Opus is authorized to challenge its composition while preserving Austen's hard constraints below.

## Done — verified

- The attempted 2D design spec is committed in `be7e94f33c` (`feat(backgrounds): author the living autumn clearing`). Evidence: `git log -1 -- docs/superpowers/specs/active/2026-08-06-living-autumn-clearing-design.md` returns that commit. The spec records the attempt; it is not evidence of Austen's approval.
- The short-viewport Lab CSS adjustment is committed in `627a09c1f4` (`fix(backgrounds): fit the autumn lab to short viewports`). Evidence: the 960×412 screenshot at `C:\Users\Austen\AppData\Local\Temp\autumn-final-960x412.webp` shows the controls and preview side by side instead of a 600 px-tall overflow. This verifies layout containment only, not the rejected visual design.

## Believed done — unverified

- The extraction of the existing Forest owl silhouette into a shared pure renderer is mechanically equivalent, but Forest itself did not receive a visual regression screenshot. If the redesign keeps this extraction, compare Forest before and after.
- The full application background host was not verified against a published package version. Verification used a temporary local package build injected into TKA's installed package, then restored byte-for-byte.
- No package release, version bump, dependency update, or production deployment has happened.

## In flight

### TKA repository

- Checkout: `E:\tka-platform`, branch `main`, observed HEAD `a7f1720b7bfe1f78a3ad8fe3f7c471a1fb98de27` on 2026-08-06. No branch or worktree was created.
- `src/lib/features/background-builder/components/AutumnLab.svelte` is modified. The current uncommitted delta adds a compatibility interface so TKA can type-check while the installed `@austencloud/backgrounds@0.7.2` lacks the new methods. The broader control/UI rewrite was swept into concurrent commit `be7e94f33c` while this task was still active.
- `src/lib/features/background-builder/components/LabPreviewCanvas.svelte` is modified. The uncommitted delta adds a `ResizeObserver` so the backing canvas follows element-level layout changes; this fixed the squashed moon found at 960×412.
- `src/routes/test/autumn-2d/+page.svelte` is deleted in the working tree. It was a disposable verification harness created during this task and was accidentally included in concurrent commit `be7e94f33c`. The deletion is intentional. Recreate a disposable harness only if needed, then remove it again.
- The repository contains extensive unrelated work from other live sessions. Do not stage, revert, or commit outside explicit pathspecs.

### Shared backgrounds repository

- Checkout: `E:\shared-packages`, branch `main`, observed HEAD `e403076781cfd3c4d28b4cd7a3ff7f038261ae4a` on 2026-08-06. No branch or worktree was created.
- All of the following source changes are uncommitted:
  - `packages/backgrounds/src/backgrounds/autumn/domain/constants/autumn-constants.ts`
  - `packages/backgrounds/src/backgrounds/autumn/domain/models/autumn-models.ts`
  - `packages/backgrounds/src/backgrounds/autumn/domain/autumn-composition.ts`
  - `packages/backgrounds/src/backgrounds/autumn/domain/autumn-composition.test.ts`
  - `packages/backgrounds/src/backgrounds/autumn/services/AutumnBackgroundSystem.ts`
  - `packages/backgrounds/src/backgrounds/autumn/services/AutumnSceneryRenderer.ts`
  - `packages/backgrounds/src/backgrounds/autumn/services/LeafSystem.ts`
  - `packages/backgrounds/src/backgrounds/autumn/services/WindSystem.ts`
  - `packages/backgrounds/src/backgrounds/autumn/services/WindSystem.test.ts`
  - `packages/backgrounds/src/backgrounds/forest/services/TreeSilhouetteImageLoader.ts`
  - `packages/backgrounds/src/backgrounds/forest/services/ambient/EasterEggSystem.ts`
  - `packages/backgrounds/src/backgrounds/forest/services/rendering/ForestCanvasRenderer.ts`
  - `packages/backgrounds/src/core/services/MoonRenderer.ts`
  - `packages/backgrounds/src/core/services/owl-silhouette.ts`
- The prototype currently loads exactly `dead_04.png`, `dead_05.png`, and `dead_06.png`; places them with fixed responsive geometry; draws a shared full moon, stars, ground, pond/reflection, mist, vignette, and owl; anchors leaf release zones to branch regions; and exposes real density/wind/gust controls. The exact trio was this agent's choice, not Austen's command. Opus may choose other catalog silhouettes or create new silhouettes and scene components.
- Mechanical verification for this uncommitted implementation:
  - `pnpm --filter @austencloud/backgrounds build` passed.
  - `pnpm --filter @austencloud/backgrounds test` passed: 14 files and 78 tests.
  - `pnpm exec svelte-check --tsconfig ./tsconfig.json` passed in TKA after the compatibility interface was added.
  - `npx tsc --noEmit` in TKA still reported 24 unrelated existing errors in Choreo Card, Museum, shared 3D animal, Browse, Inbox, pictograph tests, and viewer actions. It reported none in the touched Autumn files.
  - Browser network evidence showed only `/images/trees/curated/dead_04.png`, `dead_05.png`, and `dead_06.png` requested for trees.
  - The Normal-to-Dense control changed live stats from 100 to 145 leaves.
  - Toggling Moon changed the sampled moon-center mean RGB from `236.06` to `32.08`.
  - Pointer movement shifted the detected moon centroid by `4.23 px`, proving preview pointer forwarding.
  - A direct import of the current built Autumn system with reduced motion enabled produced identical frame checksums: `[569663,164547676]` twice. The running 5173 dependency prebundle was stale, so this direct-source check was necessary.
  - Visual screenshots of the rejected prototype exist at:
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-1920x1080.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-2560x1440.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-3840x2160.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-1440x900.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-820x1180.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-960x412.webp`
    - `C:\Users\Austen\AppData\Local\Temp\autumn-final-375x667.webp`
- The temporary package injection under `E:\tka-platform\node_modules\@austencloud\backgrounds\dist` was restored from backup and SHA-256 compared file-for-file; the comparison returned `MATCH`. The task-owned Vite server on port 5175 was stopped, emulation was cleared, and the task-owned Chrome tab was closed.

## Loose ends (ranked)

1. Start with the seven screenshots and make a fresh visual judgment. Do not preserve the current composition merely because its code works. Austen has explicitly rejected the result.
2. Recompose with the existing curated spooky-tree silhouettes. Audit all 18 `dead_*.png` assets before choosing. Keep an open content field, but avoid the current obvious Halloween-postcard framing. The present likely weaknesses are oversized/cropped branches, bright confetti-like leaves, a mechanically striped pond reflection, and insufficient visual hierarchy. These are the previous agent's diagnosis, not a quoted Austen critique.
3. Decide what survives. The targeted image loader, fixed gust envelope, anchored leaf emission, pointer plumbing, and `ResizeObserver` are independently useful. The chosen assets, moon position/style, pond, owl, palette, leaf count, and layer UI are all fair game.
4. If the owl remains, visually regression-test Forest because its private owl geometry/rendering was extracted. If the owl goes, consider reverting that extraction to reduce scope.
5. Re-run the complete package build/tests and TKA Svelte check. Repeat the seven-viewport screenshot sweep and interactive checks. Show Austen the revised visual before calling it done.
6. Only after visual approval, isolate and commit the shared-package files with explicit pathspecs, publish/version the package through the normal release flow, update TKA's dependency, and verify the actual production background host. Do not publish from the currently dirty shared-package checkout.

## Decisions already made

- On 2026-08-06 Austen rejected any return to the retired procedural tree route: "Oh hell no we're not going to use the Bear tree branch generator in Purlin Noise we threw all of that away."
- Do not restore `BareTree`, procedural branch generation, Perlin noise, or random ecological tree selection. That retired generation route is the rejected part.
- On 2026-08-07 Austen clarified that the existing Forest silhouettes are options, not a constraint. New trees, new scene components, and ChatGPT-generated silhouettes are allowed. The current exact `dead_04`/`dead_05`/`dead_06` selection is not sacred.
- Austen authorized implementation with "I trust you. make me swoon," then rejected the resulting prototype on 2026-08-06 and assigned the next visual pass to Opus.
- Work stays on `main`. Do not create a branch or worktree without Austen explicitly requesting that exact action.

## Gotchas

- `@austencloud/backgrounds` is a separate repository at `E:\shared-packages`; TKA's installed package is version 0.7.2 and is not linked to that checkout. Source edits there do not appear in TKA until a build is temporarily injected or a package is released.
- The shared-package checkout already contains unrelated in-flight edits. A normal build compiles them into `dist`, so publishing from that dirty checkout would ship other sessions' work.
- Port 5173 is Austen's HTTPS dev server. Never restart or kill it. The disposable 5175 server used here could not retain the 5173-origin app state and redirected away from admin Lab routes.
- Chrome mobile emulation can trigger a full application reload. Wait until the page title is `Autumn 2D verification` and the canvas exists before taking screenshots; otherwise the screenshot captures the loading splash.
- The 5173 Vite dependency prebundle can remain stale after copying a new package build. Direct raw-module imports or a fresh forced server are more reliable for deterministic code checks.
- `MoonRenderer` previously called `Math.random()` while drawing crater rays, causing micro-shimmer even when higher-level animation was frozen. The uncommitted `stableUnit()` change makes ray geometry deterministic.
- A one-shot window resize handler left the canvas backing size stale after responsive layout changes, stretching circles into ellipses. The uncommitted `ResizeObserver` change fixes this shared preview-shell defect.
- Concurrent work committed intermediate task files while this session was still running. In particular, `be7e94f33c` swept in the initial Autumn Lab/spec/harness with a large 3D Autumn commit, and `627a09c1f4` swept in the short-viewport CSS. Inspect current diffs and history before assuming commit ownership.
- The screenshots are evidence of the rejected prototype, not a target to reproduce.
