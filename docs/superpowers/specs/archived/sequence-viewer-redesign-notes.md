---
status: active
value: 4
effort: L
remaining: Architectural reference for Phase 2+ implementation
depends_on: ""
plan_path: plans/active/2026-04-15-sequence-viewer-redesign.md
tags: []
last_triaged: 2026-04-26
---
# Sequence Viewer Redesign: Architectural Notes + Reviewer Calibration

Living doc. Supplementary to the main spec and plan:

- **Spec:** `docs/superpowers/specs/2026-04-15-sequence-viewer-redesign-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-15-sequence-viewer-redesign.md` (24 tasks)
- **Status file:** `memory/project_viewer_redesign.md` (concise resume protocol)

This file captures discoveries that cost real token budget to surface in Phases 0-1. Future session can read this before dispatching Phase 2 subagents and save 5-10k tokens of re-derivation.

Last updated: 2026-04-15 (paused mid-Phase-2).

---

## Architectural context that cost token budget to discover

**`AnimationEngine` is a class, not a factory, and only exists on the 2D path.**
The 2D pipeline goes: `AnimatorCanvas.svelte` → owns an `AnimationEngine` instance → owns a VM → drives the canvas. The 3D pipeline goes: `Viewer3DScene` → `AvatarInstanceState` per performer → `PerformerRig` consumes `_settings.effortId` directly in `easedFrame`. That's why Task 5 (effort-wiring helper) is 2D-path-only and Task 5.5 is the 3D-path parallel.

**`PropType` is an enum, lowercase values.**
Import from `$lib/shared/pictograph/prop/domain/enums/PropType`. Values are `"staff"`, `"fan"`, `"club"`, etc. — lowercase, not PascalCase. Tests that compare PropType string-literals must use lowercase.

**`AvatarInstanceConfig` uses `positionX: number`, not `initialPosition: {x, z}`.**
The per-performer seed config is flat x/z numbers on the config object itself. Don't reach for a nested position object.

**Per-performer state lives on `AvatarInstanceState`.**
Effect/effort/prop settings belong on `AvatarInstanceState._settings` (Task 3 established this). Don't add new per-performer maps at higher levels — that denormalizes the data carrier.

**8 effects are alive day one.**
Trails / fire / charcoal / led / electricity / sparkles / motion / bloom. The Phase 1a work on effects unification (parallel project) wired the 2D parity for these. The viewer redesign's `EffectsSettingsPanel` accepts `performer?` prop and renders 8 effect chips; if the unified-panel swap lands before Phase 3 of viewer redesign completes, coordinate with the effects-unification memory before touching chip count.

---

## Reviewer calibration notes

Apply to every review dispatched while the plan is executing.

### Haiku spec reviewers have hallucinated failures

Multiple times during Phase 0-1, a haiku spec-compliance reviewer read factory code and inferred test failures that didn't exist. They pattern-matched on "this looks wrong" instead of running the suite.

**Fix:** Every spec-reviewer dispatch prompt must include the literal instruction:

> VERIFY EMPIRICALLY — run `npm run check` and the relevant test files. Do not infer pass/fail from reading factory or production code. Your report must cite actual command output.

This is non-negotiable. Without it, you'll burn two rounds of "reviewer says X fails / implementer proves X passes" before discovering the reviewer never ran anything.

### Pre-existing issues outside scope

Reviewers will sometimes flag nits that predate the current work. Example: orphaned `onExitFullScreen` prop in `Viewer3DCanvas.svelte:40` was flagged during Task 10 review but has been there since before the redesign started.

**Fix:** Document pre-existing issues in the review report but do NOT fix them in-scope. They become their own follow-up tickets. Scope discipline prevents the PR from ballooning.

### `RenderModeToggle.svelte` is temporarily orphan

After Phase 1 (Task 8, 9, 10), `RenderModeToggle.svelte` is unmounted from all call sites. It is NOT dead code — Task 13 re-homes it inside `ViewerHeader`. Do not delete it during Phase 1 cleanup reviews.

---

## Resume protocol (also in memory)

When resuming:

1. Read Task 11 from the plan: `docs/superpowers/plans/2026-04-15-sequence-viewer-redesign.md` offset 841.
2. Invoke skill `superpowers:subagent-driven-development`.
3. Dispatch implementer with full Task 11 text + scene-setting context:
   - "`ViewerHeader` (Task 13) will eventually re-home `RenderModeToggle`. Don't delete it."
   - "This is the first chrome-shell component; treat it as a reference pattern for Tasks 12-15."
4. After implementer reports DONE → spec-compliance reviewer (haiku) with the empirical-verification instruction above.
5. Then code-quality reviewer (superpowers:code-reviewer).
6. Loop to Task 12. Repeat through Task 24.

Phase 2 remaining (Tasks 11-15) → Phase 3 (Tasks 16-20: popover contents) → Phase 4 (Tasks 21-24: integration + validation).

---

## Open questions for Phase 4

**`webgl2Available` prop on `ViewerHeader`** (surfaced in Task 13 code review, commit `0d1904bae6`).
The existing `RenderModeToggle` requires a `webgl2Available: boolean` prop. Task 13 threaded it through `ViewerHeader`'s public contract so callers must pass it down. Reviewer flagged this as a minor coupling leak — every Phase 4 call site will need to plumb WebGL2 capability down through the header even though the header itself doesn't use the value.

Three options when Phase 4 starts wiring call sites:
1. **Keep as-is** — callers already know WebGL2 capability (they bootstrap the 3D pipeline). Pass-through is fine. Add JSDoc noting it forwards to the toggle.
2. **Context/store read** — `RenderModeToggle` reads from a WebGL capabilities context/store; removes the prop from both components. Cleaner separation, but requires touching a component that's currently stable.
3. **Snippet prop** — caller provides `RenderModeToggle` as a Svelte snippet with its props pre-applied; `ViewerHeader` just renders the slot. Most decoupled, but snippet-prop for a single child may be overkill.

Resolve before wiring 4 call sites in Phase 4 (Tasks 21-24).

**`PlaybackControlBar` vs `ViewerTransportBar` parallel implementations** (surfaced in Task 15 code review, commit `80051706a5`).
`src/lib/shared/3d/components/controls/PlaybackControlBar.svelte` (238 lines) already implements play/pause + progress + loop with a reusable props-driven API. Task 15 re-solved the same problem instead of extending it — violates `feedback_reuse_existing_components`. The immediate visual regression was fixed in the follow-up polish commit (duplicate inline progress bar deleted). Architectural resolution deferred to Phase 4: either (a) delete `PlaybackControlBar` if nothing else uses it, or (b) refactor `ViewerTransportBar` to compose `PlaybackControlBar` with transport-bar styling. Grep usage before deciding. Also: `formatTime` is now duplicated in 5 components — extract to `src/lib/shared/sequence-viewer/utils/format-time.ts` as part of Phase 4 cleanup. Drag-to-scrub is a deliberate scope call — if users ask for it, wire `pointerdown` + window `pointermove`/`pointerup` then.

**`.top-controls` vs `RightRail` semantic + spatial overlap** (surfaced in Task 14 code review, commit `33c02ad859`).
The existing `.top-controls` block in `Viewer3DCanvas.svelte` hosts `Viewer3DGearPopover` at `top: 12px; z-index: 10`. Task 14's `RightRail` sits at `top: 76px; z-index: 9` with a `gear` chip and a `performers` chip — both semantically duplicate gear-popover content. Phase 3 (Tasks 16-20) must either (a) absorb `Viewer3DGearPopover`'s content into the rail's gear popover and remove the old component, or (b) remove the duplicate gear chip from the rail. Verify the Phase 3 task list addresses this before starting Task 16.

---

## Completed work reference

**Phase 0 — Foundation (Tasks 1-7 + 5.5), 9 commits on main:**
| Task | Commit(s) | What |
|------|-----------|------|
| 1 | `87a8e52501`, `e381a0a386` | Grid scene-feature removed, dangling ref fixed |
| 2 | `ae2201b3a7` | Exclusive popover-stack state on viewer-3d-state |
| 3 | `0600bea402` | `PerformerSettings` on `AvatarInstanceState` (effortId / prop / effects) |
| 4 | `11317b8fb8` | `AnimationEngine.setPerformerEffortResolver` (2D path) |
| 5 | `62d84b95e9` | Effort-wiring helper (2D, dormant until canvas refactor) |
| 5.5 | `6a5d45684e` | 3D pipeline reads `_settings.effortId` directly in `easedFrame` |
| 6 | `15a548a3a7` | `resolvePerformerProp` helper; `Viewer3DScene` uses per-performer prop |
| 7 | `0727ae393c` | `EffectsSettingsPanel` accepts `performer?` prop, 8 effect chips |

**Phase 1 — Chrome removals (Tasks 8-10), 4 commits:**
| Task | Commit | What |
|------|--------|------|
| 8 | `6e071a8ff1` | `RenderModeToggle` out of `ViewerFooter` + drawer host |
| 9 | `9e9fc7ebc8` | `RenderModeToggle` + layout label out of `RecordSceneChrome` |
| 10 | `7b84276fc9` | `NavModeToggle` unmounted from `Viewer3DCanvas` (kept component + state) |
| - | `2558eb3e15` | JSDoc cleanup (reviewer nit) |

Total: 12 commits.
