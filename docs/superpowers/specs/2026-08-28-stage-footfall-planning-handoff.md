# Stage Footfall Planning to Walk Lab — Handoff (2026-08-28)

## Mission

Connect the Stage / 3D Studio timeline direction to the existing Walk Lab locomotion work without creating a second gait system. Austen wants choreography to specify performer arrival order, exact authored step counts, lead foot, gait patterns such as sidestep, cross-step, grapevine, forward/backward stepping, and the exact two-foot stance a performer lands in. The current conclusion is that **footfall plans are the underlying authored primitive**; Hands / Floor / Motion are only projections of one performance score. This handoff is architecture and experiment guidance, not approval to replace the current Walk Lab task or implement a production Stage schema without a scoped follow-on approval.

Related design baseline:

- `docs/superpowers/specs/2026-08-27-exact-step-locomotion-design.md`
- `docs/superpowers/specs/2026-08-27-3d-viewer-progressive-design.md`

## Done — verified

### Current Stage model and renderer seam mapped

Verified by current source inspection on `codex/3d-viewer-progressive-design` at `11909df413f92397b68dd69cfeb4c82bcac6858a`:

- `src/lib/features/stage/domain/stage-types.ts` stores a formation destination as body `x/z`, optional facing, `walkStyle: "direct" | "crab"`, and easing. It does not store left/right feet, stance, support, footfalls, cadence, or per-performer arrival timing.
- `src/lib/features/stage/domain/stage-formation-sampler.ts` linearly interpolates the performer root between formation spots, derives duration from the formation's shared `transitionBeats`, and derives `speedMetersPerSecond` from distance, duration, and easing.
- `src/lib/features/stage/services/stage-viewer-adapter.ts` writes the sampled root position/facing to the existing performer rig and passes derived travel direction/speed into `rig.setTravel(...)`.
- `src/lib/features/stage/locomotion/motion-matching/feature-types.ts` already includes left/right foot positions and velocities in the motion-matching feature vector. The animation layer therefore has more foot awareness than the saved Stage document.

Evidence commands:

```powershell
rg -n "FormationSpot|WalkStyle|transitionBeats" src/lib/features/stage/domain/stage-types.ts src/lib/features/stage/domain/stage-formation-sampler.ts
rg -n "leftFoot|rightFoot|footVel" src/lib/features/stage/locomotion/motion-matching/feature-types.ts
rg -n -F "rig.setTravel" src/lib/features/stage/services/stage-viewer-adapter.ts
```

### Existing exact-step owner identified

Verified by current source and tests:

- `src/lib/shared/3d/locomotion/destination-walk-plan.ts` is the canonical existing owner for exact-step mark-to-mark travel. `createDestinationWalkPlan` accepts `from`, `to`, exact integer `steps`, and cadence; it derives distance, `distance / steps`, duration, and direction.
- `tests/unit/3d/destination-walk-plan.test.ts` proves exact requested footfall spacing, exact endpoint arrival without overshoot correction, frame-partition independence, and invalid input rejection.
- `src/routes/test/walk-lab/+page.svelte` already has an Exact Mark experiment with destination distance and exact authored step count. The current 0.55–0.85 m step-length envelope is explicitly a lab heuristic, not a universal anatomical rule.
- The relevant history is already landed in this branch ancestry: `019c775b43`, `b0d840189c`, and `739184381b`; merge preservation is visible at `bb19668c7f`.

Ownership decision: **extend** `destination-walk-plan.ts`; do not create a parallel Stage-only step planner.

### Walk Lab runtime audit returned

The `Fix Walk Lab leg teleporting` task audited this handoff on 2026-08-28. Read-only inspection of its active worktree confirmed the key boundaries:

- The locomotion gait clock exposes monotonic `step`, `distanceStep`, and cadence. Cadence currently advances the clock internally; there is no external authored footfall-time input.
- `TerminalStepPlan` owns a final two-step braking/landing window, per-step root distances, a derived left/right terminal foot, cadence, terminal status, and `targetFacing`. `targetFacing` is stored but no `plan.targetFacing` runtime use exists yet.
- `FootPlanter` runs after locomotion animation as a contact/IK correction layer. Its contract does not accept authored footprint poses, foot yaw, plant beats, or arbitrary contact windows.
- Motion-matching database extraction and search utilities exist, but repository search found no runtime consumer that builds and queries that database for Stage playback.
- Faithful behavior today is therefore limited to straight `from`/`to` travel, exact alternating step count, per-step root distances, uniform cadence, derived terminal foot, terminal status, supported turn clips, and observed contact diagnostics.
- Exact lead-foot choice, arbitrary two-foot goal stance, curved paths, crossed steps, grapevine, and arbitrary footprint schedules are not currently faithful runtime inputs.

The Walk Lab task reports 65 focused tests passing and `svelte-check` with zero errors and warnings. That output was produced in the Walk Lab task and was not rerun from this Stage worktree. Its branch remains dirty and uncommitted pending its required scoped commit confirmation.

### External model checked against established practice

Verified sources:

- Autodesk's current footstep workflow separately authors left/right foot placement, step order, plant timing, and double-support periods: <https://help.autodesk.com/cloudhelp/2026/ENU/3DSMax-Character-Animation/files/GUID-903D3867-AF98-4EFC-8338-F5647B8933CF.htm>
- Carnegie Mellon footstep planning treats possible next foot placements as dependent on the current biped state: <https://publications.ri.cmu.edu/footstep-planning-for-the-honda-asimo-humanoid/>
- Agrawal and van de Panne model task-specific footstep plans with side steps, toe/heel pivots, character-proportion retargeting, and duration/effort: <https://www.cs.ubc.ca/~van/papers/2016-TOG-taskBasedLocomotion/index.html>
- A published walking dataset spans controlled step lengths 0.5–1.1 m and widths 0–0.4 m in ten healthy young adults. It is useful validation coverage, not a universal safety clamp: <https://pubmed.ncbi.nlm.nih.gov/36385009/>

### Mathematical constraint clarified

For a straight path of distance `D`, authored footfalls `N`, and transition duration `T`:

```text
average step length = D / N
cadence             = N / T
average speed       = D / T
```

Distance, step count, arrival timing, cadence, stride length, and speed cannot all be independent controls. When `D`, `N`, and `T` are authored, cadence, average stride length, and speed are derived. Curved paths and dance templates require per-footfall poses; `D / N` then remains only a summary.

## Believed done — unverified

- The proposed footfall schema below is grounded in the current code and research but has not been run through the shipping rig or persisted in a Stage project.
- The present exact-step Walk Lab proves endpoint and count for straight, evenly spaced travel. It does not yet prove arbitrary starting stance, lead-foot selection, crossed steps, grapevine, backwards travel, curved paths, or an exact two-foot goal stance.
- The current motion-matching feature vector describes foot-aware motion, but no runtime database build/search currently consumes it for Stage playback. It cannot yet be treated as a solver for authored footprints.
- Avatar-specific reach envelopes are not yet derived from rig leg length, hip width, joint limits, and available animation coverage. Do not promote the Walk Lab's 0.55–0.85 m heuristic into production canon.
- The correct phase-lock direction for Stage remains unproved. Walk Lab currently lets the locomotion gait clock drive exact-step progress. A musical score needs authored beat/contact events to remain deterministic and may instead need the renderer gait phase synchronized to the score.

## In flight

### Walk Lab task owned elsewhere

The active Codex task is titled `Fix Walk Lab leg teleporting`:

- Task id: `01a04464-8a4a-7aa3-885f-0d687de2fad4`
- Worktree: `E:\tka-platform-walk-lab-terminal-step`
- Reported branch: `codex/walk-lab-terminal-step`

Its recent work owns exact-step terminal transitions, foot planting/arrival diagnostics, steady-gait quality measurements, and turn-in-place animation. The 2026-08-28 audit found its branch dirty and uncommitted while awaiting scoped commit confirmation. Audit its actual `git status`, branch, and newest turns before acting; do not rely on this handoff as proof that its working tree remains in that state.

### Stage timeline task owned here

Worktree: `C:\Users\Austen\.codex\worktrees\fdba\tka-platform`

Branch: `codex/3d-viewer-progressive-design`

HEAD: `11909df413f92397b68dd69cfeb4c82bcac6858a`

The following task-owned Stage timeline changes remain uncommitted and must not be edited, staged, reverted, or copied by the Walk Lab task:

- `src/lib/features/stage/StageModule.svelte`
- `src/lib/features/stage/components/StageTimeline.svelte`
- `src/lib/features/stage/components/StageFloorLane.svelte`
- `src/lib/features/stage/components/StageHandsClipContent.svelte`
- `src/lib/features/stage/components/StageMotionLane.svelte`
- `src/lib/features/stage/domain/stage-timeline-projection.ts`
- `tests/unit/stage/stage-timeline-projection.test.ts`

Focused proof already captured here: `tests/unit/stage/stage-timeline-projection.test.ts`, `stage-sequence-timeline.test.ts`, and `stage-formation-sampler.test.ts` passed 17/17. Svelte compiler parsing passed for the changed Stage components. Live branch visual verification is still pending because the machine's dev-server cap was occupied by other tasks.

## Loose ends (ranked)

1. **Finish and preserve the Walk Lab task's current locomotion/turn work first.** Do not let this architecture handoff derail or overwrite in-flight terminal-step work.
2. **Write a narrow Walk Lab experiment proposal before implementing it.** The first useful experiment is one performer travelling between two marks with explicit starting stance, lead foot, exact footfall count, and exact goal stance. Compare step-together and one cross-step/grapevine template.
3. **Define the footfall semantics.** Recommended starting point:

   ```ts
   interface FootPose {
     x: number;
     z: number;
     yaw: number;
   }

   interface Stance {
     leftFoot: FootPose;
     rightFoot: FootPose;
     support: "left" | "right" | "both";
   }

   interface Footfall {
     foot: "left" | "right";
     plantBeat: number;
     pose: FootPose;
     contactUntilBeat: number;
   }

   interface TravelPhrase {
     departureBeat: number;
     markBeat: number;
     settledBeat: number;
     path: GroundPath;
     gaitTemplate: GaitTemplateId;
     startStance: Stance;
     goalStance: Stance;
     footfalls: Footfall[];
   }
   ```

   Templates such as step-together, cross-step, grapevine, forward/backward, sidestep, and pivot generate editable footfalls. Do not leave the gait as an opaque enum or one animation clip.
4. **Add and prove one external `GaitTimingPlan` seam before footprint targets.** For Stage, the timeline's musical beat must remain canonical. The first architectural experiment should let the existing locomotion animator accept explicit footfall times while preserving its monotonic gait/distance clocks, terminal controller, and current contacts. Prove phase-locked arrival without foot skating, late arrival, or frame-rate dependence. Only after the animator can realize the authored schedule should `FootprintTarget` poses/contact windows be added to the planter/IK path.
5. **Establish feasibility as layered output, not one magic clamp.** Proposed layers:
   - hard invalid: unreachable pose, leg/foot collision, missing support, invalid alternating contact sequence;
   - renderer unavailable: requested placement outside existing clip/motion-matching coverage;
   - soft strain: extreme stride, cadence, stance width, or turn for this avatar;
   - stylistic but allowed: deliberately exaggerated or dance-specific motion.
6. **Measure across rigs and directions.** At minimum test short/tall shipped rigs, feet together vs open stance, left/right lead, forward/backward/side/cross travel, and exact endpoint stance. Record endpoint error per foot, slip during contact, balance/support failures, and whether the requested arrival beat was met.
7. **Only after the Walk Lab proves the contract, design Stage schema v2.** Stage should add versioned per-performer travel plans with legacy migration from `Formation.transitionBeats`, `FormationSpot.walkStyle`, and easing. The Stage task owns persistence, migrations, timeline projection, and UI; the shared Walk Lab/3D owner supplies planning, validation, and runtime sampling.

## Decisions already made

- 2026-08-28, Austen: the Stage timeline needs more than speed. It must express performer arrival order, exact step count, gait/step type, reasonable anatomical limits, and how the feet meet at the destination.
- 2026-08-28, Austen: do not become attached to Hands / Floor / Motion if a deeper model emerges; explore the domain first.
- 2026-08-28, architecture conclusion accepted for handoff: footfall plans are the deeper shared primitive. Timeline tabs are views over the same score, not separate state models.
- Existing 3D Studio direction remains one destination with progressive depth and one normalized versioned project. Beginner-generated movement must graduate into expert footprint editing rather than becoming a dead end.
- The current Walk Lab exact-step planner and production rig are the reuse path. No duplicate renderer, gait clock, foot planter, or Stage-only locomotion solver.
- Recommended meaning for the simple `Arrive on count` control: both feet have completed the goal stance (`settledBeat`). Expert editing may separately expose `markBeat` and `settledBeat` so a performer can reach the mark and then close or pivot.

## Gotchas

- **"Step" is overloaded.** TKA hand-sequence steps, musical counts, locomotion gait steps, footfalls, and animation frames are different concepts. Use `footfall`, `plantBeat`, `count`, and `sequenceStep` explicitly in new contracts.
- **Arrival is overloaded.** Root reaches mark, first foot plants, last required foot plants, and stable two-foot settlement are not the same event. Name them.
- **Do not persist only a gait template.** A beginner template should compile to actual footfalls so experts can edit the result. Preserve template provenance if useful, but playback must have deterministic resolved intent.
- **Do not persist both contradictory controls without lock semantics.** Speed, cadence, step count, step length, and duration are coupled. The UI may let users edit any of them, but the solver must say which authored constraints are locked and which values are derived.
- **Straight-line `distance / steps` is insufficient for grapevine and crossed steps.** Those require individual left/right poses and foot orientation. Root path length is not the sum of swing-foot travel.
- **Body spot is not a stance.** A formation `x/z` can be derived from the final stance midpoint/root, but it cannot reconstruct which foot is where or which leg supports weight.
- **Current Stage formations share `transitionBeats`.** Staggered performer arrivals require per-performer departure/arrival/contact schedules while preserving the formation as a semantic ensemble landmark.
- **The Walk Lab agent is not alone in the repository.** It must not revert or stage this Stage branch's files, and this Stage task must not copy dependency patches or animation assets out of the Walk Lab worktree.
- **Primary `main` currently has a pre-existing unrelated unstaged `pnpm-lock.yaml`.** Preserve it. Tunnel integration is complete and no longer blocks landing, but neither task should integrate the other's uncommitted work.
