# East Posture and Staff Grip — Handoff (2026-09-01)

## Mission

Make the shared 3D performer solve anatomically credible same-side two-staff holds. At East or West, the chest and head must face the props, both arms must remain in front of the torso with elbows routed outward, and audience-overlaid grips may separate in hidden depth. At South, the body stays square and the hands separate left/right. The frozen `/test/staff-grip` inspector is the proof surface, but the behavior owner must remain shared with the production viewer.

## Done — verified

No implementation commit exists yet. The current work is deliberately left uncommitted because package regeneration produced an unsafe oversized patch that must be repaired before commit.

## Believed done — unverified

- A stable root-local stance reference was added to `AvatarAnimator`; runtime sampling showed requested yaw `-90.000°` and achieved yaw `-89.101°` for 30 consecutive frames instead of alternating between roughly `-86°` and `0°`.
- Motion-relative phase mapping in `LiveSequencePerformer3D` was moved past the reserved start-pose slot. Afterward, phase `7.99` rendered step 8 at South with `0` collisions instead of rendering the prior East beat.
- The shared stance planner now requests a full side turn for coherent East/West pairs and zero turn at South/opposed pairs.
- A mirrored hidden-depth route was added for the far hand. At East, increasing the far-hand offset to `0.16 m` reduced the measured red-staff torso penetration from `31.791 mm` to `0 mm`, while both palm contact offsets and shaft-axis errors remained `0.000`.
- Visual inspection showed the East-facing head and shoulders remained side-on after the collision reached zero, but this needs adversarial multi-avatar and full-sequence review before acceptance.

## In flight

- Branch: `codex/east-posture-planner`
- Worktree: `E:\tka-platform-east-posture-planner`
- Own dev server was running on `http://127.0.0.1:5194`; session ownership belongs to the prior agent and may no longer be alive.
- Modified files are uncommitted:
  - `patches/@austencloud__scene-3d@0.1.6.patch`
  - `pnpm-lock.yaml`
  - `src/lib/shared/3d/collision/upper-body-stance-planner.ts`
  - `src/lib/shared/3d/components/Viewer3DScene.svelte`
  - `src/lib/shared/3d/performers/LiveSequencePerformer3D.svelte`
  - `src/routes/test/staff-grip/+page.svelte`
  - `tests/unit/3d-animation/avatar-head-clearance-policy.test.ts`
  - `tests/unit/3d-animation/staff-grip-contact-contract.test.ts`
  - `tests/unit/3d-animation/upper-body-stance-planner.test.ts`
  - this handoff document
- `.pnpm-patches/scene-3d` is an untracked task-owned patch edit directory.
- Focused verification passed before the final telemetry additions:
  - `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/3d-animation/upper-body-stance-planner.test.ts tests/unit/3d-animation/staff-grip-contact-contract.test.ts tests/unit/3d-animation/avatar-head-clearance-policy.test.ts`
  - Result: 3 files passed, 29 tests passed.

## Loose ends (ranked)

1. Repair package patch generation before any commit. The current patch diff is unsafe: `10,755` added and `3,091` removed lines, largely because `svelte-package` regenerated unrelated distribution files. Preserve only the intended `AvatarAnimator` stable-reference changes and `PerformerRig` per-hand depth-offset additions against the existing baseline patch.
2. Adversarially review the architecture with subagents. One should challenge the body/IK design and the fixed `0.16 m` depth policy; another should independently run frozen-frame and multi-character collision sweeps. Do not accept the current solution because its single fixture reached zero.
3. Re-run focused tests after patch repair, then run the appropriate project check. Add a behavioral regression for consecutive-frame stance stability if feasible; the current test is mostly a source/runtime contract.
4. Verify exact frozen frames: step `7.99` (both East, `beta3`) and step `8.99` (both South, `beta5`). Record requested/achieved yaw, head dodge, audience-plane grip separation, hidden depth separation, collision zones, and contact/axis errors.
5. Sweep the entire FALG sequence and at least three materially different character rigs. Reject any arm-through-face/neck/torso, arms-through-each-other, prop-through-body, or unstable elbow-pole frames.
6. Inspect whether `24°` head dodge at East is visually justified after the staff/body collision is gone. The head faces East in the latest screenshot, but a conservative threat envelope may still be overreacting.
7. Confirm the phase-offset fix does not add a static start-pose beat when live ambient performers loop.
8. Only after adversarial proof: commit explicit owned paths, bring branch current with `main`, finish through `npm run wt:finish -- codex/east-posture-planner --route /test/staff-grip`, and show the integrated `https://localhost:5173/test/staff-grip` route.

## Decisions already made

- Austen’s 2026-09-01 policy: both props at East means the chest/head face fully East, the shoulders are square to stage right, arms stay in front, elbows point outward, and the props overlay from the audience view.
- At South, the props separate left/right rather than forcing a front/back stack.
- Frozen frame-by-frame inspection is the acceptance workflow. Do not move on from a bad frame without explaining and correcting the categorical cause.
- Use shared production owners. The inspector may expose telemetry but must not carry its own pose hacks.

## Gotchas

- `stepConfigs[0]` is a reserved start pose. Motion beat N lives at index N. The previous inspector mapping rendered phase `7.99` from index 7, which was one beat early.
- The stance oscillation came from copying `_bodyFrame.forward` after it already contained the prior frame’s torso turn. The proposed fix caches anatomical forward in root-local space and rebuilds world forward from the root each frame.
- Runtime East sign for this fixture was `-90°`; do not flip signs from memory. Prove target direction against rendered geometry.
- Baseline East collision was `Red staff shaft → torso (3.2cm deep)`. A `0.06 m` depth route reduced it only to `19.365 mm`; `0.14 m` left `2.970 mm`; `0.16 m` produced zero detected collisions in the inspected frame.
- Chrome/DevTools restarted twice while four canvases were loaded. Treat browser instability as a possible resource/performance issue, not proof that the page is correct.
- Port 5173 belongs to Austen. Never stop or restart it. Use a task-owned port for worktree verification.
- Official solver references consulted: Epic Full-Body IK and IK Rig solver documentation, plus Unity Two Bone IK documentation. They support gross-body participation before limb IK and explicit bend-direction controls; they do not validate the current fixed depth amount.
