<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import type {
    AvatarGripDiagnostics,
    AvatarPoseDiagnostics,
    CollisionEvent,
  } from "@austencloud/scene-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { page } from "$app/state";
  import { FALG } from "$lib/shared/combination/domain/demo-fixtures";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import StaffGripStage from "./StaffGripStage.svelte";
  import {
    INSPECTION_FOV_DEG,
    INSPECTION_VIEWS,
    inspectionShotForView,
  } from "./inspection-framing";

  interface GripMetric {
    axisErrorDeg: number | null;
    contactOffsetMm: number | null;
  }

  interface PoseMetric {
    requestedYawDeg: number | null;
    achievedYawDeg: number | null;
    headDodgeDeg: number | null;
    torsoPitchDeg: number | null;
    collisionCount: number;
    collisionZones: string;
    deepestCollisionMm: number;
    collisionDescriptions: string;
    audienceGripSeparationMm: number | null;
    depthGripSeparationMm: number | null;
    /** Each grip's offset along the chest-lateral (audience depth) axis. */
    blueGripDepthMm: number | null;
    redGripDepthMm: number | null;
    /** Half the shoulder span: the elbow line the grips must stay inside. */
    shoulderHalfSpanMm: number | null;
    /** Straight-line distance between the two palms: the hug measurement. */
    palmSeparationMm: number | null;
    /** Palm separation along the audience-depth axis alone. */
    palmDepthSeparationMm: number | null;
    /**
     * Distance between the two rendered grips. Unlike the palms this exists on
     * every rig, so it is the portable hand-convergence measurement.
     */
    gripSeparationMm: number | null;
    /** Elbow world positions, for proving the hug kept them put. */
    leftElbow: string;
    rightElbow: string;
    /**
     * How far each hand swings toward the chest-forward midline BEYOND its own
     * forearm direction. This is the wrist's own contribution to the hug: 0 is
     * a hand that continues straight out of the forearm, positive is a wrist
     * rotated inward toward the centerline.
     */
    leftWristInwardDeg: number | null;
    rightWristInwardDeg: number | null;
    /** Total wrist bend between forearm and hand, whatever its direction. */
    leftWristBendDeg: number | null;
    rightWristBendDeg: number | null;
    /** Distance from each palm to the grip point the grid authored for it. */
    leftPalmToAuthoredMm: number | null;
    rightPalmToAuthoredMm: number | null;
    /** Measured arm segments and the staff length they permit. */
    upperArmMm: number | null;
    forearmMm: number | null;
    reachMm: number | null;
    renderedStaffLengthMm: number | null;
    renderedStepNumber: number;
    renderedBeatProgress: number;
  }

  const sequence = FALG;
  const displayWord = simplifyRepeatedWord(sequence.word ?? sequence.id);
  // `?character=<catalog id>` swaps the posed rig so the same frozen frames can
  // be swept across materially different bodies.
  const characterId = $derived(
    (page.url.searchParams.get("character") as CharacterId | null) ?? undefined
  );
  let phase = $state(7.99);
  // Each pane solves its own shot against its own aspect ratio, so a tall
  // reference column and a squat inspection cell both frame their subject
  // instead of one of them cropping it.
  let paneWidths = $state<number[]>(INSPECTION_VIEWS.map(() => 0));
  let paneHeights = $state<number[]>(INSPECTION_VIEWS.map(() => 0));
  const shots = $derived(
    INSPECTION_VIEWS.map((view, index) => {
      const width = paneWidths[index] ?? 0;
      const height = paneHeights[index] ?? 0;
      const aspectRatio = width > 0 && height > 0 ? width / height : 1;
      return inspectionShotForView(view, aspectRatio);
    })
  );
  let leftMetric = $state<GripMetric>({
    axisErrorDeg: null,
    contactOffsetMm: null,
  });
  let rightMetric = $state<GripMetric>({
    axisErrorDeg: null,
    contactOffsetMm: null,
  });
  let poseMetric = $state<PoseMetric>({
    requestedYawDeg: null,
    achievedYawDeg: null,
    headDodgeDeg: null,
    torsoPitchDeg: null,
    collisionCount: 0,
    collisionZones: "",
    deepestCollisionMm: 0,
    collisionDescriptions: "",
    audienceGripSeparationMm: null,
    depthGripSeparationMm: null,
    blueGripDepthMm: null,
    redGripDepthMm: null,
    shoulderHalfSpanMm: null,
    palmSeparationMm: null,
    palmDepthSeparationMm: null,
    gripSeparationMm: null,
    leftElbow: "",
    rightElbow: "",
    leftWristInwardDeg: null,
    rightWristInwardDeg: null,
    leftWristBendDeg: null,
    rightWristBendDeg: null,
    leftPalmToAuthoredMm: null,
    rightPalmToAuthoredMm: null,
    upperArmMm: null,
    forearmMm: null,
    reachMm: null,
    renderedStaffLengthMm: null,
    renderedStepNumber: 0,
    renderedBeatProgress: 0,
  });

  const phaseLabel = $derived(
    `${Math.floor(phase) + 1}.${Math.round((phase % 1) * 100)
      .toString()
      .padStart(2, "0")}`
  );

  function axisErrorDegrees(
    axis: Readonly<{ x: number; y: number; z: number }> | null,
    segment: AvatarGripDiagnostics["blueStaffSegment"]
  ): number | null {
    if (!axis || !segment) return null;
    const sx = segment.b.x - segment.a.x;
    const sy = segment.b.y - segment.a.y;
    const sz = segment.b.z - segment.a.z;
    const shaftLength = Math.hypot(sx, sy, sz);
    const axisLength = Math.hypot(axis.x, axis.y, axis.z);
    if (shaftLength < 1e-6 || axisLength < 1e-6) return null;
    const dot = Math.abs(
      (sx * axis.x + sy * axis.y + sz * axis.z) / (shaftLength * axisLength)
    );
    return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  }

  function contactOffsetMillimeters(
    palm: Readonly<{ x: number; y: number; z: number }> | null,
    grip: Readonly<{ x: number; y: number; z: number }> | null
  ): number | null {
    if (!palm || !grip) return null;
    return Math.hypot(palm.x - grip.x, palm.y - grip.y, palm.z - grip.z) * 1000;
  }

  interface WristGeometry {
    inwardDeg: number | null;
    bendDeg: number | null;
  }

  const NO_WRIST_GEOMETRY: WristGeometry = { inwardDeg: null, bendDeg: null };

  type Point = Readonly<{ x: number; y: number; z: number }>;

  function unit(from: Point, to: Point): [number, number, number] | null {
    const x = to.x - from.x;
    const y = to.y - from.y;
    const z = to.z - from.z;
    const length = Math.hypot(x, y, z);
    if (length < 1e-6) return null;
    return [x / length, y / length, z / length];
  }

  function arcsinDegrees(value: number): number {
    return (Math.asin(Math.max(-1, Math.min(1, value))) * 180) / Math.PI;
  }

  /**
   * Split the hand's direction into the part the forearm already carries and
   * the part the wrist adds. The chest-lateral axis is rebuilt from the
   * achieved shoulder yaw: at yaw 0 the performer's anatomical right is world
   * -X, and the shoulder frame turns it about Y. Medial (toward the
   * chest-forward midline) is +lateral for the left hand and -lateral for the
   * right, matching the animator's own palm-socket convention.
   */
  function wristGeometry(
    side: "left" | "right",
    elbow: Point | null | undefined,
    wrist: Point | null | undefined,
    palm: Point | null | undefined,
    achievedYawRad: number
  ): WristGeometry {
    if (!elbow || !wrist || !palm) return NO_WRIST_GEOMETRY;
    const forearm = unit(elbow, wrist);
    const hand = unit(wrist, palm);
    if (!forearm || !hand) return NO_WRIST_GEOMETRY;
    const medialSign = side === "left" ? 1 : -1;
    const lateralX = -Math.cos(achievedYawRad) * medialSign;
    const lateralZ = Math.sin(achievedYawRad) * medialSign;
    const handMedial = arcsinDegrees(hand[0] * lateralX + hand[2] * lateralZ);
    const forearmMedial = arcsinDegrees(
      forearm[0] * lateralX + forearm[2] * lateralZ
    );
    const dot =
      forearm[0] * hand[0] + forearm[1] * hand[1] + forearm[2] * hand[2];
    return {
      inwardDeg: handMedial - forearmMedial,
      bendDeg: (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI,
    };
  }

  function separationMillimeters(
    a: Point | null | undefined,
    b: Point | null | undefined
  ): number | null {
    if (!a || !b) return null;
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000;
  }

  function collectGripMetrics(
    events: CollisionEvent[],
    diagnostics: AvatarPoseDiagnostics,
    gripDiagnostics: AvatarGripDiagnostics
  ): void {
    leftMetric = {
      axisErrorDeg: axisErrorDegrees(
        gripDiagnostics.leftGripAxis,
        gripDiagnostics.blueStaffSegment
      ),
      contactOffsetMm: contactOffsetMillimeters(
        gripDiagnostics.leftPalm,
        gripDiagnostics.renderedBlueGrip
      ),
    };
    rightMetric = {
      axisErrorDeg: axisErrorDegrees(
        gripDiagnostics.rightGripAxis,
        gripDiagnostics.redStaffSegment
      ),
      contactOffsetMm: contactOffsetMillimeters(
        gripDiagnostics.rightPalm,
        gripDiagnostics.renderedRedGrip
      ),
    };

    const leftWrist = wristGeometry(
      "left",
      diagnostics.leftElbowWorld,
      gripDiagnostics.leftWrist,
      gripDiagnostics.leftPalm,
      diagnostics.achievedShoulderYawRad
    );
    const rightWrist = wristGeometry(
      "right",
      diagnostics.rightElbowWorld,
      gripDiagnostics.rightWrist,
      gripDiagnostics.rightPalm,
      diagnostics.achievedShoulderYawRad
    );

    poseMetric = {
      requestedYawDeg: radiansToDegrees(diagnostics.requestedStanceYawRad),
      achievedYawDeg: radiansToDegrees(diagnostics.achievedShoulderYawRad),
      headDodgeDeg: radiansToDegrees(diagnostics.appliedHeadDodgeRad),
      torsoPitchDeg: radiansToDegrees(diagnostics.achievedTorsoPitchRad),
      collisionCount: events.length,
      collisionZones: events
        .map(({ zone, severity }) => `${zone}:${severity}`)
        .sort()
        .join(","),
      deepestCollisionMm:
        Math.max(0, ...events.map(({ penetrationDepth }) => penetrationDepth)) *
        1000,
      collisionDescriptions: events
        .map(({ description }) => description)
        .join(" | "),
      audienceGripSeparationMm:
        gripDiagnostics.authoredBlueGrip && gripDiagnostics.authoredRedGrip
          ? Math.hypot(
              gripDiagnostics.authoredBlueGrip.x -
                gripDiagnostics.authoredRedGrip.x,
              gripDiagnostics.authoredBlueGrip.y -
                gripDiagnostics.authoredRedGrip.y
            ) * 1000
          : null,
      depthGripSeparationMm:
        gripDiagnostics.authoredBlueGrip && gripDiagnostics.authoredRedGrip
          ? Math.abs(
              gripDiagnostics.authoredBlueGrip.z -
                gripDiagnostics.authoredRedGrip.z
            ) * 1000
          : null,
      blueGripDepthMm: gripDiagnostics.authoredBlueGrip
        ? gripDiagnostics.authoredBlueGrip.z * 1000
        : null,
      redGripDepthMm: gripDiagnostics.authoredRedGrip
        ? gripDiagnostics.authoredRedGrip.z * 1000
        : null,
      shoulderHalfSpanMm: (diagnostics.shoulderWidth / 2) * 1000,
      palmSeparationMm:
        gripDiagnostics.leftPalm && gripDiagnostics.rightPalm
          ? Math.hypot(
              gripDiagnostics.leftPalm.x - gripDiagnostics.rightPalm.x,
              gripDiagnostics.leftPalm.y - gripDiagnostics.rightPalm.y,
              gripDiagnostics.leftPalm.z - gripDiagnostics.rightPalm.z
            ) * 1000
          : null,
      palmDepthSeparationMm:
        gripDiagnostics.leftPalm && gripDiagnostics.rightPalm
          ? Math.abs(gripDiagnostics.leftPalm.z - gripDiagnostics.rightPalm.z) *
            1000
          : null,
      gripSeparationMm:
        gripDiagnostics.renderedBlueGrip && gripDiagnostics.renderedRedGrip
          ? Math.hypot(
              gripDiagnostics.renderedBlueGrip.x -
                gripDiagnostics.renderedRedGrip.x,
              gripDiagnostics.renderedBlueGrip.y -
                gripDiagnostics.renderedRedGrip.y,
              gripDiagnostics.renderedBlueGrip.z -
                gripDiagnostics.renderedRedGrip.z
            ) * 1000
          : null,
      leftElbow: formatPoint(diagnostics.leftElbowWorld),
      rightElbow: formatPoint(diagnostics.rightElbowWorld),
      leftWristInwardDeg: leftWrist.inwardDeg,
      rightWristInwardDeg: rightWrist.inwardDeg,
      leftWristBendDeg: leftWrist.bendDeg,
      rightWristBendDeg: rightWrist.bendDeg,
      leftPalmToAuthoredMm: separationMillimeters(
        gripDiagnostics.leftPalm,
        gripDiagnostics.authoredBlueGrip
      ),
      rightPalmToAuthoredMm: separationMillimeters(
        gripDiagnostics.rightPalm,
        gripDiagnostics.authoredRedGrip
      ),
      upperArmMm:
        ((diagnostics.leftUpperArmLength + diagnostics.rightUpperArmLength) /
          2) *
        1000,
      forearmMm:
        ((diagnostics.leftForearmLength + diagnostics.rightForearmLength) / 2) *
        1000,
      reachMm:
        ((diagnostics.leftUpperArmLength +
          diagnostics.leftForearmLength +
          diagnostics.rightUpperArmLength +
          diagnostics.rightForearmLength) /
          2) *
        1000,
      renderedStaffLengthMm: gripDiagnostics.blueStaffSegment
        ? Math.hypot(
            gripDiagnostics.blueStaffSegment.b.x -
              gripDiagnostics.blueStaffSegment.a.x,
            gripDiagnostics.blueStaffSegment.b.y -
              gripDiagnostics.blueStaffSegment.a.y,
            gripDiagnostics.blueStaffSegment.b.z -
              gripDiagnostics.blueStaffSegment.a.z
          ) * 1000
        : null,
      renderedStepNumber: gripDiagnostics.stepNumber,
      renderedBeatProgress: gripDiagnostics.beatProgress,
    };
  }

  function formatPoint(
    point: Readonly<{ x: number; y: number; z: number }> | null | undefined
  ): string {
    if (!point) return "";
    return `${(point.x * 1000).toFixed(1)},${(point.y * 1000).toFixed(1)},${(
      point.z * 1000
    ).toFixed(1)}`;
  }

  function radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  function formatMetric(value: number | null, digits = 1): string {
    return value === null ? "—" : value.toFixed(digits);
  }
</script>

<svelte:head>
  <title>Staff Grip Inspection</title>
  <meta
    name="description"
    content="Inspect one two-staff pose from four camera angles."
  />
</svelte:head>

<main
  class="grip-inspection"
  data-sequence-source="validated-production-fixture"
  data-sequence-id={sequence.id}
  data-character-id={characterId ?? "intake-current"}
  data-phase={phase.toFixed(2)}
  data-left-axis-error-deg={formatMetric(leftMetric.axisErrorDeg, 3)}
  data-right-axis-error-deg={formatMetric(rightMetric.axisErrorDeg, 3)}
  data-left-contact-offset-mm={formatMetric(leftMetric.contactOffsetMm, 3)}
  data-right-contact-offset-mm={formatMetric(rightMetric.contactOffsetMm, 3)}
  data-requested-yaw-deg={formatMetric(poseMetric.requestedYawDeg, 3)}
  data-achieved-yaw-deg={formatMetric(poseMetric.achievedYawDeg, 3)}
  data-head-dodge-deg={formatMetric(poseMetric.headDodgeDeg, 3)}
  data-torso-pitch-deg={formatMetric(poseMetric.torsoPitchDeg, 3)}
  data-collision-count={poseMetric.collisionCount}
  data-collision-zones={poseMetric.collisionZones}
  data-deepest-collision-mm={formatMetric(poseMetric.deepestCollisionMm, 3)}
  data-collision-descriptions={poseMetric.collisionDescriptions}
  data-palm-separation-mm={formatMetric(poseMetric.palmSeparationMm, 2)}
  data-palm-depth-separation-mm={formatMetric(
    poseMetric.palmDepthSeparationMm,
    2
  )}
  data-grip-separation-mm={formatMetric(poseMetric.gripSeparationMm, 2)}
  data-left-elbow-mm={poseMetric.leftElbow}
  data-right-elbow-mm={poseMetric.rightElbow}
  data-left-wrist-inward-deg={formatMetric(poseMetric.leftWristInwardDeg, 2)}
  data-right-wrist-inward-deg={formatMetric(poseMetric.rightWristInwardDeg, 2)}
  data-left-wrist-bend-deg={formatMetric(poseMetric.leftWristBendDeg, 2)}
  data-right-wrist-bend-deg={formatMetric(poseMetric.rightWristBendDeg, 2)}
  data-left-palm-to-authored-mm={formatMetric(
    poseMetric.leftPalmToAuthoredMm,
    2
  )}
  data-right-palm-to-authored-mm={formatMetric(
    poseMetric.rightPalmToAuthoredMm,
    2
  )}
  data-upper-arm-mm={formatMetric(poseMetric.upperArmMm, 2)}
  data-forearm-mm={formatMetric(poseMetric.forearmMm, 2)}
  data-reach-mm={formatMetric(poseMetric.reachMm, 2)}
  data-rendered-staff-length-mm={formatMetric(
    poseMetric.renderedStaffLengthMm,
    2
  )}
  data-audience-grip-separation-mm={formatMetric(
    poseMetric.audienceGripSeparationMm,
    3
  )}
  data-depth-grip-separation-mm={formatMetric(
    poseMetric.depthGripSeparationMm,
    3
  )}
  data-blue-grip-depth-mm={formatMetric(poseMetric.blueGripDepthMm, 3)}
  data-red-grip-depth-mm={formatMetric(poseMetric.redGripDepthMm, 3)}
  data-shoulder-half-span-mm={formatMetric(poseMetric.shoulderHalfSpanMm, 3)}
  data-rendered-step-number={poseMetric.renderedStepNumber}
  data-rendered-beat-progress={formatMetric(poseMetric.renderedBeatProgress, 3)}
>
  <div class="views">
    <section class="console" style:grid-area="console">
      <header class="console-head">
        <h1>Staff grip inspection</h1>
        <p class="console-sub">
          {displayWord} · {characterId ?? "intake-current"}
        </p>
      </header>

      <div class="scrubber">
        <label for="grip-phase">Step {phaseLabel}</label>
        <input
          id="grip-phase"
          type="range"
          min="0"
          max={sequence.steps.length - 0.01}
          step="0.01"
          bind:value={phase}
        />
      </div>

      <dl class="readout" aria-live="polite">
        <div class="metric">
          <dt>Blue axis / contact</dt>
          <dd>
            {formatMetric(leftMetric.axisErrorDeg)}° · {formatMetric(
              leftMetric.contactOffsetMm
            )} mm
          </dd>
        </div>
        <div class="metric">
          <dt>Red axis / contact</dt>
          <dd>
            {formatMetric(rightMetric.axisErrorDeg)}° · {formatMetric(
              rightMetric.contactOffsetMm
            )} mm
          </dd>
        </div>
        <div class="metric">
          <dt>Yaw requested → achieved</dt>
          <dd>
            {formatMetric(poseMetric.requestedYawDeg, 0)}° → {formatMetric(
              poseMetric.achievedYawDeg,
              0
            )}°
          </dd>
        </div>
        <div class="metric">
          <dt>Head dodge</dt>
          <dd>{formatMetric(poseMetric.headDodgeDeg, 0)}°</dd>
        </div>
        <div class="metric">
          <dt>Grip depth of shoulder half-span</dt>
          <dd>
            {formatMetric(poseMetric.blueGripDepthMm, 0)} / {formatMetric(
              poseMetric.redGripDepthMm,
              0
            )} mm of ±{formatMetric(poseMetric.shoulderHalfSpanMm, 0)}
          </dd>
        </div>
        <div class="metric">
          <dt>Wrist inward blue / red</dt>
          <dd>
            {formatMetric(poseMetric.leftWristInwardDeg, 0)}° / {formatMetric(
              poseMetric.rightWristInwardDeg,
              0
            )}°
          </dd>
        </div>
        <div class="metric">
          <dt>Grip separation</dt>
          <dd>{formatMetric(poseMetric.gripSeparationMm, 0)} mm</dd>
        </div>
        <div class="metric">
          <dt>Collisions</dt>
          <dd>{poseMetric.collisionCount}</dd>
        </div>
      </dl>
    </section>

    {#each INSPECTION_VIEWS as view, index (view.id)}
      <section
        class="view"
        style:grid-area={view.id}
        aria-label={`${view.label}: ${view.hint}`}
        bind:clientWidth={paneWidths[index]}
        bind:clientHeight={paneHeights[index]}
      >
        <Canvas shadows>
          <T.Color attach="background" args={["#0a101a"]} />
          <T.PerspectiveCamera
            makeDefault
            position={shots[index].position}
            fov={INSPECTION_FOV_DEG}
          >
            <OrbitControls
              enableDamping
              enablePan={false}
              rightDragAction="rotate"
              target={shots[index].target}
              minDistance={0.3}
              maxDistance={12}
              maxPolarAngle={Math.PI}
            />
          </T.PerspectiveCamera>

          <StaffGripStage
            id={`staff-grip-${view.id}`}
            {phase}
            {sequence}
            {characterId}
            gridEmphasis={view.grid}
            onCollisionEvents={index === 0 ? collectGripMetrics : undefined}
          />
        </Canvas>
        <span class="view-label">
          <b>{view.label}</b>
          <i>{view.hint}</i>
        </span>
      </section>
    {/each}
  </div>
</main>

<style>
  .grip-inspection {
    position: relative;
    min-height: 100dvh;
    background: #0a101a;
    color: var(--color-text-primary, #f4f7fb);
    container-type: inline-size;
  }

  /*
   * Narrow is the base: one column, console first so the scrubber and the
   * numbers are reachable without scrolling past four canvases.
   */
  .views {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    /*
     * Every pane places itself by name, so the narrow tier has to name the
     * areas too. Without this the idents resolve to nothing and all five
     * sections collapse into one cell on top of each other.
     */
    grid-template-areas:
      "console"
      "audience"
      "grip-front"
      "grip-quarter"
      "grip-overhead";
    /*
     * Explicit row heights: a Threlte canvas reports the size it was last
     * measured at, so an auto row lets a pane keep whatever height the wide
     * layout gave it instead of shrinking to the stacked one.
     */
    grid-template-rows: auto repeat(4, minmax(0, 52svh));
    min-height: 100dvh;
  }

  .view,
  .console {
    min-width: 0;
    min-height: 0;
    border-bottom: 1px solid rgb(148 178 206 / 18%);
    background: #0a101a;
  }

  .view {
    position: relative;
    overflow: hidden;
  }

  .views > :last-child {
    border-bottom: 0;
  }

  .view :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .view-label {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: grid;
    gap: 0.1rem;
    max-width: calc(100% - 1.5rem);
    padding: 0.35rem 0.6rem;
    border: 1px solid rgb(148 178 206 / 24%);
    border-radius: 0.4rem;
    background: rgb(5 12 21 / 78%);
    pointer-events: none;
    backdrop-filter: blur(8px);
  }

  .view-label b {
    color: rgb(238 246 252 / 92%);
    font-size: 0.875rem;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  .view-label i {
    color: rgb(206 226 242 / 74%);
    font-size: 0.8125rem;
    font-style: normal;
  }

  .console {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.15rem 1.25rem;
    overflow: auto;
  }

  .console-head h1 {
    margin: 0;
    color: rgb(240 247 253 / 94%);
    font-size: 1.05rem;
    font-weight: 640;
    letter-spacing: 0.01em;
  }

  .console-sub {
    margin: 0.15rem 0 0;
    color: rgb(206 226 242 / 74%);
    font-size: 0.8125rem;
  }

  .scrubber {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid rgb(111 231 255 / 34%);
    border-radius: 0.65rem;
    background: rgb(5 14 24 / 88%);
  }

  .scrubber label {
    flex: 0 0 auto;
    min-width: 5rem;
    color: rgb(232 242 250 / 88%);
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }

  .scrubber input {
    width: 100%;
    min-height: 2rem;
    accent-color: #6fe7ff;
    cursor: ew-resize;
  }

  .scrubber input:focus-visible {
    outline: 2px solid #6fe7ff;
    outline-offset: 3px;
  }

  .readout {
    display: grid;
    /*
     * Two columns even on the narrowest phone: one column of eight readings
     * pushes every camera below the fold, and these values are short enough to
     * pair without truncating.
     */
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.55rem 1rem;
    margin: 0;
  }

  .metric {
    min-width: 0;
  }

  .metric dt {
    color: rgb(196 219 238 / 72%);
    font-size: 0.75rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .metric dd {
    margin: 0.1rem 0 0;
    color: #a8efff;
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
    /*
     * The number is the thing that changes; a fixed line box keeps a value
     * losing a digit from nudging the rows below it.
     */
    min-height: 1.4em;
  }

  /*
   * Mid: two columns. One stacked column on a tablet or a folded phone in
   * landscape leaves every pane wide and short, so the framing solver fits the
   * subject to the height and most of the width goes to empty stage either
   * side of it.
   */
  @container (min-width: 40rem) {
    .views {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "console      console"
        "audience     grip-front"
        "grip-quarter grip-overhead";
      grid-template-rows: auto repeat(2, minmax(0, 52svh));
    }

    /* Second and fourth in DOM order are the left-hand column. */
    .views > :nth-child(2),
    .views > :nth-child(4) {
      border-right: 1px solid rgb(148 178 206 / 18%);
    }

    .views > :nth-child(4),
    .views > :nth-child(5) {
      border-bottom: 0;
    }

    /*
     * Short and wide — a folded phone in landscape, or any window with more
     * width than height. A full-width console band would take two thirds of
     * the screen and leave the panes as slivers, so the readings become a rail
     * and the four panes keep the whole height.
     */
    @media (max-height: 34rem) {
      .grip-inspection {
        overflow: hidden;
      }

      .views {
        grid-template-columns: minmax(0, 21rem) minmax(0, 1fr) minmax(0, 1fr);
        grid-template-areas:
          "console audience     grip-front"
          "console grip-quarter grip-overhead";
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
        height: 100dvh;
        min-height: 0;
      }

      /* The console is now the first column rather than a band above. */
      .views > :nth-child(1) {
        border-right: 1px solid rgb(148 178 206 / 18%);
        border-bottom: 0;
      }

      .readout {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      /*
       * A two-line caption over a 205px pane covers the subject it is naming.
       * The pane keeps its name; the sentence explaining it stays in the
       * section's accessible name, which is where a screen reader reads it
       * from at every width.
       */
      .view-label i {
        display: none;
      }
    }
  }

  /*
   * Wide: the audience reference owns a full-height column so the standing
   * figure is framed portrait, and the three close inspections plus the
   * console fill the two-by-two block beside it.
   */
  @container (min-width: 60rem) {
    .grip-inspection {
      overflow: hidden;
    }

    .views {
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "audience grip-front    grip-quarter"
        "audience grip-overhead console";
      height: 100dvh;
    }

    .view,
    .console {
      border-right: 1px solid rgb(148 178 206 / 18%);
      border-bottom: 1px solid rgb(148 178 206 / 18%);
    }

    .views > :last-child,
    .views > :nth-child(3),
    .views > :nth-child(5) {
      border-right: 0;
    }

    .views > :nth-child(4),
    .views > :nth-child(5) {
      border-bottom: 0;
    }

    .view {
      min-height: 0;
    }

    .console {
      justify-content: center;
      padding: 1.25rem 1.4rem;
    }

    /*
     * The console cell grows with the canvas, but a readout stretched across a
     * 4K column becomes six thin strips of digits with the eye travelling a
     * foot between a label and its neighbour. Capping and centring the reading
     * block keeps the numbers one scannable group at every width.
     */
    .console > * {
      width: 100%;
      max-width: 32rem;
      margin-inline: auto;
    }

    .readout {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
