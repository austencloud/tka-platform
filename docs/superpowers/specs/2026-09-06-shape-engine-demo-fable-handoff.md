# Shape Engine app fixes and demo v3 — Fable handoff (2026-09-06)

## Mission

Austen asked Astra to produce a beautiful, wordless, social-ready demonstration of Shape Engine, revise both landscape and portrait videos from detailed feedback, fix the actual app defects uncovered, and obtain adversarial audits. On September 6, Austen explicitly paused implementation because account usage reached 1% and requested this handoff for Fable. **The task is unfinished. All 25 fresh scene recordings exist. Final v3 exports, final adversarial review, and repository integration are not yet established.** Continue the existing work; do not start over or deliver the preliminary storyboard as finished work.

## Start here

1. Read this file and `E:/tka-platform-media/shape-matrix-demo-2026-09-05-v3/production/SOUNDTRACK-HANDOFF.md` if present. The soundtrack worker was asked to stop starting new work and record its exact state there. Its last assignment was encoding the remaining eight scenes, revising picker-card occlusion, then rendering both videos. Inspect actual artifacts/processes before launching duplicates.
2. Use existing worktree **E:/tka-platform-shape-engine-demo-layout**, branch **codex/shape-engine-demo-layout**. Base HEAD at handoff preparation: `f921885f2f4bfbaf933d62af8e8b644d0236a03d`. All app implementation changes remain uncommitted deliberately. This handoff will receive its own scoped documentation commit; no app implementation commit or integration has occurred.
3. Media root: **E:/tka-platform-media/shape-matrix-demo-2026-09-05-v3**. Its `production/RENDERING.md` is the command runbook; `production/final_render.py` is the current moving-video renderer; `production/storyboard.json` contains the 25-scene plan. Old `render.py` and storyboard HTML are design studies, not final output.
4. Finish native encodes, preview actual compositions, then render. In parallel with rendering, finish focused app verification and prepare scoped commits. Obtain independent adversarial review of final encoded frames and actual action/result timing. Do not claim an objectively proven 10/10.

## Decisions already made

Austen's September 5–6 instructions are authoritative and already authorize these app/video changes. No new approval checkpoint is needed for routine implementation or local verification.

- Make every scene intentionally composed. The original mostly empty title half beside a small app was rejected. Show large actual patterns, useful teaching cards, canonical element art, and visual hierarchy.
- Lead the next review with **every scene's action and result**, preferably readable paged contact sheets and click-to-seek review HTML. Austen should not need to watch four minutes again to assess the layouts.
- Use FAC's real GhostPointer from the landing/composer preview: glowing dot and motion trail. It must track real native movement, hover, press, release. Decorative overlays followed by DOM `.click()` are insufficient.
- Essential landscape text must stay above the bottom **140 pixels of 1080p**, clear of visible player controls. Essential social text must respect top/bottom/right overlays (current renderer targets roughly y258–1480). Footer branding is nonessential; teaching captions are not.
- Replace AI-sounding fragments such as “Same direction. Three timings.” with natural explanations, e.g. “Pick from six modes of timing and direction.” Use full capitalized Timing/Direction names, canonical icons and colors, uppercase abbreviations.
- Explain Levels as progressively finer turn increments and more available patterns. Avoid implying every higher-level pattern is harder. Explain Ratio Playground includes ratios outside TKA's quarter-turn ladder.
- Credit VTG significantly. **Latest steering supersedes earlier prominent-header attribution:** app top-left only “Shape Engine”; one About/info button top-right; source links and attribution inside About. Acknowledge Lorq's matrix inspiration without implying he primarily authored this independently built FAC tool.
- Video credit scene should show concise readable cards beside live art, not the dense About modal.
- Desktop Effects/Effort/Playback/Display belong in the left matrix workspace while right-side modes, relationships, stage and timeline remain mounted. Compact layout uses a bounded settings sheet and retains visible relationship controls.
- Prop picker must use available space deliberately and keep consistent family tile sizes. Avoid two enormous Premium squares or stranded narrow categories.
- Clicking animation canvas must pause/resume in BOTH Matrix and Ratio Playground, with keyboard support where appropriate. Selecting step-by-step must actually cause holds, not merely change a selected control.
- Trail smoothness at speeds beyond the device's rendering capacity is an underlying animator concern. Do not casually refactor the core animator under this task.
- No deployment, posting, or external messaging is authorized. Local guarded integration is authorized by repository workflow.

## Done — verified (implementation uncommitted)

These have evidence but **no implementation commit SHA yet**. Preserve the dirty worktree.

- Matrix canvas click pauses actual frames and another click resumes. Evidence: `production/app-verification/canvas-pause.json` compares canvas hashes across a 900ms paused interval and after resuming. Final authentic recording `production/frames/06-playback/capture.json` contains native step selection at 3.331s and canvas clicks at 6.357s and 8.949s; Play button count was 1 during pause. Capture is 15s, 558 frames.
- Matrix step mode produces actual prop-pose holds, approximately 247ms/358ms/265ms in the sampled run. Evidence `matrix-step-props.json` and `matrix-step-samples.json` in app-verification. Mode switching while paused retained pause. Shared InlineAnimationPlayer receives externalPlaybackMode and restarts a running controller appropriately.
- Theory canvas is a native accessible button, labels Play/Pause theory animation, Enter/Space behavior. Evidence `theory-canvas-pause.json`: the LAST canvas is the visible Theory canvas; its hash stays identical while paused and changes after Enter resumes. Hidden retained Matrix canvas hashes may change; do not confuse them with Theory evidence.
- Theory step mode is reactive and visibly holds. The worker found the previous plain visibility-manager getter did not invalidate Svelte. `playbackMode` now uses local `$state` mirrored to scope.visibility. Evidence `theory-step.json`: five identical visible-canvas hashes from ~794ms to ~1049ms, then changing frames resume. Focused state and theory-clock tests passed **7/7**, last reported after this reactive fix.
- Native pointer recordings use the real FAC GhostPointer component. Every action in completed capture proofs has verified native `:hover`, not a fake pointer plus DOM clicks. All **25 final source folders** have `capture.json`; rejected or interrupted takes are separately preserved under `production/rejected`.
- All seven layout dimensions were exercised in the browser and showed no document horizontal overflow: 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160. `tiers-final.json` records one active settings panel at each. **This does not establish all seven screenshot passes**: see the capture defect under unverified work.
- Source worker ran focused tests, formatting, diff checks and Svelte compilation; SSR `/shape-engine` returned 200. A broad incremental check reported pre-existing errors and none in owned files. Do not present that as a clean repository check; the mandatory integration gate remains pending.

## Believed done — unverified / incomplete

- Final landscape/social v3 videos: not present when root started this handoff. Soundtrack worker may finish an active operation; inspect its handoff and filesystem. Never substitute v1/v2 or source-pending HTML.
- Final adversarial visual/copy/factual audit has NOT been run on encoded v3 output. Previous independent source reviews were useful but do not prove the new rendered videos are flawless.
- Large-screen browser screenshots contain repeated or cropped compositor tiles at 2560/3840, and some 820 screenshots also repeat. **These are invalid visual evidence**, despite valid DOM geometry. Latest operation before user interruption was reading viewport and screenshot API documentation to correct this. Try the documented `tab.screenshot({fullPage:false})` API rather than raw CDP screenshot; only raw CDP had been tried for final high-resolution shots. Inspect actual images before claiming a pass.
- 200% zoom test not yet completed. About modal should still get direct phone/desktop inspection. Compact active-surface/focus guard got geometry verification, but focused Escape/focus restoration across Matrix/Theory switching should be checked once more.
- Final renderer needs inspection of props-open moments: worker reported a lower action card covered part of the matrix/picker. It was assigned to fix this. Teaching cards must not cover the controls being demonstrated.
- Final render validation, full decode/black-frame/audio checks, SHA manifest, publishing notes and final caption metadata remain pending.
- App changes need scoped review/commit and mandatory guarded integration. Full repository check may fail from baseline errors; if so leave branch/worktree intact and report exact blocker rather than bypassing gates.

## In flight — source ownership map

Run `git status --short` in the task worktree for authoritative paths. A binary tracked diff backup exists at `production/app-changes-handoff.patch`; it does NOT include untracked files. The worktree is the authoritative complete implementation.

- `src/lib/shared/animation-panel/components/AnimationPanel.svelte`: optional full/navigation/content presentation, controlledSection, canonical pill body exposed for external settings workspace. Default behavior remains full.
- `src/lib/shared/shape-matrix/app/components/ShapeMatrixSettingsOverlay.svelte` NEW: canonical DrawerHeader + AnimationPanel content over left grid, opaque floor, canonical transition, Escape/focus lifecycle; theory effect choices restricted to supported canvas effects.
- `ShapeMatrixMatrixPane.svelte`, `ShapeMatrixTheoryPane.svelte`: settings/prop overlays in left grid workspace; covered grid inert and aria-hidden.
- `ShapeMatrixDrill.svelte`: persistent mode/relationship/timeline region, interactive InlineAnimationPlayer, external playback mode, compact sheet, optional app context for old consumers. Removed obsolete controls-open landscape grid rewrite. Compact settings guard checks active app surface and detail view to avoid hidden retained panes competing for focus. Short-landscape sheet starts after 18rem mode rail.
- `ShapeMatrixTheoryDetail.svelte`: same persistent relationships and compact focus lifecycle; native stage button; forwards playbackMode; corrected boundary explanation. Compact sheet begins after clamp(13rem,30%,17rem) rail.
- `ShapeMatrixLiveRatioStage.svelte`: step clock integration, 300ms holds. New `services/theory-playback-clock.ts`, with two focused tests in `tests/unit/shape-matrix/theory-playback-clock.test.ts`.
- `app/state/shape-matrix-animation-state.svelte.ts`: reactive local playbackMode mirrored to manager, settings section state, relationship restore clears controlled section, disassemble no longer closes settings. Updated state tests.
- `features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte`: externalPlaybackMode optional; applies at initialization and changes without losing intended playing state.
- `ShapeMatrixDetailPane.svelte`: removed obsolete relationships-return header.
- `ShapeMatrixAppShell.svelte`: only larger Shape Engine identity + About; source link/tagline/obsolete compact return UI removed.
- `ShapeMatrixAboutModal.svelte`: Austen's independent FAC tool first, VTG/Noel Yee/Vulcan community credit, separate Lorq/Spin Science matrix inspiration and source links, clear notation explanation. `shape-engine-identity.ts`, `shape-matrix-levels.ts` copy updated.
- `app/context/shape-matrix-app-context.ts`: optional getter added, mandatory getter preserves throw. Existing unrelated TunnelSourcePicker appears to lack mandatory animation context already; don't claim every shared consumer was tested or expand into unrelated repair.
- `shared/settings/components/tabs/prop-type/BentoPropGrid.svelte`: opt-in fluidSections only used by ShapeMatrixPropOverlay. Standard full-width group; Novelty/Premium side-by-side at ≥700px; 140–168px family tiles prevent giant sparse groups. Default layout preserved for other pickers.
- `ShapeMatrixPropOverlay.svelte`: opaque floor and fluidSections.
- NEW `scripts/demo-capture/`: CapturePointer.svelte, mount-pointer.ts, browser-director.mjs, encode-frames.py. These are authorized reusable capture tooling. Need final formatting/documentation review and scoped commit.
- UNTRACKED `vite.capture.config.ts` is **task-only environment workaround**, not app source to commit. Preserve its contents in media before removing for clean integration.

## Capture inventory and production

All raw originals live under `production/frames/{id}/NNNNN.jpg` plus capture.json. Capture proofs include exact frame timestamps, native events, URL and DOM snapshot. Do not overwrite them. If retaking, move the old folder to a unique rejected/archive name first. Old v1 and v2 roots are immutable.

Full story order (25):
`01-hook,02-pairing,03-same-direction,04-opposite-direction,05-hands-props,12-level-one,13-level-two,26-mixed,14-half-turns,15-float,16-quarter-turns,25-phase,17-notation,06-playback,07-display,10-props,11-effort,08-effects,18-playground,19-ratios,20-link,21-boundary,22-surprise,23-about,24-outro`.

Social uses eight: 01,02,03,04,12,10,19,24. No 09-fire source is needed.

At last worker report, raw-desktop MP4s existed for 01,02,03,04,05,06,07,10,11,12,13,14,15,16,17,25,26. Remaining eight were assigned to worker; inspect its final handoff. Encodes preserve original capture timestamps and convert to 30fps, H264. Do not call them native 30fps; source cadence varies ~17–45fps with load. Scene01 has startup unevenness; renderer currently trims its first second. Re-record only if actual final motion warrants it.

Important actual content: 19 demonstrates left 3:7 against right 2:5. 20 links columns to rows (both3:7) then edits both to3:8. 21 resets both3:7 and opens “Why no letter or level?”. 22 randomizes to13:10 vs15:11 in this take; don't claim fixed example values in its generic discovery copy. 23 records About for proof, but final credits should use24 live artwork. 24 is a clean Fan animation, Matrix Level2, SS, 2turns each, 60BPM, grid/glyph/step#/word hidden, Hand paths and Mandala shown.

`production/final_render.py` validates actual v3 sources and capture proofs, uses **events[].time only** (epoch frame timestamps must never drive editorial timing), holds ≥2.2s after last event, uses ~0.30s restrained text entries and brief result highlight. Outputs expected: root `shape-engine-full-demo.mp4`, `shape-engine-social.mp4`; `production/previews/final-{kind}-contact-sheet.jpg`, paged contact sheets (five scenes/page), and `production/final-{kind}-review.html` with action/result frames extracted from encoded output and click-to-seek timestamps. Check actual implementation rather than trusting this intended contract.

Runbook:
```powershell
$py = 'C:/Users/Austen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$production = 'E:/tka-platform-media/shape-matrix-demo-2026-09-05-v3/production'
& $py "$production/final_render.py" --validate all
& $py "$production/final_render.py" --preview full
& $py "$production/final_render.py" --preview social
& $py "$production/final_render.py" --render full
& $py "$production/final_render.py" --render social
```
`--preview ... --scenes ID...` support was added for targeted inspection. Check argparse for encoder arguments; two versions exist (repo reusable encoder and worker media encoder). Worker media encoder limits threads=2. Use one encode process during capture to avoid starving motion.

## Loose ends (ranked)

1. Confirm soundtrack worker/process state; finish remaining raw encodes and repair composition occlusion. Render previews from actual current sources, not old source-pending studies.
2. Render both finals. Independently audit all encoded action/result pairs for clipping, player-bar safety, factual names/values, clear result timing, pointer visibility and useful composition. Inspect actual motion/transition seams too; static sheets alone cannot prove smooth video. Fix and rerender bounded failures.
3. Finish app visual evidence: correct high-resolution capture defect, phone/About/200% zoom, focused compact Escape/focus. Don't misreport malformed screenshot passes. If a capture limitation remains, report it precisely instead of inventing proof.
4. Run closest tests if new app changes warrant it; final scoped format/diff checks. Known focused command: `npx vitest run --config tests/config/vitest.config.ts tests/unit/shape-matrix/shape-matrix-animation-state.test.ts tests/unit/shape-matrix/theory-playback-clock.test.ts`. No broad repeat until mandatory integration gate.
5. Remove/move task-only vite.capture.config.ts after server stops; retain .env secret and node_modules junction untracked. Stage only owned app/tool/test paths, commit. Read worktree rules before integration. From primary: `npm run wt:finish -- codex/shape-engine-demo-layout --route /notation/shape-matrix`. Bring current main into task branch if required. If any gate fails, keep branch/worktree; no skip-checks or destructive reset.
6. Run final media helper for each actual duration: `C:/Users/Austen/.codex/skills/fac-feature-demo/scripts/verify_media.py VIDEO --width W --height H --fps 30 --duration ACTUAL --ffmpeg FFMPEG --ffprobe FFPROBE --expected-profile High --require-faststart`. It checks metadata, full decode, black frames, audio bounds and faststart. Add hashes, actual audit results and concise posting notes. Do not imply audio listening or audience reaction was objectively certified.
7. Final delivery should lead with readable contact-sheet previews and links to review HTML/full/social/audit. State app integration status honestly. No requirement that Austen watch the long cut again to evaluate basic layout.

## Gotchas — environment and browser

- Primary `E:/tka-platform` is read-only for implementation. It has unrelated dirty files `scripts/audit-frame-budget.mjs` and `docs/superpowers/specs/flow-fest-sim/austen-site-markers.json`; preserve them and any newer work.
- **Never touch Austen's port5173** (IPv6 HTTPS2 server). Never kill pre-existing other server5428/PID33600. Task Vite is HTTP127.0.0.1:5441, started by root with exec session74137. Handoff cleanup will attempt to stop only that task server; check terminal-status note below. Restart on a free task port if needed using `node node_modules/vite/bin/vite.js --config vite.capture.config.ts --host 127.0.0.1 --port 5441 --strictPort` in worktree.
- Main node_modules has a broken zod junction (missing .pnpm/zod@4.3.6). Task node_modules is a junction to main. vite.capture.config.ts aliases zod to `E:/tka-platform-media/shape-matrix-demo-2026-09-05-v2/production/runtime/node_modules/zod`. Do not “fix” main dependencies or traverse-delete the junction. .env copied to task is secret; never print/stage it.
- Python path above has Pillow/numpy/scipy/fontTools. FFmpeg `E:/_ARCHIVE/zoom-recorder/binaries/ffmpeg.exe` v8.0.1. Working ffprobe `E:/_CLONED/juggling-refs/hawkeye/hawkeye/resources/windows/ffprobe.exe`; renderer has fallback because ffmpeg's neighboring ffprobe may not exist. Node `C:/Program Files/nodejs/node.exe`.
- Original score is `E:/tka-platform-media/shape-matrix-demo-2026-09-05/production/shape-engine-score.wav`: authored instrumental, no external recording. Real brand wordmark uses Fraunces italic700 at `E:/tka-platform/static/fonts/fraunces/fraunces-700-italic-latin.woff2`, gradient #6f8cff→#c0a3ff.
- Browser work MUST use the browser skill and supported browser runtime through Node REPL. Existing selected browser is Codex In-app Browser, task-owned tab ID1, currently5441. Do not switch to personal Chrome or external CDP bridges. Runtime import: `C:/Users/Austen/.codex/plugins/cache/openai-bundled/browser/26.901.20858/scripts/browser-client.mjs`. Bootstrap setupBrowserRuntime, reuse selected browser if bindings survive, obtain tab from `browser.tabs.get('1')`; read required docs. CDP comes from `tab.capabilities.get('cdp')`, not an external connection.
- Current Node bindings (if same session survives): agent, browser, demoTab, demoCdp, fsDemo, demoRoot, verifyDir, director, viewport. Last page state is Matrix clean Fan outro; viewport1920×1080/dpr1.5. Browser should be marked handoff and temporary overlay/overrides reset during cleanup; inspect actual state.
- **Recording scheduler fix:** latest browser-director serializes capture pumping with UI actions. It polls/acks/writes frames inside wait/move loops, no concurrent long-poll collector. Earlier collector versions intermittently froze actions and reset Node execution; repeated failed takes are archived. Do NOT restore those earlier loops. Native screencast plus Page.startScreencast max1920×1080 yields correct full1920 footage when viewport1920×1080 and deviceScaleFactor1.5. OS display scaling is1.5; raw screenshots at dpr1 often crop a2880 backing image. Large emulations produced repeated compositor tiles even with dpr1.5; unresolved.
- Director uses DOM-derived rectangles and actual native events. Global target matching includes `.chip-label` because Step# button textContent contains decorative SVG “1 2 3”. Some locator.evaluate/wait calls stalled during concurrent capture, hence current simpler target read. Stepper hover can reveal controls and shift geometry: prefer fill for linked ratio demo (already recorded), or remeasure after hover; don't fake success. Ratio link accessible label changes: equal/unlinked “Link row and column ratios”; unequal “Link column ratio to the row ratio”; linked “Unlink row and column ratios”.
- `playwright.evaluate` is a read-only synthetic DOM scope: canvas.toDataURL unavailable. For actual canvas evidence use supported CDP Runtime.evaluate, short sampled promises (<~2s unless explicit command timeout). Hidden retained Matrix canvas exists while Theory active; identify visible Theory last canvas correctly.
- Suspected TempoControl orphaned hold timer was only a worker hypothesis during recorder failures. No BPM reactive loop found, and final BPM→step→canvas pause take succeeded after recorder repair. **Do not treat that hypothesis as a proven app bug or expand scope.**

## Domain truth and copy guardrails

SS Water = Split Time / Same Direction; TS Earth = Together Time / Same Direction; QS Sun = Quarter Time / Same Direction; SO Fire = Split Time / Opposite Directions; TO Air = Together Time / Opposite Directions; QO Moon = Quarter Time / Opposite Directions. Canonical art in `/images/elements/norm/`; colors Water#3568a0 Earth#75A874 Sun#ffde17 Fire#f2673a Air#bce4f7 Moon#6a4199. Existing app concise mode labels are Split · Same, Together · Same, etc.; don't restore obsolete labels from v2 screenshots.

Level1 = zero added turns, still motion. Level2 = whole turns. Level3 = half turns and Float (prop holds orientation while hand moves). Level4 = quarter turns; only its pictograph readouts are in visual calibration, not the whole animation. UI ratio is hand cycles:prop rotations; some internal URL serialization reverses that. Ratio alone doesn't determine timing/direction. Mixed prop rates may have no single full prop TND label. Link copies rows to columns and subsequent changes affect both. URL does not restore all effect/display settings.

VTG credit source in repo: docs/museum/vtg-wing.md and ecosystem reference; Noel Yee and Vulcan Lofts community in Oakland. Lorq Nichols/Spin Science original144 matrix pairs12 driving styles per hand using1:1,1:3,1:5 families; acknowledge source-format inspiration, distinguish Austen's independent app.

## Reusable skill and reviewers

Personal skill already updated: `C:/Users/Austen/.codex/skills/fac-feature-demo/SKILL.md`, plus existing reference workflow, verify_media.py and agents/openai.yaml. Current skill requires authentic ghost/nativehover, authored scene layouts, player-bar-safe text, all-scene action/result review, and actual behavior verification. Its workflow reference could still use documentation of the new serial browser-director. User also requested ai-bust: use repo `.agents/skills/ai-bust/SKILL.md` and docs/reference/ai-writing-guide.md for remaining burned-in copy.

Existing team names if available: settings_workspace (Galileo, app playback/settings), feature_truth (Euler, source/fact audits), soundtrack (Singer, media renderer), credit_and_header (header/props), visual_audit (prior independent reviewer). Do not assume their completed statuses prove finals. Runtime allows delegation where user/repo instructions permit; use explicit model per `.claude/rules/model-routing.md` on new dispatch and bounded ownership. Follow applicable AGENTS, visual canon and testing/worktree rules.

## Terminal status / continuation record

This document was written at the user's explicit pause. Consult `production/SOUNDTRACK-HANDOFF.md` and `production/HANDOFF-STATE.json` for the latest process/artifact inventory and cleanup result. A local documentation commit preserves this handoff; application changes remain uncommitted in the dedicated worktree. Do not remove the worktree.
