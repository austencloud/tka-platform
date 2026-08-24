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
  import { Box3, Quaternion, Vector3 } from "three";
  import type { Group, Object3D } from "three";
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
  //
  // The angle is MINIMIZED, not fixed: just enough for the inboard staff end
  // to clear the elbow and inner arm, which Austen estimates at 12–20°.
  // (Station values persist and stay programmatic; the tuning UI was removed
  // in favor of verbal adjustment.)
  const WEAVE_STATION_THETAS = [0, 90, 180, 270] as const;
  const WEAVE_STATION_DEFAULTS: readonly [number, number, number, number] = [
    -18, 0, 22, 0,
  ];
  const WEAVE_DWELL_DEFAULT_DEG = 22;
  // Full quarter-turn allowed: with the chest perpendicular to the wall the
  // body is out of the reel's way entirely and a W-point reel becomes an
  // E-point reel in the body frame. 45 was the previous default and is
  // migrated on load.
  const TORSO_ASSIST_DEFAULT_DEG = 90;
  const TORSO_ASSIST_PREVIOUS_DEFAULT_DEG = 45;
  const TORSO_ASSIST_SIGN = 1;
  const STAFF_HALF_LEN_M = 0.457;
  const AVOID_MARGIN_M = 0.05;
  const AVOID_MAX_PUSH_M = 0.5;
  // Previous defaults are recognized in storage and migrated to the current set.
  const WEAVE_STATION_PREVIOUS_DEFAULTS = [
    [-45, 0, 45, 0],
    [-16, 0, 16, 0],
  ] as const;
  type WeaveStations = [number, number, number, number];

  // The arm stays FULLY EXTENDED through the move, so the grip travels on
  // the natural arc that extension produces: it keeps its distance from the
  // body axis and comes slightly inboard as the reach goes fore/aft. (A
  // "rail" variant that pinned the grip over the hand point was tried and
  // rejected — it required the reach to lengthen at the extremes.)

  // A naturally extended arm relaxes a hair below perpendicular. The relax
  // is a rotation of the whole (straight) arm at the shoulder, not a fixed
  // height drop — the grip lands wherever the relaxed full extension puts it.
  const NATURAL_RELAX_DEG = 6;
  const NATURAL_RELAX_RAD = (NATURAL_RELAX_DEG * Math.PI) / 180;

  function parseStations(value: unknown): WeaveStations {
    if (
      Array.isArray(value) &&
      value.length === 4 &&
      value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ) {
      const clamped = value.map((deg) =>
        Math.max(-60, Math.min(60, deg))
      ) as WeaveStations;
      // Stored state on any untouched previous default follows the current values.
      if (
        WEAVE_STATION_PREVIOUS_DEFAULTS.some((defaults) =>
          clamped.every((deg, i) => deg === defaults[i])
        )
      ) {
        return [...WEAVE_STATION_DEFAULTS] as WeaveStations;
      }
      return clamped;
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
    weaveDwellDeg: number;
    torsoAssistDeg: number;
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
      weaveAuto: true,
      weaveDepthDeg: 0,
      weaveStationsDeg: [...WEAVE_STATION_DEFAULTS] as WeaveStations,
      weavePhaseDeg: 0,
      weaveDwellDeg: WEAVE_DWELL_DEFAULT_DEG,
      torsoAssistDeg: TORSO_ASSIST_DEFAULT_DEG,
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
        weaveDwellDeg:
          typeof parsed.weaveDwellDeg === "number"
            ? Math.max(0, Math.min(28, parsed.weaveDwellDeg))
            : fallback.weaveDwellDeg,
        torsoAssistDeg:
          typeof parsed.torsoAssistDeg === "number" &&
          parsed.torsoAssistDeg !== TORSO_ASSIST_PREVIOUS_DEFAULT_DEG
            ? Math.max(0, Math.min(TORSO_ASSIST_DEFAULT_DEG, parsed.torsoAssistDeg))
            : fallback.torsoAssistDeg,
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
  let weaveDwellDeg = $state(initial.weaveDwellDeg);
  let torsoAssistDeg = $state(initial.torsoAssistDeg);

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
      weaveDwellDeg,
      torsoAssistDeg,
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
  // OTHER SIDE of the center of rotation: the weave's home plane is the one
  // that bisects the body itself, and the hand carries the staff between a
  // downstage plane and an upstage plane about that center. The staff keeps
  // its wall-planar relationship the whole way; the arm's reach around the
  // body is what re-orients the hand.
  //
  // The track is four keyframe stations, one per quarter phase, each holding
  // the ARM ANGLE (fore/aft reach) for that phase — periodic Catmull-Rom
  // between stations, so the reach dwells only where the track turns around
  // (the extremes) and moves fastest through the body crossings, like a
  // pendulum. The anchoring follows which staff END is inboard
  // (pointing at the torso), because that is what needs the clearance.
  // θ here is the POINT-RELATIVE phase (staff angle minus the hand point's
  // path angle — see weaveThetaDeg), so "inboard" means the same thing at
  // every point:
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
  // Stations are ANGLES, not centimeters: the z shift is derived by
  // swinging the measured straight arm at the shoulder, so the downstage
  // extreme can never out-reach the arm — over-reach is impossible by
  // construction.
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
    // Catmull-Rom); cap at the slider range.
    return Math.max(-60, Math.min(60, interpolated));
  }

  // THE BODY DEFINES THE GEOMETRY, the grid adheres to it. The drawn
  // grid's hand-point radius is staff-derived (staffLength × 0.6 ≈ 0.52m),
  // which sits well INSIDE a full arm extension — commanding the grip to
  // that radius made the IK bend the elbow to reach back in. Austen's
  // correction: the avatar just extends the arm naturally (straight, with
  // a slight relax below perpendicular), the grip lands wherever that
  // extension puts it, and the GRID rescales and re-centers so its hand
  // point sits on that grip. The skeleton is measured once after load
  // (shoulder position + straight-arm reach); until then the legacy
  // grid-radius park is the fallback so the scene never renders empty.
  //
  // WHERE ZERO LIVES: the rig parks wall-plane props AVATAR_GRID_OFFSET
  // (0.3m) downstage of the performer — the everyday holding plane. The
  // weave's zero is NOT that parked plane; it is the plane that BISECTS the
  // performer in half (head, shoulders, torso, calves), where the plane
  // sits when the arm extends straight out to the side. Fore/aft stations
  // swing the straight arm at the SHOULDER: a positive station carries the
  // grip (and the grid riding with it) downstage, a negative one upstage.

  const centerPathAngle = $derived(LOCATION_ANGLES[POINT_TO_GRID[point]] ?? 0);
  const basePosition = $derived(
    planeAngleToWorldPosition(Plane.WALL, centerPathAngle)
  );
  const armLateralM = $derived(
    Math.max(0.15, Math.hypot(basePosition.x, basePosition.y))
  );

  // The weave phase is which staff END is inboard, and "inboard" depends on
  // the hand point: the thumb end points along path angle θ in the same
  // convention that places the points, so thumb-inboard happens at
  // θ = pointAngle + 180, not at a fixed global θ. Measuring the phase
  // relative to the point's own angle keeps the stations anchored to the
  // end that needs clearance at EVERY point — with the raw global θ the
  // schedule was only correct at E, and at N the thumb reached the cranium
  // exactly where the track commanded zero shift.
  const weaveThetaDeg = $derived(
    staffAngleDeg - (centerPathAngle * 180) / Math.PI - weavePhaseDeg
  );
  const warpedWeaveThetaDeg = $derived.by(() => {
    const k = (weaveDwellDeg * Math.PI) / 180;
    const thetaRad = (weaveThetaDeg * Math.PI) / 180;
    return weaveThetaDeg - (k * Math.sin(2 * thetaRad) * 180) / Math.PI;
  });
  const weaveDeltaRad = $derived((weaveThetaDeg * Math.PI) / 180);
  const effSweepDeg = $derived(
    weaveAuto
      ? (weaveDepthDeg / 2) * (1 - Math.cos(weaveDeltaRad))
      : planeSweepDeg
  );

  const effArmDeg = $derived(weaveAuto ? trackArmDeg(warpedWeaveThetaDeg) : 0);
  const effArmRad = $derived((effArmDeg * Math.PI) / 180);

  // ── Natural-reach measurement ──
  // The production GLB's arm bones, measured once after the avatar loads.
  // PerformerRig exposes no skeleton API, so the page traverses the scene
  // graph under its own wrapper group for the arm chain (exact bone names
  // on the production model, with a mixamorig-prefix tolerance for others),
  // and converts the shoulder into the grid-slot frame via an identity
  // group parented inside the slot — frame-exact regardless of how the rig
  // nests its transforms.
  interface NaturalReach {
    shoulder: { x: number; y: number; z: number };
    reachM: number;
  }
  interface BodyCapsule {
    name: string;
    a: { x: number; y: number; z: number };
    b: { x: number; y: number; z: number };
    r: number;
  }
  let rigRootRef = $state<Group | undefined>();
  let gridFrameRef = $state<Group | undefined>();
  let naturalReach = $state<NaturalReach | null>(null);
  let bodyCapsules = $state<BodyCapsule[] | null>(null);

  function findBone(root: Object3D, name: string): Object3D | null {
    let found: Object3D | null = null;
    root.traverse((node) => {
      if (found) return;
      if (node.name.toLowerCase().replace(/^mixamorig:?/, "") === name) {
        found = node;
      }
    });
    return found;
  }

  $effect(() => {
    if (!import.meta.env.DEV || !rigRootRef) return;

    const root = rigRootRef;
    const landmarkBones = [
      ["Head", ["head"]],
      ["Neck", ["neck"]],
      ["Spine2", ["spine2", "spine1"]],
      ["Hips", ["hips"]],
      ["LeftShoulder", ["leftshoulder"]],
      ["RightShoulder", ["rightshoulder"]],
      ["LeftArm", ["leftarm"]],
      ["RightArm", ["rightarm"]],
      ["RightHand", ["righthand"]],
      ["LeftUpLeg", ["leftupleg"]],
      ["RightUpLeg", ["rightupleg"]],
      ["LeftLeg", ["leftleg"]],
      ["RightLeg", ["rightleg"]],
      ["LeftFoot", ["leftfoot"]],
      ["RightFoot", ["rightfoot"]],
    ] as const;
    let staffRef: Object3D | null = null;
    let shaftAxis: "x" | "y" | "z" | null = null;
    let halfLen: number | null = null;

    const asTuple = (position: Vector3): [number, number, number] =>
      position.toArray() as [number, number, number];

    function getLandmarks(): Record<string, [number, number, number]> {
      const landmarks: Record<string, [number, number, number]> = {};
      for (const [key, names] of landmarkBones) {
        const bone = names.map((name) => findBone(root, name)).find(Boolean);
        if (bone) landmarks[key] = asTuple(bone.getWorldPosition(new Vector3()));
      }
      let headTop: Object3D | null = null;
      root.traverse((node) => {
        if (!headTop && /HeadTop|Head_End/i.test(node.name)) headTop = node;
      });
      if (headTop) {
        landmarks.HeadTop = asTuple(
          (headTop as Object3D).getWorldPosition(new Vector3())
        );
      }
      return landmarks;
    }

    function isRedStaffGroup(node: Object3D): boolean {
      if (!node.children.length) return false;
      const namedAsStaff = [node, ...node.children].some((part) =>
        /staff/i.test(part.name)
      );
      const shaft = node.children.find((part) => {
        const mesh = part as Object3D & {
          geometry?: { type?: string };
          material?: { color?: { getHexString?: () => string } };
        };
        return (
          mesh.geometry?.type === "CylinderGeometry" &&
          mesh.material?.color?.getHexString?.() === "ef4444"
        );
      });
      // Staff3D currently leaves every object unnamed. Its source-defined
      // signature is the red Y-axis shaft plus the T-bar, end cap, and grip.
      return Boolean(shaft && (namedAsStaff || node.children.length >= 4));
    }

    function findStaff(): Object3D | null {
      if (staffRef?.parent) return staffRef;
      const knownBone = findBone(root, "head") ?? findBone(root, "hips");
      if (!knownBone) return null;
      let scene: Object3D = knownBone;
      while (scene.parent) scene = scene.parent;
      scene.traverse((node) => {
        if (!staffRef && isRedStaffGroup(node)) staffRef = node;
      });
      return staffRef;
    }

    function measureStaff(staff: Object3D): void {
      if (shaftAxis && halfLen !== null) return;
      staff.updateWorldMatrix(true, true);
      const localBounds = new Box3();
      staff.traverse((node) => {
        const mesh = node as Object3D & {
          geometry?: { boundingBox: Box3 | null; computeBoundingBox(): void };
        };
        if (!mesh.geometry) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;
        if (!bounds) return;
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              localBounds.expandByPoint(
                staff.worldToLocal(node.localToWorld(new Vector3(x, y, z)))
              );
            }
          }
        }
      });
      const size = localBounds.getSize(new Vector3());
      shaftAxis = size.x > size.y && size.x > size.z ? "x" : size.z > size.y ? "z" : "y";
      halfLen = size[shaftAxis] / 2;
    }

    const probe = {
      getLandmarks,
      getFrame() {
        const staff = findStaff();
        if (!staff) return { error: "staff-not-found" };
        measureStaff(staff);
        if (!shaftAxis || halfLen === null) return { error: "staff-not-found" };
        staff.updateWorldMatrix(true, true);
        const localEndA = new Vector3();
        const localEndB = new Vector3();
        localEndA[shaftAxis] = -halfLen;
        localEndB[shaftAxis] = halfLen;
        const landmarks = getLandmarks();
        return {
          point,
          staffAngleDeg,
          effArmDeg,
          gripTargetZ: gripZRigM,
          autoYawDeg,
          avoidPushM,
          avoidTiltDeg: (avoidTiltRad * 180) / Math.PI,
          clearedGrip: clearedGripTarget
            ? [clearedGripTarget.x, clearedGripTarget.y, clearedGripTarget.z]
            : null,
          staff: {
            staffPos: asTuple(staff.getWorldPosition(new Vector3())),
            endA: asTuple(staff.localToWorld(localEndA)),
            endB: asTuple(staff.localToWorld(localEndB)),
            shaftAxis,
            halfLen,
          },
          head: landmarks.Head,
        };
      },
    };
    const probeWindow = window as typeof window & {
      __gripLabProbe?: typeof probe;
    };
    probeWindow.__gripLabProbe = probe;
    return () => {
      if (probeWindow.__gripLabProbe === probe) delete probeWindow.__gripLabProbe;
    };
  });

  $effect(() => {
    const root = rigRootRef;
    const frame = gridFrameRef;
    if (!root || !frame || (naturalReach && bodyCapsules)) return;
    const interval = setInterval(() => {
      const shoulder = findBone(root, "rightarm");
      const elbow = findBone(root, "rightforearm");
      const wrist = findBone(root, "righthand");
      if (!shoulder || !elbow || !wrist) return;
      const shoulderW = shoulder.getWorldPosition(new Vector3());
      const elbowW = elbow.getWorldPosition(new Vector3());
      const wristW = wrist.getWorldPosition(new Vector3());
      // Bone segment lengths are pose-invariant, so measuring mid-animation
      // is safe; the grip point sits about half a palm past the wrist.
      let reach = shoulderW.distanceTo(elbowW) + elbowW.distanceTo(wristW);
      const knuckle = findBone(root, "righthandmiddle1");
      if (knuckle) {
        reach += wristW.distanceTo(knuckle.getWorldPosition(new Vector3())) / 2;
      }
      // A not-yet-settled skeleton reports collapsed bones; wait it out.
      if (reach < 0.2) return;
      frame.updateWorldMatrix(true, false);
      const shoulderLocal = frame.worldToLocal(shoulderW.clone());
      if (!naturalReach) {
        naturalReach = {
          shoulder: { x: shoulderLocal.x, y: shoulderLocal.y, z: shoulderLocal.z },
          reachM: reach,
        };
      }
      if (!bodyCapsules) {
        const capsuleSpecs = [
          ["hips", "leftupleg", "rightupleg", 0.13],
          ["thighL", "leftupleg", "leftleg", 0.09],
          ["thighR", "rightupleg", "rightleg", 0.09],
          ["shinL", "leftleg", "leftfoot", 0.07],
          ["shinR", "rightleg", "rightfoot", 0.07],
          ["torso", "hips", "neck", 0.15],
        ] as const;
        bodyCapsules = capsuleSpecs.flatMap(([name, aName, bName, r]) => {
          const aBone = findBone(root, aName);
          const bBone = findBone(root, bName);
          if (!aBone || !bBone) return [];
          const a = frame.worldToLocal(aBone.getWorldPosition(new Vector3()));
          const b = frame.worldToLocal(bBone.getWorldPosition(new Vector3()));
          return [{
            name,
            a: { x: a.x, y: a.y, z: a.z },
            b: { x: b.x, y: b.y, z: b.z },
            r,
          }];
        });
        // Skull capsule: the Head bone origin sits at the skull BASE, so
        // extend past it toward the crown. Measured at rest on purpose —
        // the dodge only ever moves the head AWAY from this volume, so the
        // rest pose is the conservative planning shape.
        const neckBone = findBone(root, "neck");
        const headBone = findBone(root, "head");
        if (neckBone && headBone) {
          const neck = frame.worldToLocal(neckBone.getWorldPosition(new Vector3()));
          const head = frame.worldToLocal(headBone.getWorldPosition(new Vector3()));
          bodyCapsules.push({
            name: "head",
            a: { x: neck.x, y: neck.y, z: neck.z },
            b: {
              x: head.x + (head.x - neck.x) * 0.8,
              y: head.y + (head.y - neck.y) * 0.8,
              z: head.z + (head.z - neck.z) * 0.8,
            },
            r: 0.11,
          });
        }
      }
      if (naturalReach && bodyCapsules) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  });

  // Aim of the straight arm in the frontal plane: toward the selected hand
  // point, relaxed a few degrees toward the ground. For the vertical points
  // (N/S) there is no "toward the ground" side, so no relax applies.
  const aimBaseRad = $derived(Math.atan2(basePosition.y, basePosition.x));
  const aimSideSign = $derived.by(() => {
    const c = Math.cos(aimBaseRad);
    return Math.abs(c) < 1e-6 ? 0 : Math.sign(c);
  });
  const aimAngleRad = $derived(aimBaseRad - NATURAL_RELAX_RAD * aimSideSign);

  // The grip in the grid-slot frame: shoulder + full reach along the relaxed
  // aim, swung fore/aft by rotating the straight arm toward downstage (+z).
  // The swing plane is spanned by the arm direction and the stage normal, so
  // a positive station carries the grip downstage from ANY hand point and
  // the reach length never changes — the arc model, on the real skeleton.
  function gripAt(swingRad: number) {
    if (!naturalReach) return null;
    const cosSwing = Math.cos(swingRad);
    const s = naturalReach.shoulder;
    const r = naturalReach.reachM;
    return {
      x: s.x + r * Math.cos(aimAngleRad) * cosSwing,
      y: s.y + r * Math.sin(aimAngleRad) * cosSwing,
      z: s.z + r * Math.sin(swingRad),
    };
  }
  // Recenter the swing on the body's bisecting plane: the measured shoulder
  // sits a few cm upstage of the slot origin, so an unbiased swing travels
  // farther upstage than downstage (-24/+11cm on the production GLB) and the
  // staff plane never gets far enough in front to clear the head at N. The
  // bias is the swing at which the grip's z lands exactly on z=0, so the
  // weave stations carry the plane equally in front of and behind the body.
  const swingBiasRad = $derived.by(() => {
    if (!naturalReach) return 0;
    const s = Math.max(
      -1,
      Math.min(1, -naturalReach.shoulder.z / naturalReach.reachM)
    );
    return Math.asin(s);
  });
  const gripHome = $derived.by(() => gripAt(swingBiasRad));
  const gripTarget = $derived.by(() =>
    gripAt(swingBiasRad + (weaveAuto ? effArmRad : 0))
  );
  const sweepYRad = $derived((-effSweepDeg * Math.PI) / 180);

  interface Point3 {
    x: number;
    y: number;
    z: number;
  }

  function closestPointOnSegment(point: Point3, a: Point3, b: Point3): Point3 {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const denominator = abx * abx + aby * aby + abz * abz;
    const t = denominator > 1e-12
      ? Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby + (point.z - a.z) * abz) / denominator))
      : 0;
    return { x: a.x + abx * t, y: a.y + aby * t, z: a.z + abz * t };
  }

  function closestPointsOnSegments(
    p1: Point3,
    q1: Point3,
    p2: Point3,
    q2: Point3
  ): { staff: Point3; capsule: Point3 } {
    const d1 = { x: q1.x - p1.x, y: q1.y - p1.y, z: q1.z - p1.z };
    const d2 = { x: q2.x - p2.x, y: q2.y - p2.y, z: q2.z - p2.z };
    const r = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
    const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
    const e = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
    const f = d2.x * r.x + d2.y * r.y + d2.z * r.z;
    let s = 0;
    let t = 0;
    if (a <= 1e-12) {
      t = e > 1e-12 ? Math.max(0, Math.min(1, f / e)) : 0;
    } else {
      const c = d1.x * r.x + d1.y * r.y + d1.z * r.z;
      if (e <= 1e-12) {
        s = Math.max(0, Math.min(1, -c / a));
      } else {
        const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
        const denominator = a * e - b * b;
        if (denominator !== 0) s = Math.max(0, Math.min(1, (b * f - c * e) / denominator));
        t = (b * s + f) / e;
        if (t < 0) {
          t = 0;
          s = Math.max(0, Math.min(1, -c / a));
        } else if (t > 1) {
          t = 1;
          s = Math.max(0, Math.min(1, (b - c) / a));
        }
      }
    }
    return {
      staff: { x: p1.x + d1.x * s, y: p1.y + d1.y * s, z: p1.z + d1.z * s },
      capsule: { x: p2.x + d2.x * t, y: p2.y + d2.y * t, z: p2.z + d2.z * t },
    };
  }

  // Worst clearance violation for a grip position, checked against every
  // capsule for every shaft direction in the wedge, plus the grip point
  // itself (the hand must not sit inside a thigh or the hip any more than
  // the staff may pass through one).
  function worstViolation(
    grip: Point3,
    shaftDirs: Point3[],
    capsules: BodyCapsule[]
  ): number {
    let worst = -Infinity;
    for (const capsule of capsules) {
      const clearance = capsule.r + AVOID_MARGIN_M;
      const capsulePoint = closestPointOnSegment(grip, capsule.a, capsule.b);
      const pointDistance = Math.hypot(
        grip.x - capsulePoint.x,
        grip.y - capsulePoint.y,
        grip.z - capsulePoint.z
      );
      if (clearance - pointDistance > worst) worst = clearance - pointDistance;
      for (const dir of shaftDirs) {
        const endA = {
          x: grip.x - dir.x * STAFF_HALF_LEN_M,
          y: grip.y - dir.y * STAFF_HALF_LEN_M,
          z: grip.z - dir.z * STAFF_HALF_LEN_M,
        };
        const endB = {
          x: grip.x + dir.x * STAFF_HALF_LEN_M,
          y: grip.y + dir.y * STAFF_HALF_LEN_M,
          z: grip.z + dir.z * STAFF_HALF_LEN_M,
        };
        const pair = closestPointsOnSegments(endA, endB, capsule.a, capsule.b);
        const distance = Math.hypot(
          pair.staff.x - pair.capsule.x,
          pair.staff.y - pair.capsule.y,
          pair.staff.z - pair.capsule.z
        );
        if (clearance - distance > worst) worst = clearance - distance;
      }
    }
    return worst;
  }

  // Escape directions the solver may push the grip along. A gradient walk
  // gets trapped in the valley between the two thighs; a discrete search
  // over these directions with a minimal-magnitude pick finds the way a
  // human actually clears the bottom point — fore, aft, out beside the hip,
  // or up and around it. Never down: the floor is not an escape.
  const AVOID_ESCAPE_DIRS: Point3[] = (() => {
    const dirs: Point3[] = [];
    for (const [x, z] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [Math.SQRT1_2, Math.SQRT1_2],
      [Math.SQRT1_2, -Math.SQRT1_2],
      [-Math.SQRT1_2, Math.SQRT1_2],
      [-Math.SQRT1_2, -Math.SQRT1_2],
    ]) {
      dirs.push({ x, y: 0, z });
      dirs.push({
        x: x * Math.SQRT1_2,
        y: Math.SQRT1_2,
        z: z * Math.SQRT1_2,
      });
    }
    dirs.push({ x: 0, y: 1, z: 0 });
    return dirs;
  })();

  // Target-direction hysteresis: keep last frame's chosen destination while
  // it stays within 30% of the best, so the plan doesn't flip sides frame to
  // frame. Plain variable on purpose — it is solver memory, not reactive
  // state.
  let avoidPrevDir: Point3 | null = null;
  // The displacement the grip is CURRENTLY carrying, as a vector. The
  // discrete search only picks the destination; the applied offset moves
  // toward it at a bounded speed, and a minimal per-frame feasibility
  // correction keeps it clear of the body along the way. The correction is
  // inherently small — the staff turns about a degree per frame — so the
  // grip's speed is capped by construction and a pop is impossible.
  let avoidApplied: {
    off: Point3;
    tiltRad: number;
    t: number;
  } | null = null;
  const AVOID_ATTRACT_RATE_M_S = 0.7;
  // Out-of-plane bend during a transit: the staff pitches its head toward
  // the side the plane is transferring to, so the head leads the sweep the
  // way a real reel bends slightly out of wall plane at the bottom.
  const AVOID_TILT_MAX_RAD = (25 * Math.PI) / 180;
  const AVOID_TILT_RATE_RAD_S = 3;

  function clearGripFromBody(
    candidate: Point3,
    shaftDirs: Point3[],
    baseShaftDirs: Point3[],
    capsules: BodyCapsule[]
  ): { grip: Point3; pushM: number; tiltRad: number } {
    const now = performance.now();
    const dt = avoidApplied
      ? Math.min(0.05, Math.max(0, (now - avoidApplied.t) / 1000))
      : 0;
    const minPushFrom = (origin: Point3, dir: Point3): number => {
      const at = (m: number): Point3 => ({
        x: origin.x + dir.x * m,
        y: origin.y + dir.y * m,
        z: origin.z + dir.z * m,
      });
      if (worstViolation(at(AVOID_MAX_PUSH_M), shaftDirs, capsules) > 0) {
        return Infinity;
      }
      let lo = 0;
      let hi = AVOID_MAX_PUSH_M;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) / 2;
        if (worstViolation(at(mid), shaftDirs, capsules) > 0) lo = mid;
        else hi = mid;
      }
      return hi;
    };
    const result = (off: Point3, tiltRad: number) => ({
      grip: {
        x: candidate.x + off.x,
        y: candidate.y + off.y,
        z: candidate.z + off.z,
      },
      pushM: Math.hypot(off.x, off.y, off.z),
      tiltRad,
    });

    // Destination: the minimal clearing displacement from the natural grip,
    // by discrete search (a gradient walk gets trapped between the thighs).
    const candidateClear =
      worstViolation(candidate, shaftDirs, capsules) <= 0;
    let targetOff: Point3 = { x: 0, y: 0, z: 0 };
    if (candidateClear) {
      avoidPrevDir = null;
    } else {
      let bestDir: Point3 | null = null;
      let bestM = Infinity;
      for (const dir of AVOID_ESCAPE_DIRS) {
        const m = minPushFrom(candidate, dir);
        if (m < bestM) {
          bestM = m;
          bestDir = dir;
        }
      }
      if (avoidPrevDir && bestDir && avoidPrevDir !== bestDir) {
        const prevM = minPushFrom(candidate, avoidPrevDir);
        if (prevM <= bestM * 1.3 + 0.02) {
          bestDir = avoidPrevDir;
          bestM = prevM;
        }
      }
      if (bestDir && Number.isFinite(bestM)) {
        avoidPrevDir = bestDir;
        targetOff = {
          x: bestDir.x * bestM,
          y: bestDir.y * bestM,
          z: bestDir.z * bestM,
        };
      } else {
        // Boxed in on every axis: aim at wherever the offset already is.
        avoidPrevDir = null;
        targetOff = avoidApplied
          ? { ...avoidApplied.off }
          : { x: 0, y: 0, z: 0 };
      }
    }

    if (!avoidApplied) {
      if (candidateClear) return result({ x: 0, y: 0, z: 0 }, 0);
      // Onset: the violation just crossed zero, so the minimal push is
      // small — engaging at it directly is continuous.
      avoidApplied = { off: targetOff, tiltRad: 0, t: now };
      return result(avoidApplied.off, 0);
    }

    // Bounded attraction toward the destination. This is the only term
    // allowed to move the grip farther than the geometry moved this frame,
    // and it is speed-capped — a back-to-front plane transfer glides
    // around instead of teleporting through the body. Release back to the
    // natural grip is the same motion with a zero target.
    const off: Point3 = { ...avoidApplied.off };
    const dx = targetOff.x - off.x;
    const dy = targetOff.y - off.y;
    const dz = targetOff.z - off.z;
    const dist = Math.hypot(dx, dy, dz);
    const maxStep = AVOID_ATTRACT_RATE_M_S * dt;
    if (dist > 1e-9) {
      const s = Math.min(1, maxStep / dist);
      off.x += dx * s;
      off.y += dy * s;
      off.z += dz * s;
    }

    // Feasibility correction: if the attracted point violates, push it out
    // by the smallest clearing move FROM WHERE IT IS. The staff only turns
    // about a degree per frame, so this stays millimetric — the safety
    // term can never itself become a pop.
    const p: Point3 = {
      x: candidate.x + off.x,
      y: candidate.y + off.y,
      z: candidate.z + off.z,
    };
    if (worstViolation(p, shaftDirs, capsules) > 0) {
      let fixDir: Point3 | null = null;
      let fixM = Infinity;
      for (const d of AVOID_ESCAPE_DIRS) {
        const m = minPushFrom(p, d);
        if (m < fixM) {
          fixM = m;
          fixDir = d;
        }
      }
      if (!fixDir || !Number.isFinite(fixM)) {
        // Nothing fully clears within the cap. The correction may never
        // silently give up — that is how penetrations happen. Walk a
        // bounded step in whichever direction reduces the violation most;
        // the 5cm plan margin buys the frames this takes to catch up.
        const step = Math.max(0.02, 2 * AVOID_ATTRACT_RATE_M_S * dt);
        let least = Infinity;
        for (const d of AVOID_ESCAPE_DIRS) {
          const far: Point3 = {
            x: p.x + d.x * step,
            y: p.y + d.y * step,
            z: p.z + d.z * step,
          };
          const v = worstViolation(far, shaftDirs, capsules);
          if (v < least) {
            least = v;
            fixDir = d;
            fixM = step;
          }
        }
      }
      if (fixDir && Number.isFinite(fixM)) {
        off.x += fixDir.x * fixM;
        off.y += fixDir.y * fixM;
        off.z += fixDir.z * fixM;
      }
    }

    // Transit bend: only while the PLAIN wall-plane move is in trouble and
    // the destination is on the other side fore/aft — pitch the staff head
    // toward the side of the transfer (+z when the plane is moving to the
    // front). Gating on the untilted wedge matters: the tilted wedge's own
    // violations would otherwise keep the tilt locked on through release,
    // and a bent staff sweeping back to the natural grip mows the legs.
    const baseClear =
      candidateClear || worstViolation(candidate, baseShaftDirs, capsules) <= 0;
    const remZ = targetOff.z - off.z;
    // A transfer means the destination sits on the OPPOSITE fore/aft side
    // of where the offset currently is, both meaningfully so. A large
    // offset merely draining toward a small same-side target is release,
    // not a transfer — bending there mows the legs.
    const transferring =
      targetOff.z * off.z < 0 &&
      Math.abs(targetOff.z) > 0.02 &&
      Math.abs(off.z) > 0.02;
    const tiltTarget =
      !baseClear && transferring && Math.abs(remZ) > 0.12
        ? AVOID_TILT_MAX_RAD * Math.min(1, Math.abs(remZ) / 0.4) * Math.sign(remZ)
        : 0;
    const tiltStep = AVOID_TILT_RATE_RAD_S * dt;
    const tiltRad =
      Math.abs(tiltTarget - avoidApplied.tiltRad) <= tiltStep
        ? tiltTarget
        : avoidApplied.tiltRad +
          Math.sign(tiltTarget - avoidApplied.tiltRad) * tiltStep;

    if (
      candidateClear &&
      Math.hypot(off.x, off.y, off.z) < 0.004 &&
      tiltRad === 0
    ) {
      avoidApplied = null;
      return result({ x: 0, y: 0, z: 0 }, 0);
    }
    avoidApplied = { off, tiltRad, t: now };
    return result(off, tiltRad);
  }

  // Solver tilt (positive = the low end of the shaft leads toward +z) maps
  // to a world-x rotation of -tilt: rotating theta about +x moves the low
  // end's z by about -|shaft.y| * theta.
  const tiltQuatFor = (tiltRad: number) =>
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -tiltRad);
  // The rendered staff follows the commanded grip through IK smoothing and
  // the weld, so it lags the command by a beat. Solving for a wedge of
  // shaft orientations around the current one keeps the plan clear of the
  // body for the orientations the rendered staff is actually sweeping.
  const AVOID_WEDGE_RAD = (15 * Math.PI) / 180;
  const gripClearance = $derived.by(() => {
    if (!gripTarget || !bodyCapsules)
      return { grip: gripTarget, pushM: 0, tiltRad: 0 };
    const staffRad = (staffAngleDeg * Math.PI) / 180;
    const sweepQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sweepYRad);
    // The wedge is checked with LAST frame's transit tilt applied — the
    // rendered staff carries it, so the plan must clear with it.
    const prevTilt = avoidApplied?.tiltRad ?? 0;
    const wedgeOffsets = [0, -AVOID_WEDGE_RAD, AVOID_WEDGE_RAD];
    const wedgeDirs = (tilt: number): Point3[] =>
      wedgeOffsets.map((offset) => {
        const quat = sweepQuat
          .clone()
          .multiply(calculatePropQuaternion(Plane.WALL, staffRad + offset));
        if (tilt !== 0) quat.premultiply(tiltQuatFor(tilt));
        const v = new Vector3(0, 1, 0).applyQuaternion(quat);
        return { x: v.x, y: v.y, z: v.z };
      });
    const tiltedDirs = wedgeDirs(prevTilt);
    // The untilted wedge gates the transit bend: tilt is justified only
    // while the PLAIN wall-plane move is in trouble. Gating on the tilted
    // wedge feeds back — the tilt's own violations would keep it engaged.
    const baseShaftDirs = prevTilt === 0 ? tiltedDirs : wedgeDirs(0);
    // While a tilt is in play the RENDERED staff lags the commanded tilt
    // (IK smoothing), sweeping every orientation between untilted and
    // fully tilted — so the plan must clear BOTH endpoints, not just the
    // current command.
    const shaftDirs =
      prevTilt === 0 ? tiltedDirs : [...tiltedDirs, ...baseShaftDirs];
    return clearGripFromBody(gripTarget, shaftDirs, baseShaftDirs, bodyCapsules);
  });
  const clearedGripTarget = $derived(gripClearance.grip);
  const avoidPushM = $derived(gripClearance.pushM);
  const avoidTiltRad = $derived(gripClearance.tiltRad);
  const commandedPropRotation = $derived.by(() => {
    const staffRad = (staffAngleDeg * Math.PI) / 180;
    const sweepQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sweepYRad);
    const base = sweepQuat.multiply(calculatePropQuaternion(Plane.WALL, staffRad));
    return avoidTiltRad === 0 ? base : tiltQuatFor(avoidTiltRad).multiply(base);
  });

  const autoYawDeg = $derived.by(() => {
    if (!naturalReach || !clearedGripTarget) return 0;
    const tx = clearedGripTarget.x;
    const tz = clearedGripTarget.z - naturalReach.shoulder.z;
    const horizontalReach = Math.hypot(tx, tz);
    const sideSign = Math.sign(naturalReach.shoulder.x) || 1;
    // Unwrap seam at -135: the exact middle of the cross-behind quadrant,
    // equidistant from both cone edges. A behind-reach on the cross side
    // keeps turning cross-body (back-pocket reach); only past the diagonal
    // does it become an open-via-natural-side reach. A seam any nearer the
    // cone flips the torso mid-weave at W.
    let alpha = (Math.atan2(tx * sideSign, tz) * 180) / Math.PI;
    if (alpha < -135) alpha += 360;
    const violation = alpha < -15 ? alpha + 15 : alpha > 105 ? alpha - 105 : 0;
    const weightT = Math.max(0, Math.min(1, (horizontalReach - 0.06) / 0.12));
    const weight = weightT * weightT * (3 - 2 * weightT);
    // Full gain: the torso absorbs the entire cone violation (up to the
    // Assist cap), so the reach always lands inside the comfort cone in the
    // body frame — the body accommodates the reel, not the other way round.
    return TORSO_ASSIST_SIGN *
      Math.max(-torsoAssistDeg, Math.min(torsoAssistDeg, violation)) *
      weight *
      sideSign;
  });

  // Where the grip actually sits along z in the grid-slot frame: the weave
  // swing owns it in auto mode; the manual travel slider slides it from the
  // natural home plane otherwise.
  const gripZRigM = $derived.by(() => {
    if (!clearedGripTarget) return null;
    return clearedGripTarget.z + (weaveAuto ? 0 : handTravelCm / 100);
  });

  // ── Grid adherence ──
  // The drawn grid re-centers and rescales so its hand-point ring passes
  // through the natural grip. Center stays on the body axis; its height
  // follows the relaxed home reach, so a horizontal point (E/W) lands
  // exactly at ring height. The ring through a vertical point (N/S) keeps
  // the correct radius from an axis-centered ring, though the natural reach
  // is above the SHOULDER, not the head — N is a known different animal.
  const gridCenterY = $derived.by(() => {
    if (!naturalReach) return 0;
    return (
      naturalReach.shoulder.y -
      naturalReach.reachM * Math.sin(NATURAL_RELAX_RAD) * Math.abs(aimSideSign)
    );
  });
  const gridScale = $derived.by(() => {
    if (!gripHome) return 1;
    const ringRadius = Math.hypot(gripHome.x, gripHome.y - gridCenterY);
    return ringRadius / userProportionsState.handPointRadius;
  });

  // Weave z readout relative to the bisecting plane; falls back to the
  // grid-radius arc until the skeleton is measured.
  const weaveZBodyM = $derived(
    clearedGripTarget ? clearedGripTarget.z : Math.sin(effArmRad) * armLateralM
  );

  // Legacy park (pre-measurement fallback only). Consumers measure z from
  // the PARKED plane (the rig's prop frame), so weave mode folds the
  // re-homing subtraction in here.
  const effTravelCm = $derived(
    weaveAuto
      ? (weaveZBodyM - STAGE.AVATAR_GRID_OFFSET) * 100
      : handTravelCm
  );

  // The one prop state under study: hand point + swept plane + scrubbed
  // staff angle. Built exactly like sequence playback builds its frames.
  const redPropState = $derived.by<PropState3D>(() => {
    // The rig's prop frame sits AVATAR_GRID_OFFSET downstage of the
    // grid-slot frame, so the measured grip subtracts it here and the rig
    // adds it back. Pre-measurement fallback: the legacy grid-radius park.
    const worldPosition =
      clearedGripTarget && gripZRigM !== null
        ? new Vector3(
            clearedGripTarget.x,
            clearedGripTarget.y,
            gripZRigM - STAGE.AVATAR_GRID_OFFSET
          )
        : new Vector3(
            basePosition.x * (weaveAuto ? Math.cos(effArmRad) : 1),
            basePosition.y,
            basePosition.z + effTravelCm / 100
          );
    return {
      plane: Plane.WALL,
      centerPathAngle,
      staffRotationAngle: (staffAngleDeg * Math.PI) / 180,
      worldPosition,
      worldRotation: commandedPropRotation,
    };
  });

  // Vertical pivot axis for the visible grid: the grip's x/z, so the drawn
  // plane visibly leaves frontal around the same axis the prop's plane does.
  // The pivot groups live in the grid-slot frame, which sits
  // AVATAR_GRID_OFFSET upstage of the prop-command frame.
  const gridPivot = $derived({
    x: redPropState.worldPosition.x,
    z: redPropState.worldPosition.z + STAGE.AVATAR_GRID_OFFSET,
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

  // ── Pose sharing ──
  // The station tuning sliders are gone (2026-08-23, Austen: maximum stage
  // space). Dwell remains exposed because it shapes the timing of the whole
  // track rather than tuning a single pose.
  let poseCopied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyPose() {
    const stationDump = WEAVE_STATION_THETAS.map(
      (theta, i) => `${theta}°→${weaveStationsDeg[i]}°`
    ).join(" ");
    const text =
      `point ${point} · angle ${Math.round(staffAngleDeg)}° · ` +
      `sweep ${Math.round(effSweepDeg)}° · arm ${Math.round(effArmDeg)}° · ` +
      `shift ${Math.round(weaveAuto ? weaveZBodyM * 100 : effTravelCm)}cm · ` +
      `stance ${stanceYawDeg}°` +
      (weaveAuto
        ? ` · weave auto (stations ${stationDump} · depth ${weaveDepthDeg}° · phase ${weavePhaseDeg}° · dwell ${weaveDwellDeg}° · assist ${torsoAssistDeg}°)`
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
        <T.Group bind:ref={rigRootRef}>
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
          stanceYaw={stanceYawRad + (autoYawDeg * Math.PI) / 180}
          weldGrip={true}
          headDodge={true}
        >
          {#snippet gridSlot()}
            <!-- Identity group at the slot origin: the reference frame the
                 skeleton measurement converts the shoulder into. -->
            <T.Group bind:ref={gridFrameRef} />
            <!-- The drawn grid IS the plane, so it rides the fore/aft shift
                 with the hand (the plane travels, it doesn't bend to meet
                 the grip) and pivots about the grip's vertical axis for any
                 residual sweep. It also ADHERES TO THE BODY: re-centered on
                 the relaxed natural reach and rescaled so the hand-point
                 ring passes through the measured grip. -->
            <T.Group
              position={[gridPivot.x, 0, gridPivot.z]}
              rotation.y={sweepYRad}
            >
              <T.Group position={[-gridPivot.x, 0, -gridPivot.z]}>
                <T.Group
                  position={[
                    0,
                    gridCenterY,
                    gripZRigM ?? STAGE.AVATAR_GRID_OFFSET + effTravelCm / 100,
                  ]}
                  scale={gridScale}
                >
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
        </T.Group>
      {/if}
    </Canvas>

    <aside class="control-deck" aria-label="Grip lab controls">
      <button
        type="button"
        class="transport"
        aria-label={playing ? "Pause staff rotation" : "Play staff rotation"}
        aria-pressed={playing}
        onclick={() => (playing = !playing)}
      >
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
      </button>

      <div class="point-control">
        <SegmentedControl
          options={POINT_OPTIONS}
          value={point}
          onchange={(next) => (point = next)}
          color="red"
          ariaLabelledby="grip-lab-point-label"
        />
      </div>
      <span class="visually-hidden" id="grip-lab-point-label">Hand point</span>

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
        <div class="slider-control">
          <label for="grip-lab-dwell">Dwell</label>
          <input
            id="grip-lab-dwell"
            type="range"
            min="0"
            max="28"
            step="1"
            bind:value={weaveDwellDeg}
            ondblclick={() => (weaveDwellDeg = WEAVE_DWELL_DEFAULT_DEG)}
          />
          <output for="grip-lab-dwell">{weaveDwellDeg}°</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset weave dwell"
            disabled={weaveDwellDeg === WEAVE_DWELL_DEFAULT_DEG}
            onclick={() => (weaveDwellDeg = WEAVE_DWELL_DEFAULT_DEG)}
          >↺</button>
        </div>
        <div class="slider-control">
          <label for="grip-lab-assist">Assist</label>
          <input
            id="grip-lab-assist"
            type="range"
            min="0"
            max="90"
            step="1"
            bind:value={torsoAssistDeg}
            ondblclick={() => (torsoAssistDeg = TORSO_ASSIST_DEFAULT_DEG)}
          />
          <output for="grip-lab-assist">{torsoAssistDeg}°</output>
          <button
            type="button"
            class="mini-reset"
            aria-label="Reset torso assist"
            disabled={torsoAssistDeg === TORSO_ASSIST_DEFAULT_DEG}
            onclick={() => (torsoAssistDeg = TORSO_ASSIST_DEFAULT_DEG)}
          >↺</button>
        </div>
        <span class="weave-readout">
          arm {Math.round(effArmDeg)}° · shift {Math.round(weaveZBodyM * 100)} cm · assist {Math.round(autoYawDeg)}°<span
            class:inactive-avoid={avoidPushM <= 0.005}
          > · avoid {Math.round(avoidPushM * 100)} cm</span>
        </span>
      {/if}

      <span class="key-hint" aria-hidden="true">keys 1–4 · space plays</span>
      <FilterChipBase
        label="Copy pose"
        mode="action"
        size="sm"
        chipColor="#ef5350"
        active={poseCopied}
        ariaLabel="Copy the current pose to the clipboard"
        onclick={copyPose}
      />
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

  /* One slim bar, centered at the bottom: the stage is the page. */
  .control-deck {
    position: absolute;
    bottom: clamp(0.75rem, 2vw, 1.5rem);
    left: 50%;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem 1rem;
    max-width: calc(100vw - 1.5rem);
    padding: 0.6rem 1rem;
    border: 1px solid var(--lab-stroke);
    border-radius: 1.1rem;
    background: var(--lab-panel);
    box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.48);
    backdrop-filter: blur(20px) saturate(120%);
  }

  /* The segmented control sizes to its four labels; never let it stretch
     the bar (a row of short labels must not become a progress bar). */
  .point-control {
    inline-size: clamp(16rem, 26vw, 22rem);
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
    opacity: 0.75;
  }

  .weave-readout {
    color: var(--lab-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    /* The avoidance slot stays reserved when no push is active. */
    min-width: 50ch;
  }

  .inactive-avoid {
    visibility: hidden;
  }

  .slider-control {
    display: grid;
    grid-template-columns: auto minmax(5rem, 8rem) auto auto;
    align-items: center;
    gap: 0.6rem;
  }

  .slider-control label {
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .slider-control output {
    min-width: 2.6rem;
    color: #ff9e94;
    font-size: 0.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .slider-control input[type="range"] {
    width: 100%;
    accent-color: #ef5350;
    cursor: pointer;
  }

  .mini-reset {
    position: relative;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--lab-stroke);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.07);
    color: var(--lab-text);
    cursor: pointer;
  }

  .mini-reset::after {
    content: "";
    position: absolute;
    inset: -0.55rem;
  }

  .mini-reset:disabled {
    opacity: 0.35;
    cursor: default;
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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

  @container (max-width: 34rem) {
    .key-hint {
      display: none;
    }
  }
</style>
