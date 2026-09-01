<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import type { AvatarGripDiagnostics } from "@austencloud/scene-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { FALG } from "$lib/shared/combination/domain/demo-fixtures";
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

  const sequence = FALG;
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

  let phase = $state(0.35);
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

  function collectGripMetrics(diagnostics: AvatarGripDiagnostics): void {
    leftMetric = {
      axisErrorDeg: axisErrorDegrees(
        diagnostics.leftGripAxis,
        diagnostics.blueStaffSegment
      ),
      contactOffsetMm: contactOffsetMillimeters(
        diagnostics.leftPalm,
        diagnostics.renderedBlueGrip
      ),
    };
    rightMetric = {
      axisErrorDeg: axisErrorDegrees(
        diagnostics.rightGripAxis,
        diagnostics.redStaffSegment
      ),
      contactOffsetMm: contactOffsetMillimeters(
        diagnostics.rightPalm,
        diagnostics.renderedRedGrip
      ),
    };

    if (diagnostics.leftPalm && diagnostics.rightPalm) {
      const next: [number, number, number] = [
        (diagnostics.leftPalm.x + diagnostics.rightPalm.x) / 2,
        (diagnostics.leftPalm.y + diagnostics.rightPalm.y) / 2,
        (diagnostics.leftPalm.z + diagnostics.rightPalm.z) / 2,
      ];
      pairFocus = updateFocus(pairFocus, next);
      leftFocus = updateFocus(leftFocus, [
        diagnostics.leftPalm.x,
        diagnostics.leftPalm.y,
        diagnostics.leftPalm.z,
      ]);
      rightFocus = updateFocus(rightFocus, [
        diagnostics.rightPalm.x,
        diagnostics.rightPalm.y,
        diagnostics.rightPalm.z,
      ]);
    }
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
  data-phase={phase.toFixed(2)}
  data-left-axis-error-deg={formatMetric(leftMetric.axisErrorDeg, 3)}
  data-right-axis-error-deg={formatMetric(rightMetric.axisErrorDeg, 3)}
  data-left-contact-offset-mm={formatMetric(leftMetric.contactOffsetMm, 3)}
  data-right-contact-offset-mm={formatMetric(rightMetric.contactOffsetMm, 3)}
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
            onCollisionEvents={index === 0
              ? (_events, _pose, grip) => collectGripMetrics(grip)
              : undefined}
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
