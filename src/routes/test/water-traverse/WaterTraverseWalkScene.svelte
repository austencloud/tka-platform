<script lang="ts">
  /**
   * The Water Traverse — graybox.
   *
   * ── What this file is for ──────────────────────────────────────────────────
   *
   * ONE question: is the box right? Does the walk pace well, is everything the
   * size it should be, do the walls contain, do the chambers actually join, is
   * the floor continuous, is there a ceiling overhead, and can you tell where to
   * go without being told. Nothing else.
   *
   * It is deliberately, aggressively undressed. There is no reef, no seabed
   * sculpt, no fauna, no sky dome, no water shader, no steam, no performers, and
   * no per-leg palette. Every one of those existed here and was removed on
   * 2026-08-10, because the room had been dressed to a fourth-gate finish
   * without its second gate ever being checked — and it showed. Snow peaks were
   * four-sided cones 42 m wide, painted flat white and unlit, which read as
   * igloos. Reef specimens ran to 66 m. Backdrop planes floated with nothing
   * joining them to the ground.
   *
   * None of that was a rendering bug. It was art applied to a volume nobody had
   * ever stood inside and judged. So the volume gets judged first.
   *
   * ── The rules this file keeps ──────────────────────────────────────────────
   *
   * 1. EVERY visible box is a collider, and every collider is a visible box.
   *    What you see is exactly what you can stand on and walk into. The
   *    terrain program (water-traverse-terrain.ts) is the single source; a
   *    surface it does not know about cannot appear here.
   *
   * 2. Material carries ROLE, not mood. Floor, wall, ceiling, portal, mass —
   *    five values of grey, and that is the whole palette. Two accent colours
   *    exist and are not scenery: orange is a measuring instrument, blue is a
   *    place the visitor is meant to stop.
   *
   * 3. Light is constant. It does not change by leg, depth, or position. A
   *    graybox that relights itself as you walk cannot tell you whether a wall
   *    is too tall — it only tells you the lighting is pretty.
   *
   * Dressing comes back later, on top of a box that has been approved.
   */
  import { onDestroy, onMount } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    Color,
    DirectionalLight,
    FogExp2,
    HemisphereLight,
    DoubleSide,
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
  import {
    CHANNEL_HALF_W,
    EYE_ABOVE_FLOOR,
    SEA_FLOOR_Y,
    SNOW_Y,
    TOTAL_LENGTH_M,
    WATERLINE_Y,
    legAt,
  } from "$lib/features/water-traverse/data/water-traverse-terrain";
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

  /** Position survives a reload; "Return to the snowfield" goes back on purpose. */
  const RESUME_KEY = "water-traverse-resume";
  const { layout, colliders, spawn } = buildWaterTraverseSetup();

  /** How fast the walk actually moves, in m/s. Pacing is measured against it. */
  const WALK_SPEED = 4.2;

  // ── Palette ─────────────────────────────────────────────────────────────────

  /**
   * Five greys and two instruments.
   *
   * The greys are separated by VALUE only, in the order a visitor reads a room:
   * the floor is the brightest thing because you are standing on it, the ceiling
   * is the darkest because no light reaches it, and the walls sit between. That
   * ordering is doing real work — it is what lets you judge whether a ceiling is
   * too low or a hall too wide from a still frame, without colour telling you
   * where to look.
   *
   * `portal` is deliberately the lightest surface in the scene. The seams
   * between chambers are the thing most likely to be wrong, so they are the
   * thing made most visible.
   */
  const GRAY = {
    floor: new MeshStandardMaterial({ color: "#9aa0a3", roughness: 0.92 }),
    /** The watercourse. One value down from the floor, so the path reads. */
    channel: new MeshStandardMaterial({ color: "#7c888f", roughness: 0.9 }),
    wall: new MeshStandardMaterial({ color: "#767c80", roughness: 0.95 }),
    ceiling: new MeshStandardMaterial({ color: "#6e7479", roughness: 0.98 }),
    portal: new MeshStandardMaterial({ color: "#b7bdc1", roughness: 0.85 }),
    /** Ridge blocks: scenery volume, drawn as the boxes they actually are. */
    mass: new MeshStandardMaterial({ color: "#868c8f", roughness: 0.96 }),
  };

  /**
   * Instruments, not scenery.
   *
   * Unlit on purpose: a measuring stick that changes value as it moves through
   * the room is a bad measuring stick. Orange reads distance and human height,
   * blue reads a place the visitor is meant to stop. If either colour ever
   * looks like part of the world, the graybox has failed at being a graybox.
   */
  const MARK = {
    ruler: new MeshBasicMaterial({ color: "#e08640" }),
    stop: new MeshBasicMaterial({ color: "#4f9ad0" }),
    /**
     * The vent column in the springs chamber.
     *
     * Translucent because the thing it stands in for is steam, and an opaque
     * cylinder would put a solid white slab across the far half of the only
     * room that has a far half. It was 0.3, which was tuned when this column
     * stood in a shaft of daylight and had contrast to spare; the chamber it
     * lives in now is uniform mid-grey on every surface, and at 0.3 the marker
     * simply did not appear in any frame. 0.55 overshot and turned the left
     * quarter of the chamber into fog. 0.35 with the narrower base is the value
     * at which the head wall stays visible THROUGH it — which is what makes it
     * read as vapour standing in a room rather than as a wall of the room.
     */
    beacon: new MeshBasicMaterial({
      color: "#dfe5e9",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: DoubleSide,
    }),
  };

  /**
   * The waterline, as a sheet of glass at y = 0.
   *
   * This is the one idea of the piece — walked ON, UNDER, and IN — so the
   * graybox has to show it, but it must not become a water shader or the pass
   * turns into a look pass again. A flat translucent plane is enough to see
   * exactly where the line cuts the terrain and the visitor.
   */
  const WATER = new MeshBasicMaterial({
    color: "#7ec6de",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    // Double-sided is load-bearing, not tidiness. A ground plane faces up, so
    // back-face culling hides it from anyone standing below it — which is the
    // trench, the entire middle leg, the one place the surface overhead IS the
    // idea. The first pass shipped it single-sided and the sea read as a dry
    // plain.
    side: DoubleSide,
  });

  const ALL_MATERIALS = [
    ...Object.values(GRAY),
    ...Object.values(MARK),
    WATER,
  ];

  /**
   * Role, not mood. A grey says what a surface DOES — hold you up, stop you,
   * cover you, let you through — so that a frame can be read for volume
   * without anybody deciding what rock looks like yet.
   *
   * Overhead surfaces are matched on `-ceiling`/`-roof` ANYWHERE in the id,
   * not just at the end: the cave's roof is cut into six numbered slices and
   * the canyon's into four named ones, and an endsWith test painted every one
   * of them as floor.
   */
  function materialFor(id: string): MeshStandardMaterial {
    if (id.startsWith("portal-")) return GRAY.portal;
    if (id.includes("-ceiling") || id.includes("-roof")) return GRAY.ceiling;
    if (id.startsWith("hall-")) return GRAY.wall;
    if (id.startsWith("cave-") || id.startsWith("canyon-")) return GRAY.wall;
    if (id.startsWith("ridge-") || id.startsWith("cap-")) return GRAY.mass;
    if (id.startsWith("cyclorama-")) return GRAY.wall;
    return GRAY.floor;
  }

  interface SurfaceMesh extends TraverseCollider {
    material: MeshStandardMaterial;
    quaternion: Quaternion;
  }

  /**
   * Every collider, drawn. No filter, no exceptions.
   *
   * The old scene skipped the sea floor, the descent and the ascent ramps
   * because a sculpted GLB drew them instead — which quietly broke the rule
   * this route was built on, since the thing you saw and the thing you stood on
   * were then two different surfaces authored in two different places. They are
   * back to being the same boxes.
   */
  const surfaces: SurfaceMesh[] = colliders.map((collider) => ({
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

  // ── Instruments ─────────────────────────────────────────────────────────────

  /** Floor elevation on the centreline at a given Z, from the route samples. */
  function routeYAt(z: number): number {
    const sample = layout.route.reduce((best, point) =>
      Math.abs(point.z - z) < Math.abs(best.z - z) ? point : best
    );
    return sample.y;
  }

  /**
   * The channel, as a ribbon of slabs laid on the floor down the centreline.
   *
   * This is the only wayfinding in the piece — no signage, no marker, follow the
   * water — so "is the pathway clear" is answered by whether you can see this
   * strip running away from you from any point on the walk.
   *
   * Each slab spans one route segment and is PITCHED to that segment's grade.
   * The first version laid flat 4 m slabs at each sample's elevation, which is
   * fine on the flats and a disaster on the descent: 1.83 m of drop per sample
   * turned the ribbon into a staircase with metre-and-a-half risers, drawn over
   * a ramp that is actually one smooth slab. A path that lies about the floor
   * underneath it is worse than no path at all.
   */
  const channelSlabs = layout.route.slice(0, -1).map((from, index) => {
    const to = layout.route[index + 1];
    const run = to.z - from.z;
    const rise = to.y - from.y;
    const length = Math.hypot(run, rise);
    // Same convention as the floor colliders: +Z is the slab's own length
    // axis, so a far end that sits higher is a negative rotation about X.
    const pitch = -Math.atan2(rise, run);
    // Lift along the slab's OWN normal, not world +Y, so a pitched slab clears
    // its ramp by the same 4 cm everywhere instead of sinking at one end.
    const normalY = run / length;
    const normalZ = -rise / length;
    const LIFT = 0.04;
    return {
      id: `channel-${index}`,
      y: (from.y + to.y) / 2 + normalY * LIFT,
      z: (from.z + to.z) / 2 + normalZ * LIFT,
      length,
      pitch,
    };
  });

  /**
   * Distance posts every 20 m, doubled in height every 100 m.
   *
   * Two jobs. They are a ruler — the walk is 244 m and no one can judge that by
   * eye — and they are a speedometer: watching posts go by is how you feel
   * whether the pace is right, which is the thing that cannot be read from a
   * plan drawing at all.
   */
  const POST_SPACING = 20;
  const posts = Array.from(
    { length: Math.floor(TOTAL_LENGTH_M / POST_SPACING) + 1 },
    (_, index) => {
      const z = index * POST_SPACING;
      const major = z % 100 === 0;
      return {
        id: `post-${z}`,
        z,
        y: routeYAt(z),
        height: major ? 5 : 2,
        x: CHANNEL_HALF_W + 1.6,
      };
    }
  );

  /**
   * A 1.8 m human, every 40 m, standing beside the path.
   *
   * The single most useful object in a graybox and the one this scene never
   * had. Every scale error already shipped here — the 42 m peaks, the 66 m
   * coral, a 78 m hall half-width — was invisible precisely because there was
   * nothing human-sized in frame to measure any of it against.
   */
  const HUMAN_SPACING = 40;
  const humans = Array.from(
    { length: Math.floor(TOTAL_LENGTH_M / HUMAN_SPACING) + 1 },
    (_, index) => {
      const z = index * HUMAN_SPACING;
      return {
        id: `human-${z}`,
        z,
        y: routeYAt(z),
        x: -(CHANNEL_HALF_W + 1.6),
      };
    }
  );

  /** Where a performer stands. A body-sized post on a disc you can see coming. */
  const stops = layout.performers.map((performer) => ({
    id: performer.id,
    x: performer.x,
    y: performer.y,
    z: performer.z,
    letter: performer.letter,
  }));

  /**
   * The vent column, as a plain cylinder.
   *
   * It used to be the piece's one long sightline — visible from the first step
   * through two portals — and that is gone with the shaft it stood in. It is
   * now a local object in the springs chamber, and the geometry question it
   * answers is a different one: does the room have anything in it besides the
   * performer and the door. Still the dumbest possible cylinder; that is the
   * right fidelity for a graybox.
   */
  const beacon = layout.plume;

  /**
   * The waterline, drawn as the layout's own planes rather than one sheet
   * across the whole footprint.
   *
   * The single sheet was a graybox shortcut that has stopped being true: it
   * flooded the canyon wall to wall when only the stream and the pools are
   * water, and it ran the sea straight through the cave's rock. Each plane
   * knows its own extent, so drawing them one for one is both less code and
   * the only version that answers "where is there water" honestly.
   */
  const waterSheets = layout.waterPlanes.map((plane) => ({
    id: plane.id,
    width: plane.maxX - plane.minX,
    depth: plane.maxZ - plane.minZ,
    x: (plane.minX + plane.maxX) / 2,
    y: plane.surfaceY,
    z: (plane.minZ + plane.maxZ) / 2,
  }));

  // ── Light ───────────────────────────────────────────────────────────────────

  /**
   * Constant, and that is the point.
   *
   * The scene this replaced sampled a full atmosphere program off the player's
   * position every frame — sky colour, fog density, sun intensity, hemisphere
   * ground bounce, all interpolating continuously along two axes. That program
   * is good and it is kept (water-traverse-atmosphere.ts); it is simply not a
   * graybox's business. Lighting that changes as you walk makes every volume
   * judgement unreliable, because you can no longer tell whether a chamber got
   * bigger or the light just got brighter.
   */
  const background = new Color("#a9b1b6");
  const fog = new FogExp2(0xa9b1b6, 0.0026);
  const hemi = new HemisphereLight(0xffffff, 0x7d848a, 1.1);
  /**
   * Key. Deliberately not strong: shadows are here to seat objects on the
   * floor, not to model a time of day. Turned up, the ridge blocks throw hard
   * diagonals across the snowfield that read as terrain features which are not
   * there.
   */
  const sun = new DirectionalLight(0xffffff, 1.15);
  /**
   * Bounce, aimed straight up, and the reason the ceilings are visible at all.
   *
   * Every ceiling in this hall is a down-facing normal 34–80 m overhead. A key
   * light from above never touches it and a hemisphere light gives it only the
   * ground term, so the first graybox frame rendered all three ceilings as
   * black — worse than no ceiling, because a black slab reads as a hole in the
   * roof. Raising the hemisphere ground colour far enough to fix that flattens
   * every wall in the scene at the same time. An upward light fixes only the
   * surfaces with the problem: it lands square on ceilings, grazes verticals,
   * and misses floors entirely.
   */
  const bounce = new DirectionalLight(0xffffff, 0.95);

  /** Low and behind-left, so form reads and the walk is toward the light. */
  const SUN_OFFSET = new Vector3(-46, 62, -78);

  /**
   * The light rides with the visitor. A 244 m walk cannot fit in one shadow
   * frustum, and an unshadowed graybox loses the contact between an object and
   * the floor it stands on — which is exactly how a floating backdrop plane
   * survived review here in the first place.
   */
  function followSun(x: number, y: number, z: number): void {
    sun.position.set(x + SUN_OFFSET.x, y + SUN_OFFSET.y, z + SUN_OFFSET.z);
    sun.target.position.set(x, y, z);
    sun.target.updateMatrixWorld();
    // Straight up through the visitor: position below, target above.
    bounce.position.set(x, y - 40, z);
    bounce.target.position.set(x, y, z);
    bounce.target.updateMatrixWorld();
  }
  followSun(spawn.x, spawn.y, spawn.z);

  // ── Physics ─────────────────────────────────────────────────────────────────

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
    followSun(x, y, z);
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
      /**
       * Stand on the route at world Z, eye height derived from the floor.
       *
       * Releases any held aim first. A review pass that teleports while the
       * camera is still detached leaves the walker unable to look around, which
       * is a genuinely maddening thing to hand back to somebody.
       */
      at(z: number, x = 0) {
        reviewAim = null;
        const target = { x, y: routeYAt(z) + EYE_ABOVE_FLOOR, z };
        teleport(target.x, target.y, target.z);
        return { ...target, leg: legAt(z) };
      },
      go(x: number, y: number, z: number) {
        reviewAim = null;
        teleport(x, y, z);
        return { x, y, z };
      },
      /**
       * Face a world point from wherever the visitor is standing.
       *
       * This takes the camera off UnifiedCameraController and drives it
       * directly. Writing `playerYaw` does not turn the camera — the controller
       * owns it and overwrites any heading we set.
       */
      lookAt(x: number, z: number, y?: number) {
        const yaw = Math.atan2(x - playerPosition.x, z - playerPosition.z);
        const pitch =
          y === undefined
            ? 0
            : Math.atan2(
                y - playerPosition.y,
                Math.hypot(x - playerPosition.x, z - playerPosition.z)
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
      where: () => ({
        ...playerPosition,
        yaw: playerYaw,
        leg: legAt(playerPosition.z),
      }),
      /** What the graybox exists to answer, as numbers. */
      pacing: () => pacing,
      scene: () => threlte.scene,
      renderer: () => threlte.renderer,
      layout,
    };
    (window as unknown as Record<string, unknown>).__waterWalk = bridge;
    return () => {
      delete (window as unknown as Record<string, unknown>).__waterWalk;
    };
  }

  /**
   * Leg lengths and the time each one costs at walking speed.
   *
   * Computed rather than asserted, so the number in the HUD is the number the
   * geometry actually produces. Pacing was the first thing asked of this pass
   * and it had never once been measured.
   */
  const pacing = (() => {
    const legs = (["snowfield", "sea", "spring"] as const).map((leg) => {
      const rect = layout.legs[leg];
      const metres = rect.maxZ - rect.minZ;
      return {
        leg,
        fromZ: rect.minZ,
        toZ: rect.maxZ,
        metres,
        seconds: +(metres / WALK_SPEED).toFixed(1),
      };
    });
    return {
      totalMetres: TOTAL_LENGTH_M,
      totalSeconds: +(TOTAL_LENGTH_M / WALK_SPEED).toFixed(1),
      walkSpeed: WALK_SPEED,
      legs,
    };
  })();

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

    // Boxes only. The sculpted seabed trimesh is deliberately NOT loaded: it is
    // art, and while it was collidable the surface you stood on and the surface
    // this file draws were different objects.
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
    // Aim by look-target rather than by writing Euler angles: the bridge's yaw
    // is atan2(dx, dz) (0 = down-route, +Z), which is not Three's camera
    // convention, and converting between them by hand is how the heading got
    // silently wrong in the first place.
    const cosPitch = Math.cos(aim.pitch);
    cam.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
    cam.lookAt(
      playerPosition.x + Math.sin(aim.yaw) * cosPitch,
      playerPosition.y + Math.sin(aim.pitch),
      playerPosition.z + Math.cos(aim.yaw) * cosPitch
    );
  });

  useTask((delta) => {
    if (!isInitialized || !physicsState?.world || isDisposed) return;
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (!position) return;
    props.onPositionChange?.(position);
    livePosition = position;
    followSun(position.x, position.y, position.z);

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
    ALL_MATERIALS.forEach((material) => material.dispose());
    sun.dispose();
    bounce.dispose();
    hemi.dispose();
  });
</script>

<T is={background} attach="background" />
<T is={fog} attach="fog" />
<T is={hemi} />
<T is={sun} castShadow />
<T is={sun.target} />
<T is={bounce} />
<T is={bounce.target} />

<!-- The room and the ground: every collider, drawn as the box it is. -->
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
    castShadow
  >
    <T.BoxGeometry args={surface.size} />
    <T is={surface.material} />
  </T.Mesh>
{/each}

<!-- The watercourse. The only wayfinding the visitor gets. -->
{#each channelSlabs as slab (slab.id)}
  <T.Mesh position={[0, slab.y, slab.z]} rotation.x={slab.pitch} receiveShadow>
    <T.BoxGeometry args={[CHANNEL_HALF_W * 2, 0.08, slab.length]} />
    <T is={GRAY.channel} />
  </T.Mesh>
{/each}

<!-- The waterline: y = 0 in every one of them, from the first step to the last. -->
{#each waterSheets as sheet (sheet.id)}
  <T.Mesh position={[sheet.x, sheet.y, sheet.z]} rotation.x={-Math.PI / 2}>
    <T.PlaneGeometry args={[sheet.width, sheet.depth]} />
    <T is={WATER} />
  </T.Mesh>
{/each}

<!-- Ruler: 20 m posts, 5 m tall every 100 m. -->
{#each posts as post (post.id)}
  <T.Mesh position={[post.x, post.y + post.height / 2, post.z]} castShadow>
    <T.BoxGeometry args={[0.35, post.height, 0.35]} />
    <T is={MARK.ruler} />
  </T.Mesh>
{/each}

<!-- 1.8 m of human, every 40 m. The scale reference this scene never had. -->
{#each humans as human (human.id)}
  <T.Mesh position={[human.x, human.y + 0.9, human.z]} castShadow>
    <T.BoxGeometry args={[0.5, 1.8, 0.3]} />
    <T is={MARK.ruler} />
  </T.Mesh>
{/each}

<!-- Where a performer stands, and how far off you can tell. -->
{#each stops as stop (stop.id)}
  <T.Group position={[stop.x, stop.y, stop.z]}>
    <T.Mesh position.y={0.03} rotation.x={-Math.PI / 2}>
      <T.CircleGeometry args={[2.6, 24]} />
      <T is={MARK.stop} />
    </T.Mesh>
    <T.Mesh position.y={0.9} castShadow>
      <T.BoxGeometry args={[0.5, 1.8, 0.3]} />
      <T is={MARK.stop} />
    </T.Mesh>
  </T.Group>
{/each}

<!--
  The vent column. It was 12 m across at the base, which was sized when it had
  to be picked out at 200 m; walked past at 6 m it stopped being a column and
  became a pale fog across the left third of every frame in the chamber. 8 m at
  the base still reads from the far side of a 52 m room and lets the visitor
  see the room while standing next to it.
-->
<T.Mesh position={[beacon.x, beacon.baseY + beacon.height / 2, beacon.z]}>
  <T.CylinderGeometry args={[2.5, 4, beacon.height, 16, 1, true]} />
  <T is={MARK.beacon} />
</T.Mesh>

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
    moveSpeed={WALK_SPEED}
    sprintMultiplier={2.2}
    gravity={MUSEUM_GRAVITY}
    jumpForce={MUSEUM_JUMP_VELOCITY}
  />
{/if}
