<script lang="ts">
  /**
   * Graybox shell for the Earth Room (the Canyon Overlook) — the Vulcan Cave
   * earth bay.
   *
   * Replaced by an authored GLB shell later; delete this component and its
   * Museum3DScene mount when roomPresentation.modelPath lands.
   *
   * EVERY rect, ramp, disc, anchor and light position below comes off
   * buildEarthCanyonLayout(grid). There is not one world coordinate in this
   * file. The circles here are the SAME Disc records blockedAt reads, so the
   * drop you see is exactly the drop you cannot walk into.
   *
   * This is the wing's first daylit room, and it must not read as Fire's
   * basalt: the gully is green, the rock is pale dust-grey, and the dominant
   * source is a cool-white shaft falling through the aven onto the bosses.
   */
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BoxGeometry,
    ConeGeometry,
    CylinderGeometry,
    MeshBasicMaterial,
    MeshStandardMaterial,
    RingGeometry,
    SphereGeometry,
    TorusGeometry,
    BackSide,
    DoubleSide,
  } from "three";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import {
    buildEarthCanyonLayout,
    type EarthCanyonLayout,
    AVEN_RADIUS,
    BOSS_RADIUS,
    BOSS_Y,
    CANYON_SHELF_Y,
    EARTH_CEILING_Y,
    EARTH_ROOM_ID,
    FIRE_ROOM_ID,
    FLOOR_DISC_Y,
    PARAPET_HEIGHT,
    RIM_Y,
    SLAB_LIP_HEIGHT,
    SLAB_Y,
    VOID_RADIUS,
  } from "../../data/earth-canyon-layout";
  import type { WorldRect } from "../../data/drowned-gallery-terrain";

  interface Props {
    grid: MuseumGrid;
    /** Room the player is standing in; lights idle when they are elsewhere. */
    currentRoomId?: string | null;
    visible?: boolean;
  }
  const { grid, currentRoomId = null, visible = true }: Props = $props();

  // ── Palette ───────────────────────────────────────────────────────────────
  /** Pale dust-grey canyon rock — deliberately nothing like Fire's basalt. */
  const ROCK = "#6f6a60";
  const ROCK_LIT = "#8d867a";
  const ROCK_SHADE = "#4a463f";
  const BOULDER = "#7c766a";
  const SLAB = "#9a9184";
  const GRASS = "#4e7a35";
  const GRASS_LIT = "#6f9c47";
  const FLOWER_PURPLE = "#a06fd0";
  const FLOWER_RED = "#d4574f";
  const FLOWER_YELLOW = "#e6c45a";
  const DAYLIGHT = "#eaf2ff";
  const GULLY_FILL = "#7fd06a";
  const TRAIL_COOL = "#dff0ff";
  const TRAIL_WARM = "#ffe6b0";

  /** Slab thickness for every floor, ramp and ceiling box. */
  const SLAB_T = 0.3;
  /** Ring radius standing in for the Phase 3 prop trails. */
  const TRAIL_RADIUS = 0.9;
  /** Trail rings sit at chest height above the boss top. */
  const TRAIL_HEIGHT = 1.2;
  /** Boulders in the parapet run, per 2 m of wall. */
  const BOULDERS_PER_METRE = 0.5;
  /** Grass tufts scattered per square metre of gully floor. */
  const GRASS_PER_SQM = 0.9;
  const FLOWERS_PER_SQM = 0.18;
  const GRASS_HEIGHT = 0.7;

  // ── Shared geometry + materials (disposed on destroy) ─────────────────────
  const unitBox = new BoxGeometry(1, 1, 1);
  /** ⌀1 × 1 cylinder: scale [d, h, d] to place a disc or a boss. */
  const unitCylinder = new CylinderGeometry(0.5, 0.5, 1, 40);
  /** Open-ended ⌀1 × 1 tube, seen from inside: the void's wall. */
  const unitTube = new CylinderGeometry(0.5, 0.5, 1, 56, 1, true);
  const bossRing = new RingGeometry(0.35, 1, 44);
  const grassCone = new ConeGeometry(0.16, 1, 5);
  const flowerDot = new SphereGeometry(0.06, 6, 5);
  const trailGeometry = new TorusGeometry(TRAIL_RADIUS, 0.035, 8, 40);

  const materials = {
    rock: new MeshStandardMaterial({ color: ROCK, roughness: 1 }),
    rockLit: new MeshStandardMaterial({ color: ROCK_LIT, roughness: 1 }),
    rockShade: new MeshStandardMaterial({ color: ROCK_SHADE, roughness: 1 }),
    boulder: new MeshStandardMaterial({ color: BOULDER, roughness: 1 }),
    slab: new MeshStandardMaterial({ color: SLAB, roughness: 0.9 }),
    grass: new MeshStandardMaterial({
      color: GRASS,
      roughness: 1,
      emissive: GRASS,
      emissiveIntensity: 0.12,
    }),
    grassLit: new MeshStandardMaterial({
      color: GRASS_LIT,
      roughness: 1,
      emissive: GRASS_LIT,
      emissiveIntensity: 0.25,
      side: DoubleSide,
    }),
    flowerPurple: new MeshStandardMaterial({
      color: FLOWER_PURPLE,
      emissive: FLOWER_PURPLE,
      emissiveIntensity: 0.9,
      toneMapped: false,
    }),
    flowerRed: new MeshStandardMaterial({
      color: FLOWER_RED,
      emissive: FLOWER_RED,
      emissiveIntensity: 0.9,
      toneMapped: false,
    }),
    flowerYellow: new MeshStandardMaterial({
      color: FLOWER_YELLOW,
      emissive: FLOWER_YELLOW,
      emissiveIntensity: 0.9,
      toneMapped: false,
    }),
    /** Seen from inside: the void's wall must not cull away as you look down. */
    voidWall: new MeshStandardMaterial({
      color: ROCK_SHADE,
      roughness: 1,
      side: BackSide,
    }),
    bossRing: new MeshStandardMaterial({
      color: DAYLIGHT,
      emissive: DAYLIGHT,
      emissiveIntensity: 0.35,
      side: DoubleSide,
      toneMapped: false,
    }),
    /** The shaft itself: a translucent cone of light, cheapest thing that reads. */
    shaft: new MeshBasicMaterial({
      color: DAYLIGHT,
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
    trailCool: new MeshStandardMaterial({
      color: TRAIL_COOL,
      emissive: TRAIL_COOL,
      emissiveIntensity: 1.6,
      toneMapped: false,
    }),
    trailWarm: new MeshStandardMaterial({
      color: TRAIL_WARM,
      emissive: TRAIL_WARM,
      emissiveIntensity: 1.3,
      toneMapped: false,
    }),
  } as const;

  type MaterialKey = keyof typeof materials;

  /**
   * Distance haze on the canyon shelves. Four materials rather than four
   * transparency tweaks on one, so each band can wash further toward the sky
   * colour as it recedes — a shelf that is only "smaller" reads as a flat.
   */
  const shelfMaterials = CANYON_SHELF_Y.map(
    (_, i) =>
      new MeshBasicMaterial({
        color: [ "#7a7d82", "#8c9099", "#9ea3ad", "#b2b7c0" ][i] ?? "#b2b7c0",
        transparent: true,
        opacity: 1 - i * 0.16,
        toneMapped: false,
      })
  );

  onDestroy(() => {
    unitBox.dispose();
    unitCylinder.dispose();
    unitTube.dispose();
    bossRing.dispose();
    grassCone.dispose();
    flowerDot.dispose();
    trailGeometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
    for (const material of shelfMaterials) material.dispose();
  });

  // ── Seeded RNG (boulders and grass never move between reloads) ────────────
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Box helpers ───────────────────────────────────────────────────────────
  interface Box {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    rot: [number, number, number];
    material: MaterialKey;
  }
  interface Cyl {
    id: string;
    pos: [number, number, number];
    /** [diameter, height, diameter] */
    size: [number, number, number];
    material: MaterialKey;
  }
  interface Ring {
    id: string;
    pos: [number, number, number];
    rot: [number, number, number];
    scale: number;
    material: MaterialKey;
  }
  interface Tuft {
    id: string;
    pos: [number, number, number];
    rot: [number, number, number];
    scale: number;
  }
  interface Fleck {
    id: string;
    pos: [number, number, number];
    material: MaterialKey;
  }
  interface Shelf {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    index: number;
  }
  interface Lamp {
    id: string;
    pos: [number, number, number];
    color: string;
    intensity: number;
    distance: number;
    /** The daylight shaft breathes; everything else holds. */
    breathe: boolean;
  }

  const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
  const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
  const sx = (r: WorldRect) => r.maxX - r.minX;
  const sz = (r: WorldRect) => r.maxZ - r.minZ;

  /** Flat slab whose TOP surface sits at `topY`. */
  function slab(
    id: string,
    r: WorldRect,
    topY: number,
    material: MaterialKey,
    thickness = SLAB_T
  ): Box {
    return {
      id,
      pos: [cx(r), topY - thickness / 2, cz(r)],
      size: [sx(r), thickness, sz(r)],
      rot: [0, 0, 0],
      material,
    };
  }

  /** Upright box spanning `baseY`..`topY` over a rect footprint. */
  function block(
    id: string,
    r: WorldRect,
    baseY: number,
    topY: number,
    material: MaterialKey
  ): Box {
    return {
      id,
      pos: [cx(r), (baseY + topY) / 2, cz(r)],
      size: [
        Math.max(sx(r), 0.01),
        Math.max(topY - baseY, 0.01),
        Math.max(sz(r), 0.01),
      ],
      rot: [0, 0, 0],
      material,
    };
  }

  /** Ramp tilted along x: `yAtMinX` at the rect's west edge, `yAtMaxX` east. */
  function rampX(
    id: string,
    r: WorldRect,
    yAtMinX: number,
    yAtMaxX: number,
    material: MaterialKey
  ): Box {
    const run = sx(r);
    const dy = yAtMaxX - yAtMinX;
    const angle = Math.atan2(dy, run);
    return {
      id,
      pos: [cx(r), (yAtMinX + yAtMaxX) / 2 - SLAB_T / 2 / Math.cos(angle), cz(r)],
      size: [Math.hypot(run, dy), SLAB_T, sz(r)],
      rot: [0, 0, angle],
      material,
    };
  }

  /** Ramp tilted along z: `yAtMinZ` at the rect's north edge, `yAtMaxZ` south. */
  function rampZ(
    id: string,
    r: WorldRect,
    yAtMinZ: number,
    yAtMaxZ: number,
    material: MaterialKey
  ): Box {
    const run = sz(r);
    const dy = yAtMaxZ - yAtMinZ;
    const angle = Math.atan2(dy, run);
    return {
      id,
      pos: [cx(r), (yAtMinZ + yAtMaxZ) / 2 - SLAB_T / 2 / Math.cos(angle), cz(r)],
      size: [sx(r), SLAB_T, Math.hypot(run, dy)],
      rot: [-angle, 0, 0],
      material,
    };
  }

  // ── Scene assembly ────────────────────────────────────────────────────────
  interface Scene {
    boxes: Box[];
    cylinders: Cyl[];
    rings: Ring[];
    tufts: Tuft[];
    flecks: Fleck[];
    shelves: Shelf[];
    trails: Ring[];
    lights: Lamp[];
    shaft: Cyl | null;
  }

  function buildScene(layout: EarthCanyonLayout): Scene {
    const boxes: Box[] = [];
    const cylinders: Cyl[] = [];
    const rings: Ring[] = [];
    const tufts: Tuft[] = [];
    const flecks: Fleck[] = [];
    const shelves: Shelf[] = [];
    const trails: Ring[] = [];
    const lights: Lamp[] = [];
    const rng = mulberry32(0x3a17b0d5);

    const {
      gullyMouth,
      gullyBend,
      gullyLower,
      parapet,
      slabApron,
      slabNose,
      slabRamp,
      void_,
      bosses,
      stations,
      exitRamp,
      canyonShelves,
      rockFill,
      floorRects,
      wallRects,
      ceilingRects,
    } = layout;

    const gullyRects = [gullyMouth, gullyBend, gullyLower];
    const gullyIds = new Set(["gully-mouth", "gully-bend", "gully-lower"]);
    const slabIds = new Set(["slab-apron", "slab-nose", "slab-ramp"]);

    // ══ FLOORS ══ one box per layout floor rect, so the visible floor and the
    // walkable floor are the same list. The floor disc and the bosses are
    // circles, so they are skipped here and drawn off their Disc records.
    for (const floor of floorRects) {
      if (floor.id.startsWith("floor-disc") || floor.id.startsWith("boss-")) {
        continue;
      }
      const material: MaterialKey = gullyIds.has(floor.id)
        ? "grass"
        : slabIds.has(floor.id)
          ? "slab"
          : "rockLit";
      if (floor.kind === "ramp-x") {
        boxes.push(rampX(floor.id, floor.rect, floor.fromY, floor.toY, material));
      } else if (floor.kind === "ramp-z") {
        boxes.push(rampZ(floor.id, floor.rect, floor.fromY, floor.toY, material));
      } else {
        boxes.push(slab(floor.id, floor.rect, floor.fromY, material));
      }
    }

    // ══ ROCK ══ every interior tile the programme does not use: the gully's
    // walls and the mass the chamber is carved out of.
    rockFill.forEach((rect, i) => {
      boxes.push(block(`rock-${i}`, rect, FLOOR_DISC_Y - 1.0, EARTH_CEILING_Y, "rock"));
    });

    // ══ WALLS ══ envelope and corridor enclosure, door gaps already derived
    // from real door tiles. There is no north wall here on purpose — the
    // canyon reads as open and the parapet stands in for it.
    for (const wall of wallRects) {
      boxes.push(block(wall.id, wall.rect, wall.baseY, wall.topY, "rock"));
    }

    // ══ CEILINGS ══ the chamber roof, already cut around the aven.
    for (const ceiling of ceilingRects) {
      boxes.push(slab(ceiling.id, ceiling.rect, ceiling.y + SLAB_T, "rockShade"));
    }

    // ══ PARAPET ══ a 0.90 m boulder run just inside the compiled north wall.
    // The height is load-bearing: the sightline cap is 1.07 m, and a reflex
    // 1.1 m guard rail would occlude the performers from the rim.
    boxes.push(block("parapet-run", parapet, RIM_Y, RIM_Y + PARAPET_HEIGHT * 0.72, "boulder"));
    const boulderCount = Math.max(6, Math.round(sx(parapet) * BOULDERS_PER_METRE));
    for (let i = 0; i < boulderCount; i++) {
      const t = (i + 0.5) / boulderCount;
      const width = 1.1 + rng() * 1.3;
      const height = PARAPET_HEIGHT * (0.86 + rng() * 0.14);
      const centreX = parapet.minX + sx(parapet) * t;
      boxes.push({
        id: `boulder-${i}`,
        pos: [centreX, RIM_Y + height / 2, cz(parapet) - rng() * 0.12],
        size: [width, height, sz(parapet) * (0.9 + rng() * 0.5)],
        rot: [0, (rng() - 0.5) * 0.5, 0],
        material: "boulder",
      });
    }

    // ══ THE DROP ══ one open tube off the void's Disc record, so the wall you
    // see and the circle you cannot cross are the same number.
    cylinders.push({
      id: "void-wall",
      pos: [
        void_.center.x,
        (RIM_Y + FLOOR_DISC_Y) / 2,
        void_.center.z,
      ],
      size: [void_.radius * 2, RIM_Y - FLOOR_DISC_Y, void_.radius * 2],
      material: "voidWall",
    });
    cylinders.push({
      id: "floor-disc",
      pos: [void_.center.x, FLOOR_DISC_Y - 0.15, void_.center.z],
      size: [void_.radius * 2, 0.3, void_.radius * 2],
      material: "rockLit",
    });

    // ══ BOSSES ══ three low drums with a carved concentric target ring, so the
    // beta-to-beta convergence lands on something visible from six metres up.
    bosses.forEach((boss, i) => {
      cylinders.push({
        id: `boss-${i}`,
        pos: [boss.center.x, (FLOOR_DISC_Y + BOSS_Y) / 2, boss.center.z],
        size: [boss.radius * 2, BOSS_Y - FLOOR_DISC_Y, boss.radius * 2],
        material: "slab",
      });
      rings.push(
        {
          id: `boss-ring-outer-${i}`,
          pos: [boss.center.x, BOSS_Y + 0.02, boss.center.z],
          rot: [-Math.PI / 2, 0, 0],
          scale: BOSS_RADIUS * 0.92,
          material: "bossRing",
        },
        {
          id: `boss-ring-inner-${i}`,
          pos: [boss.center.x, BOSS_Y + 0.03, boss.center.z],
          rot: [-Math.PI / 2, 0, 0],
          scale: BOSS_RADIUS * 0.5,
          material: "bossRing",
        }
      );
    });

    // ══ SLAB OVERLOOK ══ the fracture line at the viewing apron's outer edge,
    // and the 0.45 m lip that stops the walk without stopping the sightline.
    boxes.push(
      block(
        "slab-underside",
        { ...slabNose, minZ: slabNose.minZ, maxZ: slabApron.maxZ },
        SLAB_Y - 0.9,
        SLAB_Y - SLAB_T,
        "rockShade"
      ),
      {
        id: "slab-lip",
        pos: [cx(slabApron), SLAB_Y + SLAB_LIP_HEIGHT / 2, slabApron.minZ],
        size: [sx(slabApron), SLAB_LIP_HEIGHT, 0.28],
        rot: [0, 0, 0],
        material: "boulder",
      },
      {
        // The fracture: a dark seam exactly on the apron/nose boundary.
        id: "slab-fracture",
        pos: [cx(slabApron), SLAB_Y + 0.01, slabApron.minZ],
        size: [sx(slabApron), 0.06, 0.12],
        rot: [0, 0, 0],
        material: "rockShade",
      }
    );

    // ══ GULLY PLANTING ══ clustered tufts at hip height plus wildflower
    // flecks. Graybox stand-ins for the vegetation kit; the point is that this
    // room reads green from the first frame.
    gullyRects.forEach((rect, r) => {
      const floorY = r === 0 ? -0.35 : r === 1 ? -0.8 : -1.15;
      const count = Math.round(sx(rect) * sz(rect) * GRASS_PER_SQM);
      for (let i = 0; i < count; i++) {
        const scale = 0.75 + rng() * 0.6;
        tufts.push({
          id: `tuft-${r}-${i}`,
          pos: [
            rect.minX + rng() * sx(rect),
            floorY + (GRASS_HEIGHT * scale) / 2,
            rect.minZ + rng() * sz(rect),
          ],
          rot: [(rng() - 0.5) * 0.25, rng() * Math.PI, (rng() - 0.5) * 0.25],
          scale,
        });
      }
      const flowerCount = Math.round(sx(rect) * sz(rect) * FLOWERS_PER_SQM);
      for (let i = 0; i < flowerCount; i++) {
        const which = rng();
        flecks.push({
          id: `flower-${r}-${i}`,
          pos: [
            rect.minX + rng() * sx(rect),
            floorY + 0.35 + rng() * 0.4,
            rect.minZ + rng() * sz(rect),
          ],
          material:
            which < 0.34
              ? "flowerPurple"
              : which < 0.67
                ? "flowerRed"
                : "flowerYellow",
        });
      }
    });

    // ══ CANYON ══ four blocked bands receding north, each hazier than the one
    // in front of it. Depth here is a set-dressing claim, so it is made with
    // wash rather than with detail.
    canyonShelves.forEach((rect, i) => {
      shelves.push({
        id: `shelf-${i}`,
        pos: [cx(rect), CANYON_SHELF_Y[i]! + 2.0, cz(rect)],
        size: [sx(rect), 4.0 + i * 2.0, sz(rect)],
        index: i,
      });
    });

    // ══ TRAIL PLACEHOLDERS ══ two tilted emissive rings per boss.
    stations.forEach((station, i) => {
      trails.push(
        {
          id: `trail-cool-${i}`,
          pos: [station.x, BOSS_Y + TRAIL_HEIGHT, station.z],
          rot: [Math.PI / 2, 0, (25 * Math.PI) / 180],
          scale: 1,
          material: "trailCool",
        },
        {
          id: `trail-warm-${i}`,
          pos: [station.x, BOSS_Y + TRAIL_HEIGHT, station.z],
          rot: [Math.PI / 2, 0, (-25 * Math.PI) / 180],
          scale: 1,
          material: "trailWarm",
        }
      );
    });

    // ══ THE SHAFT ══ the money shot: one translucent column from the aven down
    // onto the bosses, sitting on the same centre the aven was cut on.
    const shaftTop = EARTH_CEILING_Y + 1.0;
    const shaft: Cyl = {
      id: "daylight-shaft",
      pos: [void_.center.x, (shaftTop + BOSS_Y) / 2, void_.center.z],
      size: [AVEN_RADIUS * 1.6, shaftTop - BOSS_Y, AVEN_RADIUS * 1.6],
      material: "shaft",
    };

    // ══ LIGHTS ══ intensities are sized for decay=2 (quadratic falloff): a
    // value that must still read at r metres needs roughly target·r², which is
    // why they look large. The floor disc is the brightest thing in the room
    // and the rim stays dimmer, so the eye is pulled down into the canyon.
    lights.push(
      {
        // The shaft's own source, hung low enough that the roof does not
        // occlude it and high enough to spread across all three bosses.
        id: "daylight-shaft-key",
        pos: [void_.center.x, BOSS_Y + 7.5, void_.center.z],
        color: DAYLIGHT,
        intensity: 150,
        distance: 34,
        breathe: true,
      },
      {
        // Bounce off the floor disc, so the bosses are not lit from one point.
        id: "floor-disc-bounce",
        pos: [void_.center.x, BOSS_Y + 1.4, void_.center.z],
        color: "#cfd8e6",
        intensity: 26,
        distance: 22,
        breathe: false,
      },
      {
        // Sky wash down the void's north wall — what makes the drop read.
        id: "void-wall-wash",
        pos: [
          void_.center.x,
          RIM_Y - 1.4,
          void_.center.z - VOID_RADIUS * 0.7,
        ],
        color: "#b9c6d8",
        intensity: 34,
        distance: 22,
        breathe: false,
      },
      {
        // Rim fill: deliberately below the floor's brightness. Never black.
        id: "rim-fill",
        pos: [void_.center.x, RIM_Y + 4.5, void_.center.z],
        color: "#a8a396",
        intensity: 70,
        distance: 46,
        breathe: false,
      },
      {
        id: "slab-cue",
        pos: [cx(slabApron), SLAB_Y + 2.2, cz(slabRamp)],
        color: "#cbc4b2",
        intensity: 14,
        distance: 16,
        breathe: false,
      },
      {
        id: "exit-cue",
        pos: [exitRamp.maxX - 1.5, RIM_Y + 2.4, cz(exitRamp)],
        color: "#d6cdb6",
        intensity: 16,
        distance: 18,
        breathe: false,
      }
    );
    // Soft green fill down the gully, and one dim lamp at the mouth so the
    // look back toward Fire's door stays legible rather than black.
    gullyRects.forEach((rect, i) => {
      lights.push({
        id: `gully-fill-${i}`,
        pos: [cx(rect), -0.4 + 1.8, cz(rect)],
        color: GULLY_FILL,
        intensity: 22 + i * 6,
        distance: 16,
        breathe: false,
      });
    });
    lights.push({
      id: "gully-mouth-cue",
      pos: [gullyMouth.minX + 1.0, 1.2, cz(gullyMouth)],
      color: "#9ec98a",
      intensity: 12,
      distance: 12,
      breathe: false,
    });
    // The canyon lit progressively fainter with distance.
    canyonShelves.forEach((rect, i) => {
      lights.push({
        id: `canyon-glow-${i}`,
        pos: [cx(rect), CANYON_SHELF_Y[i]! + 6.0, cz(rect)],
        color: "#aeb8c6",
        intensity: 120 / (i + 1),
        distance: 30 + i * 10,
        breathe: false,
      });
    });

    return {
      boxes,
      cylinders,
      rings,
      tufts,
      flecks,
      shelves,
      trails,
      lights,
      shaft,
    };
  }

  const layout = $derived(buildEarthCanyonLayout(grid));
  const scene = $derived(layout ? buildScene(layout) : null);

  const EARTH_ROUTE = new Set([EARTH_ROOM_ID, FIRE_ROOM_ID]);
  /** Lights idle to zero when the player is nowhere near the bay. */
  const lit = $derived(
    visible && (currentRoomId === null || EARTH_ROUTE.has(currentRoomId))
  );

  // A very slow breath on the shaft — cloud drifting past the aven, not a
  // flicker. ~0.05 Hz, ±12%.
  const BREATHE_HZ = 0.05;
  const BREATHE_DEPTH = 0.12;
  let breath = $state(1);
  let elapsed = 0;
  useTask((delta) => {
    if (!lit) return;
    elapsed += delta;
    breath = 1 + BREATHE_DEPTH * Math.sin(elapsed * BREATHE_HZ * Math.PI * 2);
  });
</script>

{#if scene}
  <T.Group {visible}>
    <!-- Floors, ramps, rock, walls, ceilings, parapet boulders, the slab -->
    {#each scene.boxes as box (box.id)}
      <T.Mesh
        geometry={unitBox}
        material={materials[box.material]}
        position={box.pos}
        rotation={box.rot}
        scale={box.size}
        castShadow={false}
        receiveShadow
      />
    {/each}

    <!-- The void's wall, the performers' floor disc and the three bosses -->
    {#each scene.cylinders as cyl (cyl.id)}
      <T.Mesh
        geometry={cyl.id === "void-wall" ? unitTube : unitCylinder}
        material={materials[cyl.material]}
        position={cyl.pos}
        scale={cyl.size}
        receiveShadow
      />
    {/each}

    <!-- Carved concentric target rings on the boss tops -->
    {#each scene.rings as ring (ring.id)}
      <T.Mesh
        geometry={bossRing}
        material={materials[ring.material]}
        position={ring.pos}
        rotation={ring.rot}
        scale={ring.scale}
      />
    {/each}

    <!-- Gully grass at hip height -->
    {#each scene.tufts as tuft (tuft.id)}
      <T.Mesh
        geometry={grassCone}
        material={materials.grassLit}
        position={tuft.pos}
        rotation={tuft.rot}
        scale={[tuft.scale, GRASS_HEIGHT * tuft.scale, tuft.scale]}
      />
    {/each}

    <!-- Wildflower colour flecks -->
    {#each scene.flecks as fleck (fleck.id)}
      <T.Mesh
        geometry={flowerDot}
        material={materials[fleck.material]}
        position={fleck.pos}
      />
    {/each}

    <!-- Canyon shelves receding north into haze -->
    {#each scene.shelves as shelf (shelf.id)}
      <T.Mesh
        geometry={unitBox}
        material={shelfMaterials[shelf.index]}
        position={shelf.pos}
        scale={shelf.size}
      />
    {/each}

    <!-- Prop-trail placeholders: two tilted emissive rings per boss -->
    {#each scene.trails as ring (ring.id)}
      <T.Mesh
        geometry={trailGeometry}
        material={materials[ring.material]}
        position={ring.pos}
        rotation={ring.rot}
      />
    {/each}

    <!-- The daylight shaft falling through the aven onto the bosses -->
    {#if scene.shaft}
      <T.Mesh
        geometry={unitTube}
        material={materials.shaft}
        position={scene.shaft.pos}
        scale={scene.shaft.size}
        visible={lit}
      />
    {/if}

    <!-- Light plan: the shaft is the key, the rim stays dimmer than the floor -->
    {#each scene.lights as light (light.id)}
      <T.PointLight
        position={light.pos}
        color={light.color}
        intensity={lit ? light.intensity * (light.breathe ? breath : 1) : 0}
        distance={light.distance}
        decay={2}
        castShadow={false}
      />
    {/each}
  </T.Group>
{/if}
