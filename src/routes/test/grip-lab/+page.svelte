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
  // v3: the weave autopilot's single shift amplitude became four keyframed
  // STATIONS (arm angle per quarter phase) — stale v2 state carried a
  // sine-law amplitude with the extremes anchored a quarter turn late.
  const STORAGE_KEY = "grip-lab-state-v3";

  // The four keyframe stations of the weave, anchored to the quarter phases
  // of the staff rotation. Each station's parameter is the ARM ANGLE the
  // fore/aft reach should hold at that phase: positive = downstage (toward
  // the audience), negative = upstage, 0 = the plane intersecting the body.
  const WEAVE_STATION_THETAS = [0, 90, 180, 270] as const;
  const WEAVE_STATION_DEFAULTS: readonly [number, number, number, number] = [
    -45, 0, 45, 0,
  ];
  type WeaveStations = [number, number, number, number];

  function parseStations(value: unknown): WeaveStations {
    if (
      Array.isArray(value) &&
      value.length === 4 &&
      value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ) {
      return value.map((deg) => Math.max(-60, Math.min(60, deg))) as WeaveStations;
    }
    return [...WEAVE_STATION_DEFAULTS] as WeaveStations;
  }

  interface PersistedState {
    point: CardinalPoint;
    staffAngleDeg: number;
    speedDegPerSec: number;
    stanceYawDeg: number;
    playing: boolean;
    planeSweepDeg: number;
    handTravelCm: number;
    weaveAuto: boolean;
    weaveDepthDeg: number;
    weaveStationsDeg: WeaveStations;
    weavePhaseDeg: number;
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
      weaveAuto: false,
      weaveDepthDeg: 0,
      weaveStationsDeg: [...WEAVE_STATION_DEFAULTS] as WeaveStations,
      weavePhaseDeg: 0,
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
        weaveAuto:
          typeof parsed.weaveAuto === "boolean"
            ? parsed.weaveAuto
            : fallback.weaveAuto,
        weaveDepthDeg:
          typeof parsed.weaveDepthDeg === "number"
            ? Math.max(0, Math.min(180, parsed.weaveDepthDeg))
            : fallback.weaveDepthDeg,
        weaveStationsDeg: parseStations(parsed.weaveStationsDeg),
        weavePhaseDeg:
          typeof parsed.weavePhaseDeg === "number"
            ? Math.max(-180, Math.min(180, parsed.weavePhaseDeg))
            : fallback.weavePhaseDeg,
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
  let weaveAuto = $state(initial.weaveAuto);
  let weaveDepthDeg = $state(initial.weaveDepthDeg);
  let weaveStationsDeg = $state<WeaveStations>(initial.weaveStationsDeg);
  let weavePhaseDeg = $state(initial.weavePhaseDeg);

  $effect(() => {
    const snapshot: PersistedState = {
      point,
      staffAngleDeg,
      speedDegPerSec,
      stanceYawDeg,
      playing,
      planeSweepDeg,
      handTravelCm,
      weaveAuto,
      weaveDepthDeg,
      weaveStationsDeg: [...weaveStationsDeg] as WeaveStations,
      weavePhaseDeg,
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
  //   grip point — bending the plane away from frontal. Kept as a manual
  //   probe and a residual knob, but the taught weave barely uses it.
  // - Hand travel / plane shift slides the grip fore/aft (+ toward the
  //   audience). The drawn plane rides along: the plane travels WITH the
  //   hand, it does not bend to meet it.
  //
  // ── Weave autopilot (keyframed plane-shift stations) ──
  // With the wrist thumb-locked, a full 360° of staff rotation demands 360°
  // of wrist roll — impossible. The weave answers by moving the grip to the
  // OTHER SIDE of the center of rotation: the base wall plane lives at the
  // body's own depth (z = 0), and the hand carries the staff between a
  // downstage plane and an upstage plane about that center. The staff keeps
  // its wall-planar relationship the whole way; the arm's reach around the
  // body is what re-orients the hand.
  //
  // The track is four keyframe stations, one per quarter phase, each holding
  // the ARM ANGLE (fore/aft reach) for that phase — periodic Catmull-Rom
  // between stations, so the reach dwells only where the track turns around
  // (the extremes) and moves fastest through the body crossings, like a
  // pendulum. The anchoring follows which staff END is inboard
  // (pointing at the torso), because that is what needs the clearance:
  //   θ=0    T-bar outboard, PINKY end at the body → upstage extreme (−45°):
  //          the pinky end passes BEHIND the center of rotation.
  //   θ=90   staff vertical (T-bar down) → crossing, plane intersects the body.
  //   θ=180  T-bar/THUMB end at the body → downstage extreme (+45°): the
  //          thumb end passes the forearm/head pocket in FRONT.
  //   θ=270  staff vertical (T-bar up) → crossing back.
  // (The previous sine law hung its extremes on the verticals — a quarter
  // turn late, so the avatar was still reaching downstage when the pinky
  // end needed its upstage clearance.)
  //
  // Stations are ANGLES, not centimeters: ±45° is the target reach, and the
  // z shift is derived from the frontal-plane shoulder→hand geometry, so
  // the downstage extreme can never silently out-reach the arm again.
  //   sweep(θ) = (depth/2) · (1 − cos(θ − φ))   residual bend, default 0
  function trackArmDeg(thetaDeg: number): number {
    const t = ((thetaDeg % 360) + 360) % 360;
    const seg = Math.floor(t / 90) % 4;
    const u = t / 90 - seg;
    const p0 = weaveStationsDeg[seg];
    const p1 = weaveStationsDeg[(seg + 1) % 4];
    const m0 = (p1 - weaveStationsDeg[(seg + 3) % 4]) / 2;
    const m1 = (weaveStationsDeg[(seg + 2) % 4] - p0) / 2;
    const u2 = u * u;
    const u3 = u2 * u;
    const interpolated =
      (2 * u3 - 3 * u2 + 1) * p0 +
      (u3 - 2 * u2 + u) * m0 +
      (-2 * u3 + 3 * u2) * p1 +
      (u3 - u2) * m1;
    // Extreme station combinations can overshoot the keys (standard
    // Catmull-Rom); cap at the slider range so tan() stays sane.
    return Math.max(-60, Math.min(60, interpolated));
  }

  // Frontal-plane geometry for the angle→shift conversion. Grid center
  // (y = 0) sits at shoulder height, so the moment arm is the frontal-plane
  // distance from the right shoulder to the hand point. Shoulder numbers
  // come from the avatar proportions (44cm lanky shoulder width → 22cm
  // half-width); rest z is the relaxed shoulder's slight forward set. The
  // per-station angles are the tunable truth — these just convert them.
  const SHOULDER_X_M = -0.22; // right shoulder; the E hand point is −x
  const SHOULDER_REST_Z_M = 0.03;

  const weaveDeltaRad = $derived(
    ((staffAngleDeg - weavePhaseDeg) * Math.PI) / 180
  );
  const effSweepDeg = $derived(
    weaveAuto
      ? (weaveDepthDeg / 2) * (1 - Math.cos(weaveDeltaRad))
      : planeSweepDeg
  );

  const centerPathAngle = $derived(LOCATION_ANGLES[POINT_TO_GRID[point]] ?? 0);
  const basePosition = $derived(
    planeAngleToWorldPosition(Plane.WALL, centerPathAngle)
  );
  const armLateralM = $derived(
    Math.max(0.15, Math.hypot(basePosition.x - SHOULDER_X_M, basePosition.y))
  );

  const effArmDeg = $derived(
    weaveAuto ? trackArmDeg(staffAngleDeg - weavePhaseDeg) : 0
  );
  const effTravelCm = $derived(
    weaveAuto
      ? (SHOULDER_REST_Z_M +
          Math.tan((effArmDeg * Math.PI) / 180) * armLateralM) *
        100
      : handTravelCm
  );

  const sweepYRad = $derived((-effSweepDeg * Math.PI) / 180);

  // The one prop state under study: hand point + swept plane + scrubbed
  // staff angle. Built exactly like sequence playback builds its frames.
  const redPropState = $derived.by<PropState3D>(() => {
    const staffRad = (staffAngleDeg * Math.PI) / 180;
    const worldPosition = new Vector3(
      basePosition.x,
      basePosition.y,
      basePosition.z + effTravelCm / 100
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

  // ── Reset + pose sharing ──
  const SLIDER_DEFAULTS = {
    staffAngleDeg: 0,
    speedDegPerSec: 45,
    stanceYawDeg: 0,
    planeSweepDeg: 0,
    handTravelCm: 0,
    weaveDepthDeg: 0,
    weavePhaseDeg: 0,
  } as const;

  function resetAll() {
    staffAngleDeg = SLIDER_DEFAULTS.staffAngleDeg;
    speedDegPerSec = SLIDER_DEFAULTS.speedDegPerSec;
    stanceYawDeg = SLIDER_DEFAULTS.stanceYawDeg;
    planeSweepDeg = SLIDER_DEFAULTS.planeSweepDeg;
    handTravelCm = SLIDER_DEFAULTS.handTravelCm;
    weaveDepthDeg = SLIDER_DEFAULTS.weaveDepthDeg;
    weaveStationsDeg = [...WEAVE_STATION_DEFAULTS] as WeaveStations;
    weavePhaseDeg = SLIDER_DEFAULTS.weavePhaseDeg;
  }

  let poseCopied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyPose() {
    const stationDump = WEAVE_STATION_THETAS.map(
      (theta, i) => `${theta}°→${weaveStationsDeg[i]}°`
    ).join(" ");
    const text =
      `point ${point} · angle ${Math.round(staffAngleDeg)}° · ` +
      `sweep ${Math.round(effSweepDeg)}° · arm ${Math.round(effArmDeg)}° · ` +
      `shift ${Math.round(effTravelCm)}cm · stance ${stanceYawDeg}°` +
      (weaveAuto
        ? ` · weave auto (stations ${stationDump} · depth ${weaveDepthDeg}° · phase ${weavePhaseDeg}°)`
        : "") +
      (playing ? ` · playing ${speedDegPerSec}°/s` : " · frozen");
    try {
      await navigator.clipboard.writeText(text);
      poseCopied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (poseCopied = false), 900);
    } catch {
      console.warn("[GripLab] Clipboard write blocked");
    }
  }

  // Keys 1-4 freeze the quarter phases; space toggles play. Only when focus
  // is not already on a control, so native slider/button behavior wins.
  function onLabKeydown(event: KeyboardEvent) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, button, select, textarea, [contenteditable]")
    ) {
      return;
    }
    const phaseIndex = ["1", "2", "3", "4"].indexOf(event.key);
    if (phaseIndex >= 0) {
      freezeAtPhase(PHASE_ANGLES[phaseIndex]);
      event.preventDefault();
    } else if (event.key === " ") {
      playing = !playing;
      event.preventDefault();
    }
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
    clearTimeout(copiedTimer);
    avatarState?.destroy();
  });
</script>

<svelte:window onkeydown={onLabKeydown} />

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
          weldGrip={true}
        >
          {#snippet gridSlot()}
            <!-- The drawn grid IS the plane, so it rides the fore/aft shift
                 with the hand (the plane travels, it doesn't bend to meet
                 the grip) and pivots about the grip's vertical axis for any
                 residual sweep. -->
            <T.Group
              position={[gridPivot.x, 0, gridPivot.z]}
              rotation.y={sweepYRad}
            >
              <T.Group position={[-gridPivot.x, 0, -gridPivot.z]}>
                <T.Group position.z={STAGE.AVATAR_GRID_OFFSET + effTravelCm / 100}>
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
        <span class="key-hint" aria-hidden="true">keys 1–4 · space plays</span>
        <div class="deck-actions">
          <FilterChipBase
            label="Reset all"
            mode="action"
            size="sm"
            ariaLabel="Reset all sliders to defaults"
            onclick={resetAll}
          />
          <FilterChipBase
            label="Copy pose"
            mode="action"
            size="sm"
            chipColor="#ef5350"
            active={poseCopied}
            ariaLabel="Copy the current pose to the clipboard"
            onclick={copyPose}
          />
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
            list="grip-lab-angle-ticks"
            bind:value={staffAngleDeg}
            ondblclick={() => (staffAngleDeg = SLIDER_DEFAULTS.staffAngleDeg)}
          />
          <output for="grip-lab-angle">{Math.round(staffAngleDeg)}°</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset staff angle"
            disabled={staffAngleDeg === SLIDER_DEFAULTS.staffAngleDeg}
            onclick={() => (staffAngleDeg = SLIDER_DEFAULTS.staffAngleDeg)}
          >↺</button>
          <datalist id="grip-lab-angle-ticks">
            {#each [0, 90, 180, 270, 360] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>
        </div>

        <div class="slider-control">
          <label for="grip-lab-speed">Speed</label>
          <input
            id="grip-lab-speed"
            type="range"
            min="-180"
            max="180"
            step="5"
            list="grip-lab-speed-ticks"
            bind:value={speedDegPerSec}
            ondblclick={() => (speedDegPerSec = SLIDER_DEFAULTS.speedDegPerSec)}
          />
          <output for="grip-lab-speed">{speedDegPerSec}°/s</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset speed"
            disabled={speedDegPerSec === SLIDER_DEFAULTS.speedDegPerSec}
            onclick={() => (speedDegPerSec = SLIDER_DEFAULTS.speedDegPerSec)}
          >↺</button>
          <datalist id="grip-lab-speed-ticks">
            {#each [-180, -90, -45, 0, 45, 90, 180] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>
        </div>

        <div class="slider-control">
          <label for="grip-lab-stance">Stance yaw</label>
          <input
            id="grip-lab-stance"
            type="range"
            min="-60"
            max="60"
            step="1"
            list="grip-lab-stance-ticks"
            bind:value={stanceYawDeg}
            ondblclick={() => (stanceYawDeg = SLIDER_DEFAULTS.stanceYawDeg)}
          />
          <output for="grip-lab-stance">{stanceYawDeg}°</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset stance yaw"
            disabled={stanceYawDeg === SLIDER_DEFAULTS.stanceYawDeg}
            onclick={() => (stanceYawDeg = SLIDER_DEFAULTS.stanceYawDeg)}
          >↺</button>
          <datalist id="grip-lab-stance-ticks">
            {#each [-60, -45, 0, 45, 60] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>
        </div>
      </div>

      <div class="control-row weave-row" class:auto={weaveAuto}>
        <div class="weave-head">
          <FilterChipBase
            label="Weave auto"
            mode="toggle"
            size="sm"
            chipColor="#ef5350"
            active={weaveAuto}
            ariaLabel="Toggle weave autopilot"
            onclick={() => (weaveAuto = !weaveAuto)}
          />
          {#if weaveAuto}
            <span class="weave-readout">
              arm {Math.round(effArmDeg)}° · shift {Math.round(effTravelCm)} cm ·
              sweep {Math.round(effSweepDeg)}°
            </span>
          {/if}
        </div>

        {#if weaveAuto}
          <div class="slider-control">
            <label for="grip-lab-depth">Sweep depth</label>
            <input
              id="grip-lab-depth"
              type="range"
              min="0"
              max="180"
              step="5"
              list="grip-lab-depth-ticks"
              bind:value={weaveDepthDeg}
              ondblclick={() => (weaveDepthDeg = SLIDER_DEFAULTS.weaveDepthDeg)}
            />
            <output for="grip-lab-depth">{weaveDepthDeg}°</output>
            <button
              type="button"
              class="mini-reset"
              aria-label="Reset sweep depth"
              disabled={weaveDepthDeg === SLIDER_DEFAULTS.weaveDepthDeg}
              onclick={() => (weaveDepthDeg = SLIDER_DEFAULTS.weaveDepthDeg)}
            >↺</button>
            <datalist id="grip-lab-depth-ticks">
              {#each [0, 45, 90, 135, 180] as tick (tick)}<option value={tick}></option>{/each}
            </datalist>
          </div>

          <!-- One keyframe station per quarter phase: the arm's fore/aft
               angle when the staff is at that θ. + = downstage, − = upstage. -->
          {#each WEAVE_STATION_THETAS as stationTheta, stationIndex (stationTheta)}
            <div class="slider-control">
              <label for={`grip-lab-arm-${stationTheta}`}>
                Arm @ {stationTheta}°
              </label>
              <input
                id={`grip-lab-arm-${stationTheta}`}
                type="range"
                min="-60"
                max="60"
                step="1"
                list="grip-lab-arm-ticks"
                bind:value={weaveStationsDeg[stationIndex]}
                ondblclick={() =>
                  (weaveStationsDeg[stationIndex] =
                    WEAVE_STATION_DEFAULTS[stationIndex])}
              />
              <output for={`grip-lab-arm-${stationTheta}`}>
                {weaveStationsDeg[stationIndex]}°
              </output>
              <button
                type="button"
                class="mini-reset"
                aria-label={`Reset arm angle at ${stationTheta} degrees`}
                disabled={weaveStationsDeg[stationIndex] ===
                  WEAVE_STATION_DEFAULTS[stationIndex]}
                onclick={() =>
                  (weaveStationsDeg[stationIndex] =
                    WEAVE_STATION_DEFAULTS[stationIndex])}
              >↺</button>
            </div>
          {/each}
          <datalist id="grip-lab-arm-ticks">
            {#each [-60, -45, 0, 45, 60] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>

          <div class="slider-control">
            <label for="grip-lab-phase">Phase</label>
            <input
              id="grip-lab-phase"
              type="range"
              min="-180"
              max="180"
              step="5"
              list="grip-lab-phase-ticks"
              bind:value={weavePhaseDeg}
              ondblclick={() => (weavePhaseDeg = SLIDER_DEFAULTS.weavePhaseDeg)}
            />
            <output for="grip-lab-phase">{weavePhaseDeg}°</output>
            <button
              type="button"
              class="mini-reset"
              aria-label="Reset weave phase"
              disabled={weavePhaseDeg === SLIDER_DEFAULTS.weavePhaseDeg}
              onclick={() => (weavePhaseDeg = SLIDER_DEFAULTS.weavePhaseDeg)}
            >↺</button>
            <datalist id="grip-lab-phase-ticks">
              {#each [-180, -90, 0, 90, 180] as tick (tick)}<option value={tick}></option>{/each}
            </datalist>
          </div>
        {:else}
        <div class="slider-control">
          <label for="grip-lab-sweep">Plane sweep</label>
          <input
            id="grip-lab-sweep"
            type="range"
            min="-90"
            max="90"
            step="1"
            list="grip-lab-sweep-ticks"
            bind:value={planeSweepDeg}
            ondblclick={() => (planeSweepDeg = SLIDER_DEFAULTS.planeSweepDeg)}
          />
          <output for="grip-lab-sweep">{planeSweepDeg}°</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset plane sweep"
            disabled={planeSweepDeg === SLIDER_DEFAULTS.planeSweepDeg}
            onclick={() => (planeSweepDeg = SLIDER_DEFAULTS.planeSweepDeg)}
          >↺</button>
          <datalist id="grip-lab-sweep-ticks">
            {#each [-90, -45, 0, 45, 90] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>
        </div>

        <div class="slider-control">
          <label for="grip-lab-travel">Hand travel</label>
          <input
            id="grip-lab-travel"
            type="range"
            min="-40"
            max="40"
            step="1"
            list="grip-lab-travel-ticks"
            bind:value={handTravelCm}
            ondblclick={() => (handTravelCm = SLIDER_DEFAULTS.handTravelCm)}
          />
          <output for="grip-lab-travel">{handTravelCm} cm</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset hand travel"
            disabled={handTravelCm === SLIDER_DEFAULTS.handTravelCm}
            onclick={() => (handTravelCm = SLIDER_DEFAULTS.handTravelCm)}
          >↺</button>
          <datalist id="grip-lab-travel-ticks">
            {#each [-40, -20, 0, 20, 40] as tick (tick)}<option value={tick}></option>{/each}
          </datalist>
        </div>
        {/if}
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
    grid-template-columns: auto auto 1fr auto;
  }

  .phase-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .key-hint {
    color: var(--lab-muted);
    font-size: 0.75rem;
    white-space: nowrap;
    justify-self: end;
    opacity: 0.75;
  }

  .deck-actions {
    display: flex;
    gap: 0.45rem;
    justify-self: end;
  }

  .transport-row {
    grid-template-columns: auto repeat(3, minmax(10rem, 1fr));
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .weave-row {
    grid-template-columns: repeat(2, minmax(10rem, 1fr));
  }

  /* Six autopilot knobs (4 stations + depth + phase) = two full rows of
     three; two manual sliders. Pinned per mode so neither ever strands an
     orphan in its row. */
  .weave-row.auto {
    grid-template-columns: repeat(3, minmax(9rem, 1fr));
  }

  .weave-head {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .weave-readout {
    color: var(--lab-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    /* Worst case: "arm −60° · shift −52 cm · sweep 180°" — reserve it. */
    min-width: 30ch;
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
    grid-template-columns: auto minmax(5rem, 1fr) auto auto;
    align-items: center;
    gap: 0.6rem;
  }

  .mini-reset {
    position: relative;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--lab-stroke);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--lab-muted);
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
  }

  /* Compact glyph, full 44px touch floor. */
  .mini-reset::after {
    content: "";
    position: absolute;
    inset: -0.55rem;
  }

  .mini-reset:disabled {
    opacity: 0.35;
    cursor: default;
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

    .mini-reset:not(:disabled):hover {
      background: rgba(255, 255, 255, 0.14);
      color: var(--lab-text);
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

    /* Keep every slider in the wide column; otherwise auto-placement drops
       the second row's first slider into the narrow button column. */
    .transport-row .slider-control {
      grid-column: 2;
    }

    .weave-row,
    .weave-row.auto {
      grid-template-columns: 1fr;
    }

    .phase-row {
      grid-template-columns: auto auto;
    }

    /* Keyboard hint is meaningless on touch-first narrow layouts. */
    .key-hint {
      display: none;
    }

    .deck-actions {
      grid-column: 1 / -1;
      justify-self: start;
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
      grid-template-columns: 1fr auto auto;
      gap: 0.3rem 0.6rem;
    }

    .slider-control input {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
