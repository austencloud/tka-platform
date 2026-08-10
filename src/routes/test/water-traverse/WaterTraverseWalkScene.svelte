<script lang="ts">
  /**
   * The Water Traverse — walkable graybox.
   *
   * Every visible box is drawn from the same collider list the physics world is
   * built from, so what you can see and what you can stand on cannot drift
   * apart. Atmosphere is sampled continuously from the player's position rather
   * than switched per landscape; see water-traverse-atmosphere.ts.
   */
  import { onDestroy, onMount } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    Color,
    DirectionalLight,
    FogExp2,
    Group,
    HemisphereLight,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Quaternion,
    Vector3,
  } from "three";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type { AvatarState, PhysicsProvider } from "@austencloud/camera-3d";
  import {
    MUSEUM_GRAVITY,
    MUSEUM_JUMP_VELOCITY,
  } from "$lib/features/museum/domain/museum-design-rules";
  import {
    createPhysicsWorldState,
    createRigidBody,
    disposePhysicsWorld,
    initPhysicsWorld,
    stepPhysics,
  } from "$lib/shared/3d/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
  } from "$lib/shared/3d/physics/player-controller";
  import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/rapier-physics-provider";
  import type {
    PhysicsWorldState,
    PlayerControllerState,
  } from "$lib/shared/3d/physics/types";
  import ReflectivePool from "$lib/shared/3d/environments/primitives/ReflectivePool.svelte";
  import OceanWaterSurface from "$lib/shared/3d/environments/scenes/ocean/runtime/water/WaterSurface.svelte";
  import SteamColumn from "$lib/features/water-traverse/components/SteamColumn.svelte";
  import SeaChamberLife from "$lib/features/water-traverse/components/SeaChamberLife.svelte";
  import TrenchFloor from "$lib/features/water-traverse/components/TrenchFloor.svelte";
  import {
    detectOceanQuality,
    getOceanQualityConfig,
  } from "$lib/shared/3d/environments/scenes/ocean/quality/ocean-quality";
  import TraverseSky from "$lib/features/water-traverse/components/TraverseSky.svelte";
  import MuseumPerformerStation3D from "$lib/features/museum/components/game/MuseumPerformerStation3D.svelte";
  import {
    EYE_ABOVE_FLOOR,
    SEA_FLOOR_Y,
    SNOW_Y,
    WATERLINE_Y,
    legAt,
    type WaterState,
  } from "$lib/features/water-traverse/data/water-traverse-terrain";
  import { sampleAtmosphere } from "$lib/features/water-traverse/data/water-traverse-atmosphere";
  import {
    buildWaterTraverseSetup,
    type TraverseCollider,
  } from "./water-traverse-colliders";

  interface Props {
    resetToken: number;
    onPositionChange?: (position: {
      x: number;
      y: number;
      z: number;
    }) => void;
  }

  const props: Props = $props();
  const threlte = useThrelte();

  /**
   * The walk is 372 m long and the far end is the expensive end to iterate on.
   * Position survives a reload; "Return to the snowfield" goes back on purpose.
   */
  const RESUME_KEY = "water-traverse-resume";
  const { layout, colliders, trimeshes, spawn } = buildWaterTraverseSetup();

  // ── Surfaces ──────────────────────────────────────────────────────────────

  /**
   * Graybox materials. Each is a real reading of what the surface is, not a
   * debug colour: the point of the pass is to judge composition and light, and
   * flat magenta boxes would answer neither.
   */
  const MATERIALS: Record<string, MeshStandardMaterial> = {
    snow: new MeshStandardMaterial({ color: "#f4f9fc", roughness: 0.95 }),
    // The bed under the frozen river. Dark, so the ice above it has something
    // to be translucent over.
    ice: new MeshStandardMaterial({ color: "#183a46", roughness: 0.6 }),
    rock: new MeshStandardMaterial({ color: "#6d7a80", roughness: 0.95 }),
    seabed: new MeshStandardMaterial({ color: "#41504e", roughness: 1 }),
    basalt: new MeshStandardMaterial({ color: "#3a342e", roughness: 0.88 }),
    sinter: new MeshStandardMaterial({ color: "#cdc1a8", roughness: 0.8 }),
    snowRidge: new MeshStandardMaterial({ color: "#dde8ef", roughness: 0.95 }),
    seaRidge: new MeshStandardMaterial({ color: "#33403f", roughness: 1 }),
    springRidge: new MeshStandardMaterial({ color: "#57493d", roughness: 0.9 }),
    /**
     * The building. Poured concrete, deliberately plain: the dioramas are the
     * expensive part and the shell should read as the thing they were
     * installed inside, not as more landscape.
     *
     * It used to be pale concrete lifted further by a 0.9 emissive, which put
     * the building in the same value band as the exhibit inside it. In a real
     * museum the hall is the DARK thing and the diorama is the lit thing —
     * that contrast is the entire reason a diorama reads as an object on
     * display rather than as the world. Dropping the shell four stops is what
     * makes the water the brightest thing in frame, and it costs nothing.
     *
     * The emissive stays, barely, for the ceiling: no light reaches it and
     * pure black overhead reads as a missing surface rather than as a roof.
     */
    hallShell: new MeshStandardMaterial({
      color: "#2f3134",
      roughness: 0.96,
      emissive: "#14161a",
      emissiveIntensity: 0.6,
    }),
    /** Portal jambs and lintels. Heavier stone, so the arch reads as built. */
    portal: new MeshStandardMaterial({
      color: "#4d5157",
      roughness: 0.85,
      emissive: "#1b1f24",
      emissiveIntensity: 0.5,
    }),
    /**
     * The painted backdrop each diorama is built against. Pale and self-lit,
     * with no texture to catch a highlight — the flatness is the tell that
     * this is a wall and not a distance, and the piece is better for admitting
     * it.
     */
    cyclorama: new MeshStandardMaterial({
      color: "#cfe3ee",
      roughness: 1,
      emissive: "#9dc4d8",
      emissiveIntensity: 0.85,
    }),
  };

  function materialFor(id: string): MeshStandardMaterial {
    if (id.startsWith("cyclorama-")) return MATERIALS.cyclorama;
    if (id.startsWith("hall-")) return MATERIALS.hallShell;
    if (id.startsWith("portal-")) return MATERIALS.portal;
    if (id.startsWith("snowfield")) return MATERIALS.snow;
    if (id === "frozen-river-bed") return MATERIALS.ice;
    if (id === "descent") return MATERIALS.rock;
    if (id === "sea-floor" || id.startsWith("ascent")) return MATERIALS.seabed;
    if (id === "spring-plain") return MATERIALS.basalt;
    if (id.startsWith("spring-bank")) return MATERIALS.sinter;
    if (id.startsWith("ridge-snow") || id === "cap-start")
      return MATERIALS.snowRidge;
    if (id.startsWith("ridge-descent")) return MATERIALS.snowRidge;
    if (id.startsWith("ridge-sea") || id.startsWith("ridge-ascent"))
      return MATERIALS.seaRidge;
    return MATERIALS.springRidge;
  }

  interface SurfaceMesh extends TraverseCollider {
    material: MeshStandardMaterial;
    quaternion: Quaternion;
  }

  /**
   * The peaks are painted scenery, not terrain.
   *
   * They were lit rock: MeshStandardMaterial taking the sun, casting and
   * receiving shadow, sitting in the same value band as everything else. Two
   * things went wrong with that. They read as unfinished low-poly mountains
   * rather than as a deliberate flat, and — because they answer to the same
   * light as the water — nothing in frame said which was the exhibit and which
   * was the room around it.
   *
   * So: matte, unlit, and mixed toward the cyclorama behind them by distance
   * from the route. A painted backdrop does not have a specular response and
   * does not get darker on its shadow side; the flatness IS the tell, the same
   * argument the cyclorama material already makes. Austen chose this over
   * sculpting them for real (2026-08-09).
   */
  const BACKDROP_TINT = new Color("#cfe3ee");

  /** Painted flat. `flatShading` keeps the facets crisp; nothing here is lit. */
  function paintedFlat(hex: string, towardBackdrop: number): MeshBasicMaterial {
    return new MeshBasicMaterial({
      color: new Color(hex).lerp(BACKDROP_TINT, towardBackdrop),
      fog: true,
    });
  }

  const RIDGE_BODY: Record<string, MeshBasicMaterial> = {
    snow: paintedFlat("#7d8b95", 0.34),
    sea: paintedFlat("#33423f", 0.16),
    spring: paintedFlat("#4b3f34", 0.2),
  };
  /**
   * Submerged ridges stay LIT.
   *
   * A painted flat is a background device and only works at background
   * distance. The trench's flanking walls are three metres from the visitor
   * and eighteen metres underwater, and stripping their light turned them into
   * a black jagged mass with pale caps — a hole in the picture rather than a
   * wall. Anything the visitor is standing INSIDE keeps its light; only the
   * scenery standing beyond the diorama gets flattened.
   */
  const RIDGE_BODY_LIT: Record<string, MeshStandardMaterial> = {
    snow: new MeshStandardMaterial({ color: "#5f6a72", roughness: 0.98 }),
    sea: new MeshStandardMaterial({ color: "#2b3736", roughness: 1 }),
    spring: new MeshStandardMaterial({ color: "#3d332a", roughness: 0.95 }),
  };
  const RIDGE_CAP_LIT: Record<string, MeshStandardMaterial> = {
    snow: new MeshStandardMaterial({ color: "#eef6fb", roughness: 0.92 }),
    sea: new MeshStandardMaterial({ color: "#44544d", roughness: 1 }),
    spring: new MeshStandardMaterial({ color: "#8d7663", roughness: 0.92 }),
  };
  /**
   * The cap is the lit face a scenic painter would put on: one value up, warmer
   * on the spring side, and pushed further toward the backdrop so the tops sink
   * into it rather than cutting a hard silhouette against the hall.
   */
  const RIDGE_CAP: Record<string, MeshBasicMaterial> = {
    snow: paintedFlat("#eef6fb", 0.42),
    sea: paintedFlat("#55655d", 0.3),
    spring: paintedFlat("#9c8471", 0.34),
  };

  interface RidgeMesh {
    id: string;
    x: number;
    z: number;
    baseY: number;
    yaw: number;
    skirtRadius: number;
    skirtHeight: number;
    peakRadius: number;
    peakHeight: number;
    peakBase: number;
    body: MeshBasicMaterial | MeshStandardMaterial;
    cap: MeshBasicMaterial | MeshStandardMaterial;
  }

  /** Stable pseudo-random in 0..1 from a string, so the range never reshuffles. */
  function idNoise(id: string, salt: number): number {
    let hash = salt;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash * 31 + id.charCodeAt(index)) % 100003;
    }
    return (Math.sin(hash * 0.618) + 1) / 2;
  }

  /**
   * Which palette a ridge wears.
   *
   * Depth decides it before the id does. The descent's flanking ridges run the
   * whole ramp from the snowfield down to the sea floor, so keying purely off
   * `ridge-descent` painted the submerged half snow-white: a row of bright
   * icebergs standing on the seabed, lit from a sun that is 18 m of water away.
   * A ridge whose base sits below the waterline is underwater rock, whatever
   * leg of the walk it belongs to.
   */
  function ridgeFamily(id: string, baseY: number): "snow" | "sea" | "spring" {
    if (baseY < WATERLINE_Y) return "sea";
    if (id.startsWith("ridge-snow") || id.startsWith("ridge-descent"))
      return "snow";
    if (id.startsWith("ridge-sea") || id.startsWith("ridge-ascent"))
      return "sea";
    return "spring";
  }

  const ridges: RidgeMesh[] = colliders
    .filter((collider) => collider.id.startsWith("ridge-"))
    .map((collider) => {
      const height = collider.size[1];
      const family = ridgeFamily(
        collider.id,
        collider.position[1] - height / 2,
      );
      const submerged = collider.position[1] - height / 2 < WATERLINE_Y;
      const footprint = Math.max(collider.size[0], collider.size[2]);
      const lean = idNoise(collider.id, 7);
      // The peak carries most of the height; the skirt is the mass it stands
      // on. Varying the split is what stops a range of cones reading as a row
      // of identical tents.
      const skirtHeight = height * (0.34 + lean * 0.24);
      // Base-to-height near 1:1. The first pass used the collider footprint
      // straight, which gave 10 m wide cones under 40 m of height: a field of
      // needles. Real massifs are wider than they are tall, and the cone only
      // reads as rock once its flank is shallow enough to catch the sun
      // differently from its shaded side.
      const spread = footprint * 2.1;
      return {
        id: collider.id,
        x: collider.position[0],
        z: collider.position[2],
        baseY: collider.position[1] - height / 2,
        yaw: idNoise(collider.id, 13) * Math.PI * 2,
        skirtRadius: spread * (0.68 + lean * 0.26),
        skirtHeight,
        peakRadius: spread * (0.38 + idNoise(collider.id, 23) * 0.19),
        peakHeight: height - skirtHeight * 0.62,
        peakBase: skirtHeight * 0.38,
        // Submerged = a wall you are inside; above water = scenery beyond
        // the diorama. Only the latter is painted.
        body: submerged ? RIDGE_BODY_LIT[family] : RIDGE_BODY[family],
        cap: submerged ? RIDGE_CAP_LIT[family] : RIDGE_CAP[family],
      };
    });

  /**
   * Surfaces the sculpted floor GLB draws, so the graybox must not.
   *
   * `sea-floor`, `descent` and the ascent ramps are still COLLIDERS — they are
   * the flat safety plane the seabed trimesh sits on — they are simply no
   * longer the thing you see. Drawing both would put a flat teal plane through
   * the middle of every dune.
   */
  function drawnByTrenchFloor(id: string): boolean {
    return (
      id === "sea-floor" || id === "descent" || id.startsWith("ascent")
    );
  }

  const surfaces: SurfaceMesh[] = colliders
    .filter(
      (collider) =>
        !collider.id.startsWith("ridge-") &&
        !collider.id.startsWith("cap-") &&
        !drawnByTrenchFloor(collider.id)
    )
    .map((collider) => ({
    ...collider,
    material: materialFor(collider.id),
    quaternion: collider.rotation
      ? new Quaternion(
          collider.rotation.x,
          collider.rotation.y,
          collider.rotation.z,
          collider.rotation.w
        )
      : new Quaternion(),
  }));

  /** Reflective surfaces, one per water plane the visitor sees from above. */
  const POOL_TUNING: Record<
    WaterState,
    {
      deepColor: string;
      shallowColor: string;
      reflectionTint: number;
      rippleStrength: number;
      rippleScale: number;
      foamWidth: number;
      flowSpeed: number;
      shoreFade: number;
    }
  > = {
    /**
     * Ice is the same optics with the motion taken out of it. Near-still
     * ripples and a wide pale shore read as a frozen surface without needing a
     * second shader — which is exactly the claim the piece is making about ice
     * and water being one substance.
     */
    ice: {
      deepColor: "#20505f",
      shallowColor: "#a8ccd6",
      reflectionTint: 0xdceef4,
      rippleStrength: 0.012,
      rippleScale: 0.5,
      foamWidth: 0.9,
      flowSpeed: 0.06,
      shoreFade: 3.5,
    },
    sea: {
      deepColor: "#062a3e",
      shallowColor: "#2c8394",
      reflectionTint: 0x9fbcc2,
      rippleStrength: 0.09,
      rippleScale: 1.25,
      foamWidth: 0.2,
      flowSpeed: 0.8,
      shoreFade: 2.6,
    },
    spring: {
      deepColor: "#123a3c",
      shallowColor: "#63b9ae",
      reflectionTint: 0xd8cdb6,
      rippleStrength: 0.05,
      rippleScale: 1.6,
      foamWidth: 0.45,
      flowSpeed: 0.45,
      shoreFade: 1.8,
    },
  };

  const pools = layout.waterPlanes
    .filter((plane) => !plane.seenFromBelow)
    .map((plane) => ({
      id: plane.id,
      width: plane.maxX - plane.minX,
      depth: plane.maxZ - plane.minZ,
      centreX: (plane.minX + plane.maxX) / 2,
      centreZ: (plane.minZ + plane.maxZ) / 2,
      surfaceY: plane.surfaceY,
      tuning: POOL_TUNING[plane.state],
    }));

  /**
   * The surface seen from underneath.
   *
   * This shipped as a 220-unit plane left at the world origin, which covered
   * z = -110..110 while the trench runs to 190. Standing anywhere past the
   * midpoint there was simply no surface overhead — which is most of why the
   * middle leg read as a featureless void. The plane is now centred on the
   * water rect it belongs to and sized to cover it with margin, so every
   * upward glance down there ends in open water.
   */
  const seaCeilingPlane = layout.waterPlanes.find((plane) => plane.seenFromBelow);
  const seaCeiling = seaCeilingPlane
    ? {
        centreX: (seaCeilingPlane.minX + seaCeilingPlane.maxX) / 2,
        centreZ: (seaCeilingPlane.minZ + seaCeilingPlane.maxZ) / 2,
        /**
         * Sized to the rect exactly, with no margin. The surface is a square
         * and the trench is long and narrow, so the long axis sets the size and
         * the overhang on the short axis hides behind the hall walls. Adding
         * margin on top of that pushed the plane back over the ice chamber,
         * where it covered the frozen river with a sheet of open sea.
         */
        size: Math.max(
          seaCeilingPlane.maxX - seaCeilingPlane.minX,
          seaCeilingPlane.maxZ - seaCeilingPlane.minZ
        ),
      }
    : null;

  /**
   * Quality tier for the borrowed ocean systems. Detected off the live
   * renderer, exactly as OceanScene does it, so a phone walking this route
   * gets the same content LOD the ocean scene would give it.
   */
  const oceanQuality = $derived(
    getOceanQualityConfig(detectOceanQuality(threlte.renderer ?? null))
  );

  // ── Performers ────────────────────────────────────────────────────────────

  /**
   * One performer per water state, standing on the centreline so the visitor
   * walks straight at them. The sequences are the museum's own: A is pro/pro
   * (ice), C is the anti-blue/pro-red hybrid (liquid), B is anti/anti (steam).
   */
  const PERFORMER_SEQUENCE: Record<string, string> = {
    A: "cave-water-seq-a",
    B: "cave-water-seq-b",
    C: "cave-water-seq-c",
  };

  /**
   * Animation range. A performer 120 m down a fogged trench is a silhouette at
   * best, and three live avatar rigs stepping at once is the one thing in this
   * scene with a real per-frame cost.
   */
  const PERFORMER_ACTIVE_RANGE = 90;

  // ── Atmosphere ────────────────────────────────────────────────────────────

  const background = new Color();
  const fog = new FogExp2(0xffffff, 0.01);
  const sun = new DirectionalLight(0xffffff, 2);
  const hemi = new HemisphereLight(0xffffff, 0xffffff, 1);
  /** Zenith colour for the dome; the fog colour is its horizon. */
  const zenith = new Color();
  /** Shared with the sky dome, mutated in place rather than re-rendered. */
  const live = { submersion: 0 };

  /**
   * Where the sun sits relative to the visitor. Low and behind-left, so the
   * ridges cast down the valley and the walk is toward the light.
   */
  const SUN_OFFSET = new Vector3(-46, 62, -78);
  const sunDirection = SUN_OFFSET.clone().normalize();

  /**
   * The physics body reports its capsule CENTRE, which sits halfHeight+radius
   * above the floor; the eye is EYE_ABOVE_FLOOR above it. Submersion is
   * measured at the eye, so the difference is not cosmetic — 0.75 m is half
   * the height of the moment the whole third act is built around.
   */
  const EYE_ABOVE_BODY = EYE_ABOVE_FLOOR - 0.85;

  let ceilingGroup = $state.raw<Group | null>(null);


  function applyAtmosphere(x: number, bodyY: number, z: number): void {

    // The underside of the sea is a 220 m patch, not the whole 174 m leg plus

    // its width, so it rides above the visitor. Anchoring it to the centre of

    // the trench left the far ends of the walk with open black overhead.

    if (ceilingGroup && seaCeiling) {

      ceilingGroup.position.set(

        Math.max(seaCeiling.minX, Math.min(seaCeiling.maxX, x)),

        0,

        Math.max(seaCeiling.minZ, Math.min(seaCeiling.maxZ, z))

      );

    }
    const y = bodyY + EYE_ABOVE_BODY;
    const sample = sampleAtmosphere(z, y);
    live.submersion = sample.submersion;
    // A touch deeper than the horizon in every palette; the dome needs a ramp
    // to draw and the sample only carries one sky value.
    zenith.setHex(sample.background).multiplyScalar(0.72);
    background.setHex(sample.background);
    fog.color.setHex(sample.fogColor);
    fog.density = sample.fogDensity;
    sun.color.setHex(sample.sunColor);
    sun.intensity = sample.sunIntensity;
    hemi.color.setHex(sample.skyColor);
    hemi.groundColor.setHex(sample.groundColor);
    hemi.intensity = sample.hemiIntensity;
    // Keep the sun a fixed offset from the visitor so a 372 m walk never runs
    // out of its shadow frustum or its highlight.
    sun.position.set(x + SUN_OFFSET.x, y + SUN_OFFSET.y, z + SUN_OFFSET.z);
    sun.target.position.set(x, y, z);
    sun.target.updateMatrixWorld();
  }
  applyAtmosphere(spawn.x, spawn.y, spawn.z);

  // ── Physics ───────────────────────────────────────────────────────────────

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let isInitialized = $state(false);
  let isDisposed = false;
  const UNSEEN_RESET_TOKEN = Symbol("unseen");
  let appliedResetToken: number | symbol = UNSEEN_RESET_TOKEN;

  const resumePoint = readResumePoint();
  const bootPoint = resumePoint ?? { ...spawn };

  let playerPosition = $state({
    x: bootPoint.x,
    y: bootPoint.y,
    z: bootPoint.z,
  });
  let playerYaw = $state(bootPoint.yaw);
  let targetPlayerYaw = $state(bootPoint.yaw);
  let livePosition = { x: bootPoint.x, y: bootPoint.y, z: bootPoint.z };
  let resumeSaveElapsed = 0;
  let isMoving = $state(false);
  let moveDirection = $state({ x: 0, z: 0 });

  const avatarState: AvatarState = {
    get position() {
      return playerPosition;
    },
    get facingAngle() {
      return playerYaw;
    },
    get isMoving() {
      return isMoving;
    },
    get moveDirection() {
      return moveDirection;
    },
    setMoveInput(input) {
      moveDirection = input;
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement() {},
    setFacingAngle(angle) {
      targetPlayerYaw = angle;
    },
    snapFacingAngle(angle) {
      playerYaw = angle;
      targetPlayerYaw = angle;
    },
    updateLocomotion(delta) {
      let difference = targetPlayerYaw - playerYaw;
      while (difference > Math.PI) difference -= Math.PI * 2;
      while (difference < -Math.PI) difference += Math.PI * 2;
      const step = Math.min(Math.abs(difference), 12 * delta);
      playerYaw += Math.sign(difference) * step;
    },
  };

  interface ResumePoint {
    x: number;
    y: number;
    z: number;
    yaw: number;
  }

  function readResumePoint(): ResumePoint | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (!raw) return null;
      const point = JSON.parse(raw) as Partial<ResumePoint>;
      const values = [point.x, point.y, point.z, point.yaw];
      if (
        !values.every((value) => typeof value === "number" && isFinite(value))
      ) {
        return null;
      }
      // A resume point saved against an older layout can sit outside the
      // current one, and a body spawned outside every floor collider falls
      // forever. The route's length is a design variable that will keep
      // changing, so the stored point is checked against the live bounds
      // rather than trusted.
      const { bounds } = layout;
      const inside =
        point.x! > bounds.minX &&
        point.x! < bounds.maxX &&
        point.z! > bounds.minZ &&
        point.z! < bounds.maxZ &&
        point.y! > SEA_FLOOR_Y - 8 &&
        point.y! < SNOW_Y + 60;
      if (!inside) return null;
      return point as ResumePoint;
    } catch {
      return null;
    }
  }

  function writeResumePoint(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({ ...livePosition, yaw: playerYaw })
      );
    } catch {
      // A full or blocked sessionStorage costs a convenience, not the review.
    }
  }

  function clearResumePoint(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      // See writeResumePoint.
    }
  }

  function teleport(x: number, y: number, z: number): void {
    const target = { x, y, z };
    physicsProvider?.teleport?.(target);
    playerPosition = target;
    livePosition = target;
    applyAtmosphere(x, y, z);
  }

  function resetPlayer(): void {
    teleport(spawn.x, spawn.y, spawn.z);
    playerYaw = spawn.yaw;
    targetPlayerYaw = spawn.yaw;
    clearResumePoint();
  }

  /**
   * Dev-only review bridge. An agent verifying its own diff cannot take pointer
   * lock, so without this the only frame anyone can capture is the spawn point.
   * Coordinates are world metres — this route has no authoring-origin offset.
   */
  function installReviewBridge(): (() => void) | undefined {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const bridge = {
      /** Stand on the route at world Z, eye height derived from the floor. */
      at(z: number, x = 0) {
        const sample = layout.route.reduce((best, point) =>
          Math.abs(point.z - z) < Math.abs(best.z - z) ? point : best
        );
        const target = { x, y: sample.y + EYE_ABOVE_FLOOR, z };
        teleport(target.x, target.y, target.z);
        return { ...target, leg: legAt(z) };
      },
      go(x: number, y: number, z: number) {
        teleport(x, y, z);
        return { x, y, z };
      },
      /**
       * Face a world point from wherever the visitor is standing.
       *
       * This takes the camera off UnifiedCameraController and drives it
       * directly. Writing `playerYaw` does not turn the camera — the
       * controller owns it and overwrites any heading we set, which meant
       * every review frame captured before 2026-08-09 was shot at the boot
       * heading no matter what this function returned. A verification bridge
       * that silently ignores half its own API is worse than no bridge.
       */
      lookAt(x: number, z: number, y?: number) {
        const yaw = Math.atan2(
          x - playerPosition.x,
          z - playerPosition.z,
        );
        const pitch =
          y === undefined
            ? 0
            : Math.atan2(
                y - playerPosition.y,
                Math.hypot(x - playerPosition.x, z - playerPosition.z),
              );
        reviewAim = { yaw, pitch };
        return { yaw, pitch };
      },
      /** Aim by angle. Pitch is radians, positive up. */
      aim(yaw: number, pitch = 0) {
        reviewAim = { yaw, pitch };
        return { yaw, pitch };
      },
      /** Look straight down the route. */
      lookAhead(pitch = 0) {
        reviewAim = { yaw: 0, pitch };
        return { yaw: 0, pitch };
      },
      /** Hand the camera back to the walker. */
      release() {
        reviewAim = null;
        return true;
      },
      where: () => ({ ...playerPosition, yaw: playerYaw, leg: legAt(playerPosition.z) }),
      atmosphere: () =>
        sampleAtmosphere(playerPosition.z, playerPosition.y),
      scene: () => threlte.scene,
      /**
       * The fauna are GPGPU: fish positions live in a float texture, not in the
       * scene graph, so "did the school actually scatter" cannot be answered by
       * traversing objects or by reading a screenshot. The renderer is what
       * makes those textures readable back.
       */
      renderer: () => threlte.renderer,
      layout,
    };
    (window as unknown as Record<string, unknown>).__waterWalk = bridge;
    return () => {
      delete (window as unknown as Record<string, unknown>).__waterWalk;
    };
  }

  let removeReviewBridge: (() => void) | undefined;
  let removePageHide: (() => void) | undefined;

  onMount(async () => {
    removeReviewBridge = installReviewBridge();
    const onPageHide = () => writeResumePoint();
    window.addEventListener("pagehide", onPageHide);
    removePageHide = () => window.removeEventListener("pagehide", onPageHide);

    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -9.81, z: 0 });
    if (isDisposed || !physicsState) return;

    // The sculpted seabed, as one static triangle soup. It goes in before the
    // boxes so that if anything ever spawns during setup it lands on the real
    // ground rather than the flat safety plane underneath it.
    for (const mesh of trimeshes) {
      createRigidBody(
        physicsState,
        { type: "static", position: { x: 0, y: 0, z: 0 } },
        { type: "trimesh", vertices: mesh.vertices, indices: mesh.indices }
      );
    }

    for (const collider of colliders) {
      createRigidBody(
        physicsState,
        {
          type: "static",
          position: {
            x: collider.position[0],
            y: collider.position[1],
            z: collider.position[2],
          },
          ...(collider.rotation ? { rotation: collider.rotation } : {}),
        },
        {
          type: "box",
          size: {
            x: collider.size[0],
            y: collider.size[1],
            z: collider.size[2],
          },
        }
      );
    }

    playerState = createPlayerController(physicsState, {
      position: { x: bootPoint.x, y: bootPoint.y, z: bootPoint.z },
      autoStepMaxHeight: 0.45,
      snapToGroundDistance: 0.35,
    });
    physicsProvider = createRapierPhysicsProvider(physicsState, playerState);
    isInitialized = true;
  });

  $effect(() => {
    if (!isInitialized) return;
    // The first run is mount, not a press — adopting the token is what lets a
    // resumed position survive a reload.
    if (appliedResetToken === UNSEEN_RESET_TOKEN) {
      appliedResetToken = props.resetToken;
      return;
    }
    if (props.resetToken === appliedResetToken) return;
    appliedResetToken = props.resetToken;
    resetPlayer();
  });

  /**
   * Non-null while a review agent is aiming the camera by hand. Suspends
   * UnifiedCameraController so the two are never fighting over the same
   * transform, and is dev-only: nothing outside installReviewBridge sets it.
   */
  let reviewAim = $state<{ yaw: number; pitch: number } | null>(null);

  useTask(() => {
    const aim = reviewAim;
    const cam = threlte.camera.current;
    if (!aim || !cam) return;
    // Aim by look-target rather than by writing Euler angles: the bridge's
    // yaw is atan2(dx, dz) (0 = down-route, +Z), which is not Three's camera
    // convention, and converting between them by hand is how the heading got
    // silently wrong in the first place.
    const cosPitch = Math.cos(aim.pitch);
    cam.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
    cam.lookAt(
      playerPosition.x + Math.sin(aim.yaw) * cosPitch,
      playerPosition.y + Math.sin(aim.pitch),
      playerPosition.z + Math.cos(aim.yaw) * cosPitch,
    );
  });

  useTask((delta) => {
    if (!isInitialized || !physicsState?.world || isDisposed) return;
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (!position) return;
    props.onPositionChange?.(position);
    livePosition = position;
    applyAtmosphere(position.x, position.y, position.z);

    resumeSaveElapsed += delta;
    if (resumeSaveElapsed >= 0.5) {
      resumeSaveElapsed = 0;
      writeResumePoint();
    }
  });

  onDestroy(() => {
    isDisposed = true;
    writeResumePoint();
    removePageHide?.();
    removeReviewBridge?.();
    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }
    if (physicsState) disposePhysicsWorld(physicsState);
    Object.values(MATERIALS).forEach((material) => material.dispose());
    sun.dispose();
    hemi.dispose();
  });
</script>

<T is={background} attach="background" />
<T is={fog} attach="fog" />

<TraverseSky
  horizon={fog.color}
  {zenith}
  sunColor={sun.color}
  {sunDirection}
  {live}
/>
<T is={hemi} />
<T is={sun} />
<T is={sun.target} />

{#each surfaces as surface (surface.id)}
  <T.Mesh
    position={surface.position}
    quaternion={[
      surface.quaternion.x,
      surface.quaternion.y,
      surface.quaternion.z,
      surface.quaternion.w,
    ]}
    receiveShadow
  >
    <T.BoxGeometry args={surface.size} />
    <T is={surface.material} />
  </T.Mesh>
{/each}

<!--
  The visible ridges. The colliders behind them stay boxes — a wall the visitor
  can never reach does not need an accurate shape — but a box you CAN see is a
  building. Flat tops in two tidy rows read as a city street, which is the exact
  thing this piece is not. Each block gets a low skirt and a taller peak, both
  four-sided cones under a random yaw, in two values: dark body, bright cap.
-->
{#each ridges as ridge (ridge.id)}
  <T.Group position={[ridge.x, ridge.baseY, ridge.z]} rotation.y={ridge.yaw}>
    <T.Mesh position.y={ridge.skirtHeight / 2}>
      <T.ConeGeometry args={[ridge.skirtRadius, ridge.skirtHeight, 5, 1]} />
      <T is={ridge.body} />
    </T.Mesh>
    <T.Mesh position.y={ridge.peakBase + ridge.peakHeight / 2} rotation.y={0.7}>
      <T.ConeGeometry args={[ridge.peakRadius, ridge.peakHeight, 4, 1]} />
      <T is={ridge.cap} />
    </T.Mesh>
  </T.Group>
{/each}

{#each pools as pool (pool.id)}
  <ReflectivePool
    width={pool.width}
    depth={pool.depth}
    position={[pool.centreX, pool.surfaceY, pool.centreZ]}
    textureWidth={512}
    textureHeight={512}
    deepColor={pool.tuning.deepColor}
    shallowColor={pool.tuning.shallowColor}
    reflectionTint={pool.tuning.reflectionTint}
    rippleScale={pool.tuning.rippleScale}
    rippleStrength={pool.tuning.rippleStrength}
    foamWidth={pool.tuning.foamWidth}
    shoreFade={pool.tuning.shoreFade}
    flowSpeed={pool.tuning.flowSpeed}
  />
{/each}

<!--
  The sea leg's surface is seen from underneath, which is a different
  capability from a reflective pool: it needs the Snell window — the bright
  circle of the whole sky compressed overhead, ringed by total internal
  reflection. The ocean scene already owns that shader.
-->
{#if seaCeiling}
  <T.Group
    bind:ref={ceilingGroup}
    position={[seaCeiling.centreX, 0, seaCeiling.centreZ]}
  >
    <OceanWaterSurface
      surfaceY={WATERLINE_Y}
      size={seaCeiling.size}
      segments={220}
      opacity={0.62}
      color="#1d7d92"
      skyColor="#bde9f4"
      tirDarkness={0.22}
    />
  </T.Group>
{/if}

<!--
  The ground itself. Drawn before everything that stands on it, and the reason
  the sea-floor / descent / ascent graybox slabs above are collider-only now.
-->
<TrenchFloor />

<!--
  The trench, populated. See SeaChamberLife for why the ocean's own systems are
  re-aimed rather than rebuilt, and why the root OceanScene is not used.
-->
<SeaChamberLife
  quality={oceanQuality}
  floorY={SEA_FLOOR_Y}
  waterlineY={WATERLINE_Y}
  fromZ={layout.legs.sea.minZ}
  toZ={layout.legs.sea.maxZ}
  halfWidth={layout.legs.sea.maxX}
/>

{#each layout.performers as performer (performer.id)}
  <MuseumPerformerStation3D
    stationId={`water-traverse-${performer.id}`}
    worldX={performer.x}
    worldZ={performer.z}
    worldY={performer.y}
    standingSurfaceHeight={0}
    facingAngle={performer.facingAngle}
    sequenceId={PERFORMER_SEQUENCE[performer.letter]}
    effectId={performer.effectId}
    autoPlay={true}
    showGrid={false}
    showPlatform={false}
    active={Math.abs(playerPosition.z - performer.z) < PERFORMER_ACTIVE_RANGE}
  />
{/each}

<SteamColumn
  position={[layout.plume.x, layout.plume.baseY, layout.plume.z]}
  height={layout.plume.height}
  radius={7}
  {fog}
/>

{#if isInitialized && physicsProvider}
  <UnifiedCameraController
    destinationId="water-traverse-walk"
    {avatarState}
    {physicsProvider}
    enabled={reviewAim === null}
    initialYaw={bootPoint.yaw}
    initialPitch={0}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle={true}
    moveSpeed={4.2}
    sprintMultiplier={2.2}
    gravity={MUSEUM_GRAVITY}
    jumpForce={MUSEUM_JUMP_VELOCITY}
  />
{/if}
