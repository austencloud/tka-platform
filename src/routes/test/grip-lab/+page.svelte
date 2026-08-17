<script lang="ts">
  /**
   * Grip Lab — the simplest possible proof of the staff-grip problem.
   *
   * One arm (the red/right hand), parked at a single cardinal hand point on
   * the wall plane, holding a staff whose rotation angle is scrubbed or
   * played through a full 360°. The hand never travels; only the staff's
   * middle-axis rotation changes. This isolates the wrist-orientation
   * question — how a gripping hand physically rides a full prop rotation —
   * from every other variable (paths, both hands, sequences, turns math).
   *
   * The scene drives the PRODUCTION pipeline on purpose: the same
   * PropState3D construction as sequence playback (plane-transforms math)
   * into the real PerformerRig, so the wrist goal, palm socket, and contact
   * lock under study here are the exact code the viewer runs. A hand-rolled
   * arm would prove nothing.
   */
  import { onDestroy, onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import { Quaternion, Vector3 } from "three";
  import {
    PerformerRig,
    Plane,
    PlaneMode,
    STAGE,
    userProportionsState,
  } from "@austencloud/scene-3d";
  import type { PropState3D } from "@austencloud/scene-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import Grid3D from "$lib/shared/3d/components/Grid3D.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import {
    createAvatarInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";
  import {
    planeAngleToWorldPosition,
    calculatePropQuaternion,
  } from "$lib/shared/3d/domain/constants/plane-transforms";
  import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";

  type CardinalPoint = "N" | "E" | "S" | "W";

  const POINT_TO_GRID: Record<CardinalPoint, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
  };

  const POINT_OPTIONS: { value: CardinalPoint; label: string }[] = [
    { value: "N", label: "North" },
    { value: "E", label: "East" },
    { value: "S", label: "South" },
    { value: "W", label: "West" },
  ];

  // ── Lab state (survives HMR + reload via localStorage) ──
  const STORAGE_KEY = "grip-lab-state-v1";

  interface PersistedState {
    point: CardinalPoint;
    staffAngleDeg: number;
    speedDegPerSec: number;
    stanceYawDeg: number;
    playing: boolean;
    planeSweepDeg: number;
    handTravelCm: number;
  }

  function loadPersisted(): PersistedState {
    const fallback: PersistedState = {
      point: "E",
      staffAngleDeg: 0,
      speedDegPerSec: 45,
      stanceYawDeg: 0,
      playing: true,
      planeSweepDeg: 0,
      handTravelCm: 0,
    };
    if (typeof localStorage === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        point:
          parsed.point && parsed.point in POINT_TO_GRID
            ? parsed.point
            : fallback.point,
        staffAngleDeg:
          typeof parsed.staffAngleDeg === "number"
            ? ((parsed.staffAngleDeg % 360) + 360) % 360
            : fallback.staffAngleDeg,
        speedDegPerSec:
          typeof parsed.speedDegPerSec === "number"
            ? Math.max(-180, Math.min(180, parsed.speedDegPerSec))
            : fallback.speedDegPerSec,
        stanceYawDeg:
          typeof parsed.stanceYawDeg === "number"
            ? Math.max(-60, Math.min(60, parsed.stanceYawDeg))
            : fallback.stanceYawDeg,
        playing:
          typeof parsed.playing === "boolean" ? parsed.playing : fallback.playing,
        planeSweepDeg:
          typeof parsed.planeSweepDeg === "number"
            ? Math.max(-90, Math.min(90, parsed.planeSweepDeg))
            : fallback.planeSweepDeg,
        handTravelCm:
          typeof parsed.handTravelCm === "number"
            ? Math.max(-40, Math.min(40, parsed.handTravelCm))
            : fallback.handTravelCm,
      };
    } catch {
      return fallback;
    }
  }

  const initial = loadPersisted();
  let point = $state<CardinalPoint>(initial.point);
  let staffAngleDeg = $state(initial.staffAngleDeg);
  let speedDegPerSec = $state(initial.speedDegPerSec);
  let stanceYawDeg = $state(initial.stanceYawDeg);
  let playing = $state(initial.playing);
  let planeSweepDeg = $state(initial.planeSweepDeg);
  let handTravelCm = $state(initial.handTravelCm);

  $effect(() => {
    const snapshot: PersistedState = {
      point,
      staffAngleDeg,
      speedDegPerSec,
      stanceYawDeg,
      playing,
      planeSweepDeg,
      handTravelCm,
    };
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  });

  // ── Rig state ──
  // Standalone avatar instance with NO sequence loaded: its blue prop state
  // stays null, so only the red (right) hand is active — the single arm.
  let avatarState = $state<ReturnType<typeof createAvatarInstanceState> | null>(
    null
  );
  try {
    avatarState = createAvatarInstanceState(
      { id: "grip-lab-performer", positionX: 0, positionZ: 0 },
      makeStandaloneDeps()
    );
  } catch (err) {
    console.warn("[GripLab] Failed to init avatar state:", err);
  }

  // The weave's two extra degrees of freedom, both relative to the frontal
  // wall plane as the reference frame:
  //
  // - Plane sweep pivots the SPIN PLANE about the vertical axis through the
  //   grip point (not the body center — the hand stays out at its point while
  //   the plane leaves frontal). Positive sweep sends the staff's outer end
  //   behind the performer, which is the direction the taught weave travels.
  // - Hand travel slides the grip fore/aft (+ toward the audience), the
  //   forward-back motion the hand needs to chase the swept plane.
  const sweepYRad = $derived((-planeSweepDeg * Math.PI) / 180);

  // The one prop state under study: hand point + swept plane + scrubbed
  // staff angle. Built exactly like sequence playback builds its frames.
  const redPropState = $derived.by<PropState3D>(() => {
    const centerPathAngle = LOCATION_ANGLES[POINT_TO_GRID[point]] ?? 0;
    const staffRad = (staffAngleDeg * Math.PI) / 180;
    const basePosition = planeAngleToWorldPosition(Plane.WALL, centerPathAngle);
    const worldPosition = new Vector3(
      basePosition.x,
      basePosition.y,
      basePosition.z + handTravelCm / 100
    );
    const sweepQuat = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      sweepYRad
    );
    return {
      plane: Plane.WALL,
      centerPathAngle,
      staffRotationAngle: staffRad,
      worldPosition,
      worldRotation: sweepQuat.multiply(
        calculatePropQuaternion(Plane.WALL, staffRad)
      ),
    };
  });

  // Vertical pivot axis for the visible grid: the grip's x/z, so the drawn
  // plane visibly leaves frontal around the same axis the prop's plane does.
  const gridPivot = $derived({
    x: redPropState.worldPosition.x,
    z: redPropState.worldPosition.z,
  });

  // ── Quarter-phase freeze ──
  // The weave decomposes into four quarter-phases. Freezing at each one lets
  // us inspect the actual grip pose as a still: does the hand's thumb side
  // stay on the staff's thumb end (the T-bar), or has the solver regripped?
  const PHASE_ANGLES = [0, 90, 180, 270] as const;

  function freezeAtPhase(angleDeg: number) {
    playing = false;
    staffAngleDeg = angleDeg;
  }

  const frozenPhase = $derived(
    !playing && PHASE_ANGLES.includes(staffAngleDeg as 0 | 90 | 180 | 270)
      ? staffAngleDeg
      : null
  );

  const stanceYawRad = $derived((stanceYawDeg * Math.PI) / 180);
  const groundOffset = $derived(-userProportionsState.groundY);

  // ── Camera ──
  const shot = $derived(
    computeFramingShot({
      performers: [{ x: 0, z: 0 }],
      plane: "wall",
      groundOffset,
      fovDeg: 50,
      elevationDeg: 5,
    })
  );
  // Mirror the eye to the audience side so we face the performer.
  const frontEye = $derived<[number, number, number]>([
    shot.eye.x,
    shot.eye.y,
    2 * shot.target.z - shot.eye.z,
  ]);
  const orbitTarget = $derived<[number, number, number]>([
    shot.target.x,
    shot.target.y,
    shot.target.z,
  ]);

  // ── Playback ──
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (playing) {
        staffAngleDeg =
          (((staffAngleDeg + speedDegPerSec * deltaSeconds) % 360) + 360) % 360;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
    avatarState?.destroy();
  });
</script>

<svelte:head>
  <title>Grip Lab</title>
  <meta
    name="description"
    content="Single-arm staff grip study: one hand point, one rotating staff, the production rig."
  />
</svelte:head>

<main class="lab-shell">
  <section class="stage" aria-label="Grip lab 3D stage">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={frontEye} fov={50}>
        <OrbitControls
          enableDamping
          target={orbitTarget}
          maxPolarAngle={Math.PI / 2}
        />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.9} />
      <T.DirectionalLight position={[2, 4, 3]} intensity={1.4} />

      {#if avatarState}
        <PerformerRig
          position={{ x: 0, z: 0 }}
          facingAngle={0}
          planeMode={PlaneMode.WALL}
          {avatarState}
          {redPropState}
          visiblePlanes={new Set([Plane.WALL])}
          gridMode="diamond"
          bluePropType={toScenePropType(PropType.STAFF)}
          redPropType={toScenePropType(PropType.STAFF)}
          {groundOffset}
          enableLocomotion={true}
          enableFootPlanting={true}
          stanceYaw={stanceYawRad}
        >
          {#snippet gridSlot()}
            <!-- Pivot the drawn grid about the grip's vertical axis so the
                 reference plane visibly sweeps with the spin plane. -->
            <T.Group
              position={[gridPivot.x, 0, gridPivot.z]}
              rotation.y={sweepYRad}
            >
              <T.Group position={[-gridPivot.x, 0, -gridPivot.z]}>
                <T.Group position.z={STAGE.AVATAR_GRID_OFFSET}>
                  <Grid3D
                    visiblePlanes={new Set([Plane.WALL])}
                    gridMode="diamond"
                    planeMode={PlaneMode.WALL}
                    showLabels={true}
                  />
                </T.Group>
              </T.Group>
            </T.Group>
          {/snippet}
        </PerformerRig>
      {/if}
    </Canvas>

    <header class="lab-copy">
      <p class="eyebrow">Grip Lab</p>
      <h1>One hand, one axis</h1>
      <p class="lede">
        The staff rotates around its middle axis at a fixed hand point. Watch
        what the wrist does — especially where it flips.
      </p>
    </header>

    <aside class="control-deck" aria-label="Grip lab controls">
      <div class="control-row point-row">
        <span class="row-label" id="grip-lab-point-label">Hand point</span>
        <SegmentedControl
          options={POINT_OPTIONS}
          value={point}
          onchange={(next) => (point = next)}
          color="red"
          ariaLabelledby="grip-lab-point-label"
        />
      </div>

      <div class="control-row phase-row">
        <span class="row-label">Freeze phase</span>
        <div class="phase-chips" role="group" aria-label="Freeze staff at quarter phase">
          {#each PHASE_ANGLES as phaseAngle (phaseAngle)}
            <FilterChipBase
              label={`${phaseAngle}°`}
              mode="action"
              size="sm"
              chipColor="#ef5350"
              active={frozenPhase === phaseAngle}
              ariaLabel={`Freeze staff at ${phaseAngle} degrees`}
              onclick={() => freezeAtPhase(phaseAngle)}
            />
          {/each}
        </div>
      </div>

      <div class="control-row transport-row">
        <button
          type="button"
          class="transport"
          aria-label={playing ? "Pause staff rotation" : "Play staff rotation"}
          aria-pressed={playing}
          onclick={() => (playing = !playing)}
        >
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
        </button>

        <div class="slider-control">
          <label for="grip-lab-angle">Staff angle</label>
          <input
            id="grip-lab-angle"
            type="range"
            min="0"
            max="360"
            step="1"
            bind:value={staffAngleDeg}
          />
          <output for="grip-lab-angle">{Math.round(staffAngleDeg)}°</output>
        </div>

        <div class="slider-control">
          <label for="grip-lab-speed">Speed</label>
          <input
            id="grip-lab-speed"
            type="range"
            min="-180"
            max="180"
            step="5"
            bind:value={speedDegPerSec}
          />
          <output for="grip-lab-speed">{speedDegPerSec}°/s</output>
        </div>

        <div class="slider-control">
          <label for="grip-lab-stance">Stance yaw</label>
          <input
            id="grip-lab-stance"
            type="range"
            min="-60"
            max="60"
            step="1"
            bind:value={stanceYawDeg}
          />
          <output for="grip-lab-stance">{stanceYawDeg}°</output>
        </div>
      </div>

      <div class="control-row weave-row">
        <div class="slider-control">
          <label for="grip-lab-sweep">Plane sweep</label>
          <input
            id="grip-lab-sweep"
            type="range"
            min="-90"
            max="90"
            step="1"
            bind:value={planeSweepDeg}
          />
          <output for="grip-lab-sweep">{planeSweepDeg}°</output>
        </div>

        <div class="slider-control">
          <label for="grip-lab-travel">Hand travel</label>
          <input
            id="grip-lab-travel"
            type="range"
            min="-40"
            max="40"
            step="1"
            bind:value={handTravelCm}
          />
          <output for="grip-lab-travel">{handTravelCm} cm</output>
        </div>
      </div>
    </aside>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #04060b;
  }

  .lab-shell {
    --lab-panel: rgba(9, 12, 19, 0.8);
    --lab-stroke: rgba(255, 255, 255, 0.13);
    --lab-text: #f6f7f5;
    --lab-muted: #a8adb9;
    width: 100%;
    height: 100svh;
    color: var(--lab-text);
    background: #04060b;
    font-family: var(--font-family-body, Inter, system-ui, sans-serif);
    container-type: inline-size;
  }

  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .stage :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  .lab-copy {
    position: absolute;
    top: clamp(1rem, 2.5vw, 2.5rem);
    left: clamp(1rem, 3vw, 3rem);
    z-index: 2;
    max-width: min(26rem, 70vw);
    pointer-events: none;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.85);
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: #c5c8cf;
    font-size: clamp(0.8125rem, 0.75rem + 0.15vw, 0.9375rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-family: var(--font-family-display, Inter, system-ui, sans-serif);
    font-size: clamp(1.9rem, 1.3rem + 2.2vw, 4rem);
    font-weight: 750;
    letter-spacing: -0.045em;
    line-height: 0.98;
  }

  .lede {
    margin: 0.7rem 0 0;
    color: var(--lab-muted);
    font-size: clamp(0.9rem, 0.82rem + 0.25vw, 1.125rem);
    line-height: 1.45;
  }

  .control-deck {
    position: absolute;
    right: clamp(0.75rem, 2.5vw, 2.5rem);
    bottom: clamp(0.75rem, 2.5vw, 2rem);
    left: clamp(0.75rem, 2.5vw, 2.5rem);
    z-index: 4;
    display: grid;
    gap: 0.85rem;
    padding: clamp(0.8rem, 1.4vw, 1.15rem);
    border: 1px solid var(--lab-stroke);
    border-radius: 1.1rem;
    background: var(--lab-panel);
    box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.48);
    backdrop-filter: blur(20px) saturate(120%);
  }

  .control-row {
    display: grid;
    align-items: center;
    gap: 0.9rem;
  }

  .point-row {
    /* The control sizes to its four labels; never let it stretch across
       the whole deck (a row of short labels must not become a progress bar). */
    grid-template-columns: auto minmax(0, 30rem);
    justify-content: start;
  }

  .row-label {
    color: var(--lab-muted);
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .phase-row {
    grid-template-columns: auto auto;
    justify-content: start;
  }

  .phase-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .transport-row {
    grid-template-columns: auto repeat(3, minmax(10rem, 1fr));
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .weave-row {
    grid-template-columns: repeat(2, minmax(10rem, 1fr));
  }

  /* "-40 cm" is wider than the degree outputs; reserve its worst case so the
     slider track never resizes as the value changes. */
  .weave-row .slider-control output {
    min-width: 4.5rem;
  }

  .transport {
    width: 3.25rem;
    min-width: 3.25rem;
    height: 3.25rem;
    border: 1px solid var(--lab-stroke);
    border-radius: 50%;
    background: linear-gradient(145deg, #ef5350, #b71c1c);
    box-shadow: 0 0.7rem 2.25rem rgba(220, 60, 55, 0.3);
    color: var(--lab-text);
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
  }

  .slider-control {
    display: grid;
    grid-template-columns: auto minmax(5rem, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
  }

  .slider-control label {
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .slider-control output {
    min-width: 3.6rem;
    color: #ff9e94;
    font-size: 0.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  input[type="range"] {
    width: 100%;
    accent-color: #ef5350;
    cursor: pointer;
  }

  @media (hover: hover) {
    .transport:hover {
      filter: brightness(1.12);
    }
  }

  button:focus-visible,
  input:focus-visible {
    outline: 0.18rem solid #ffffff;
    outline-offset: 0.18rem;
  }

  @container (max-width: 56rem) {
    .transport-row {
      grid-template-columns: auto 1fr;
    }

    .weave-row {
      grid-template-columns: 1fr;
    }
  }

  @container (max-width: 34rem) {
    .lab-copy {
      max-width: calc(100vw - 2rem);
    }

    .point-row {
      grid-template-columns: 1fr;
      gap: 0.45rem;
    }

    .slider-control {
      grid-template-columns: 1fr auto;
      gap: 0.3rem 0.6rem;
    }

    .slider-control input {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
