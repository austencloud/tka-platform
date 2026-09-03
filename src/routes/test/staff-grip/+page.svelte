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
  import StaffGripStage from "./StaffGripStage.svelte";

  interface CameraView {
    id: string;
    label: string;
    focus: "pair" | "left" | "right";
    offset: [number, number, number];
    fov: number;
  }

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
  // `?character=<catalog id>` swaps the posed rig so the same frozen frames can
  // be swept across materially different bodies.
  const characterId = $derived(
    (page.url.searchParams.get("character") as CharacterId | null) ?? undefined
  );
  const VIEWS: CameraView[] = [
    {
      id: "front",
      label: "Front",
      focus: "pair",
      offset: [0, 0.04, 1.6],
      fov: 40,
    },
    {
      id: "right",
      label: "Right hand",
      focus: "right",
      offset: [0.42, 0.08, 0.72],
      fov: 30,
    },
    {
      id: "left",
      label: "Left hand",
      focus: "left",
      offset: [-0.42, 0.08, 0.72],
      fov: 30,
    },
    {
      id: "high",
      label: "High",
      focus: "pair",
      offset: [0.82, 1.26, 1.08],
      fov: 42,
    },
  ];

  let phase = $state(7.99);
  let pairFocus = $state<[number, number, number]>([0, 1, 0]);
  let leftFocus = $state<[number, number, number]>([-0.2, 1, 0]);
  let rightFocus = $state<[number, number, number]>([0.2, 1, 0]);
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

    if (gripDiagnostics.leftPalm && gripDiagnostics.rightPalm) {
      const next: [number, number, number] = [
        (gripDiagnostics.leftPalm.x + gripDiagnostics.rightPalm.x) / 2,
        (gripDiagnostics.leftPalm.y + gripDiagnostics.rightPalm.y) / 2,
        (gripDiagnostics.leftPalm.z + gripDiagnostics.rightPalm.z) / 2,
      ];
      pairFocus = updateFocus(pairFocus, next);
      leftFocus = updateFocus(leftFocus, [
        gripDiagnostics.leftPalm.x,
        gripDiagnostics.leftPalm.y,
        gripDiagnostics.leftPalm.z,
      ]);
      rightFocus = updateFocus(rightFocus, [
        gripDiagnostics.rightPalm.x,
        gripDiagnostics.rightPalm.y,
        gripDiagnostics.rightPalm.z,
      ]);
    }
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

  function updateFocus(
    current: [number, number, number],
    next: [number, number, number]
  ): [number, number, number] {
    return Math.hypot(
      next[0] - current[0],
      next[1] - current[1],
      next[2] - current[2]
    ) > 0.002
      ? next
      : current;
  }

  function cameraTarget(view: CameraView): [number, number, number] {
    if (view.focus === "left") return leftFocus;
    if (view.focus === "right") return rightFocus;
    return pairFocus;
  }

  function cameraPosition(view: CameraView): [number, number, number] {
    const target = cameraTarget(view);
    return [
      target[0] + view.offset[0],
      target[1] + view.offset[1],
      target[2] + view.offset[2],
    ];
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
    {#each VIEWS as view, index (view.id)}
      <section class="view" aria-label={`${view.label} grip view`}>
        <Canvas shadows>
          <T.Color attach="background" args={["#0a101a"]} />
          <T.PerspectiveCamera
            makeDefault
            position={cameraPosition(view)}
            fov={view.fov}
          >
            <OrbitControls
              enableDamping
              enablePan={false}
              rightDragAction="rotate"
              target={cameraTarget(view)}
              minDistance={0.45}
              maxDistance={5}
              maxPolarAngle={Math.PI}
            />
          </T.PerspectiveCamera>

          <StaffGripStage
            id={`staff-grip-${view.id}`}
            {phase}
            {sequence}
            {characterId}
            onCollisionEvents={index === 0 ? collectGripMetrics : undefined}
          />
        </Canvas>
        <span class="view-label">{view.label}</span>
      </section>
    {/each}
  </div>

  <div class="readout" aria-live="polite">
    <span>
      <b>L</b>
      {formatMetric(leftMetric.axisErrorDeg)}° ·
      {formatMetric(leftMetric.contactOffsetMm)} mm
    </span>
    <span>
      <b>R</b>
      {formatMetric(rightMetric.axisErrorDeg)}° ·
      {formatMetric(rightMetric.contactOffsetMm)} mm
    </span>
    <span>
      <b>Yaw</b>
      {formatMetric(poseMetric.requestedYawDeg, 0)}° →
      {formatMetric(poseMetric.achievedYawDeg, 0)}°
    </span>
    <span>
      <b>Head</b>
      {formatMetric(poseMetric.headDodgeDeg, 0)}°
    </span>
    <span>
      <b>Grip depth</b>
      {formatMetric(poseMetric.blueGripDepthMm, 0)} /
      {formatMetric(poseMetric.redGripDepthMm, 0)} mm of ±{formatMetric(
        poseMetric.shoulderHalfSpanMm,
        0
      )}
    </span>
    <span>
      <b>Wrist in</b>
      {formatMetric(poseMetric.leftWristInwardDeg, 0)}° /
      {formatMetric(poseMetric.rightWristInwardDeg, 0)}°
    </span>
    <span>
      <b>Hits</b>
      {poseMetric.collisionCount}
    </span>
  </div>

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
</main>

<style>
  .grip-inspection {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
    background: #0a101a;
    color: var(--color-text-primary, #f4f7fb);
    container-type: inline-size;
  }

  .views {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-height: 100dvh;
  }

  .view {
    position: relative;
    min-width: 0;
    min-height: 50dvh;
    overflow: hidden;
    border-right: 1px solid rgb(148 178 206 / 18%);
    border-bottom: 1px solid rgb(148 178 206 / 18%);
    background: #0a101a;
  }

  .view:nth-child(even) {
    border-right: 0;
  }

  .view:nth-last-child(-n + 2) {
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
    padding: 0.25rem 0.45rem;
    border: 1px solid rgb(148 178 206 / 24%);
    border-radius: 0.35rem;
    background: rgb(5 12 21 / 78%);
    color: rgb(232 242 250 / 82%);
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.02em;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }

  .readout,
  .scrubber {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    border: 1px solid rgb(111 231 255 / 34%);
    background: rgb(5 14 24 / 88%);
    box-shadow: 0 12px 30px rgb(0 0 0 / 30%);
    backdrop-filter: blur(12px);
  }

  .readout {
    top: 0.75rem;
    right: 0.75rem;
    gap: 0.8rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.7rem;
    border-radius: 0.5rem;
    color: rgb(232 242 250 / 86%);
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
  }

  .readout b {
    color: #6fe7ff;
  }

  .scrubber {
    bottom: 1rem;
    left: 50%;
    gap: 0.75rem;
    width: min(32rem, calc(100% - 2rem));
    min-height: 2.75rem;
    padding: 0.45rem 0.7rem;
    border-radius: 0.65rem;
    transform: translateX(-50%);
  }

  .scrubber label {
    flex: 0 0 auto;
    min-width: 4.8rem;
    color: rgb(232 242 250 / 86%);
    font-size: 0.75rem;
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

  @container (max-width: 48rem) {
    .grip-inspection {
      overflow: auto;
    }

    .views {
      grid-template-columns: 1fr;
    }

    .view {
      min-height: 52svh;
      border-right: 0;
      border-bottom: 1px solid rgb(148 178 206 / 18%);
    }

    .view:nth-last-child(-n + 2) {
      border-bottom: 1px solid rgb(148 178 206 / 18%);
    }

    .view:last-child {
      border-bottom: 0;
    }

    .readout,
    .scrubber {
      position: fixed;
    }
  }
</style>
