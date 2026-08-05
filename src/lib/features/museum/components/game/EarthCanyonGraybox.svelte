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
  /**
   * Dust-grey canyon rock — nothing like Fire's basalt, but kept DARK on
   * purpose. At pale values the rim blew out under its own fill and the tone
   * mapper crushed the pit to black, which killed the overhead read the whole
   * room exists for. The rim is the frame; the pool is the picture.
   */
  const ROCK = "#4a463f";
  const ROCK_LIT = "#5c564c";
  const ROCK_SHADE = "#2e2b26";
  const BOULDER = "#565046";
  const SLAB = "#6b6558";
  /** The one pale surface in the room: what the shaft lands on. */
  const FLOOR_DISC_STONE = "#a49d8d";
  const BOSS_STONE = "#bdb6a4";
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
  /** Open-ended ⌀1 × 1 tube: the daylight shaft's column. */
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
    floorDiscStone: new MeshStandardMaterial({
      color: FLOOR_DISC_STONE,
      roughness: 0.85,
    }),
    bossStone: new MeshStandardMaterial({ color: BOSS_STONE, roughness: 0.8 }),
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
    /**
     * BackSide, and it must stay BackSide. From anywhere OUTSIDE the void's
     * circle the near half of this shell is front-facing and gets culled, which
     * is the only reason you can see down into the pit at all — DoubleSide
     * turns it into an opaque dome over the whole performance. The one place
     * the eye sits INSIDE the circle is the slab apron, and that is handled by
     * cutting the shell's arc there (voidWallArc), not by changing the side.
     */
    voidWall: new MeshStandardMaterial({
      color: ROCK_SHADE,
      roughness: 1,
      side: BackSide,
    }),
    // The rings are read from six metres up and eight to ten metres out, so
    // they carry their own light rather than relying on the shaft reaching them.
    bossRing: new MeshStandardMaterial({
      color: DAYLIGHT,
      emissive: DAYLIGHT,
      emissiveIntensity: 1.1,
      side: DoubleSide,
      toneMapped: false,
    }),
    /**
     * The shaft: a translucent column, BackSide so only its far wall draws.
     * A DoubleSide column paints its near wall over everything beyond it, and
     * over a dark pit even 4.5% white flattens the whole read to fog.
     */
    shaft: new MeshBasicMaterial({
      color: DAYLIGHT,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: BackSide,
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
        // Dark rock washing toward sky, NOT bright sheets. Unlit Basic material
        // at near-white read as walls three metres off the parapet.
        color: ["#3d444c", "#525a64", "#69717c", "#828a95"][i] ?? "#828a95",
        transparent: true,
        opacity: 0.96 - i * 0.13,
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
      material: "floorDiscStone",
    });

    // ══ BOSSES ══ three low drums with a carved concentric target ring, so the
    // beta-to-beta convergence lands on something visible from six metres up.
    bosses.forEach((boss, i) => {
      cylinders.push({
        id: `boss-${i}`,
        pos: [boss.center.x, (FLOOR_DISC_Y + BOSS_Y) / 2, boss.center.z],
        size: [boss.radius * 2, BOSS_Y - FLOOR_DISC_Y, boss.radius * 2],
        material: "bossStone",
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
      // Only the apron has an underside to show; the nose is a tilted fracture
      // plane and boxing under it would put the slab back across the sightline.
      block(
        "slab-underside",
        slabApron,
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
    // Each band is a MASS falling away below its own datum, not a floating
    // panel: a slab with air under it reads as a backdrop flat.
    const CANYON_FOOT = -46.0;
    canyonShelves.forEach((rect, i) => {
      const top = CANYON_SHELF_Y[i]!;
      shelves.push({
        id: `shelf-${i}`,
        pos: [cx(rect), (top + CANYON_FOOT) / 2, cz(rect)],
        size: [sx(rect), top - CANYON_FOOT, sz(rect)],
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
    const shaftDiameter = layout.avenShaftRadius * 2;
    const shaft: Cyl = {
      id: "daylight-shaft",
      // Stops at the rim rather than running down to the bosses: the column is
      // seen from ABOVE, so a translucent wall carried the whole way down put
      // two more washed surfaces between the eye and the performance.
      pos: [void_.center.x, (shaftTop + RIM_Y) / 2, void_.center.z],
      // Radius comes from the layout, which holds it clear of the slab apron.
      // Sizing it to "contain the bosses" put its wall 0.4 m in front of the
      // visitor's eye and greyed out the entire pit — the defect that made this
      // room unreadable. Do not widen it here.
      size: [shaftDiameter, shaftTop - RIM_Y, shaftDiameter],
      material: "shaft",
    };

    // ══ LIGHTS ══ intensities are sized for decay=2 (quadratic falloff): a
    // value that must still read at r metres needs roughly target·r², which is
    // why they look large. The floor disc is the brightest thing in the room
    // and the rim stays dimmer, so the eye is pulled down into the canyon.
    lights.push(
      {
        // The shaft's key, hung INSIDE the void mouth so the roof cannot
        // occlude it and the pool lands on all three bosses. At 6 m it puts
        // ~3.3 on the boss tops — the brightest surface in the room.
        id: "daylight-shaft-key",
        pos: [void_.center.x, BOSS_Y + 6.0, void_.center.z],
        color: DAYLIGHT,
        intensity: 70,
        distance: 30,
        breathe: true,
      },
      {
        // Bounce off the floor disc. At BOSS_Y + 1.4 this was ~13 at the boss
        // top and blew the automatons to white; 3 m up it fills instead.
        id: "floor-disc-bounce",
        pos: [void_.center.x, BOSS_Y + 3.0, void_.center.z],
        color: "#cfd8e6",
        intensity: 12,
        distance: 20,
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
        intensity: 22,
        distance: 20,
        breathe: false,
      },
      {
        // Rim fill: deliberately below the pit's brightness so the eye is
        // pulled down. At 70 the rim out-read the performance. Never black.
        id: "rim-fill",
        pos: [void_.center.x, RIM_Y + 4.5, void_.center.z],
        color: "#a8a396",
        intensity: 16,
        distance: 46,
        breathe: false,
      },
      {
        id: "slab-cue",
        pos: [cx(slabApron), SLAB_Y + 2.2, cz(slabRamp)],
        color: "#cbc4b2",
        intensity: 9,
        distance: 16,
        breathe: false,
      },
      {
        id: "exit-cue",
        pos: [exitRamp.maxX - 1.5, RIM_Y + 2.4, cz(exitRamp)],
        color: "#d6cdb6",
        intensity: 11,
        distance: 18,
        breathe: false,
      }
    );
    // Each boss gets its own soft key so the automaton reads as a FIGURE from
    // the rim, not as a silhouette in the pool. Hung 3.5 m up, so a 1.7 m
    // performer sits at ~2.7 rather than being blown out from close range.
    stations.forEach((station, i) => {
      lights.push({
        id: `boss-key-${i}`,
        pos: [station.x, BOSS_Y + 3.5, station.z],
        color: "#f2f6ff",
        intensity: 10,
        distance: 14,
        breathe: false,
      });
    });
    // Soft green fill down the gully. The bend is a 13 m leg, so one lamp at
    // its centre left both ends black — it gets a cue at each end instead.
    gullyRects.forEach((rect, i) => {
      lights.push({
        id: `gully-fill-${i}`,
        pos: [cx(rect), 1.4, cz(rect)],
        color: GULLY_FILL,
        intensity: 22 + i * 6,
        distance: 16,
        breathe: false,
      });
    });
    lights.push(
      {
        id: "gully-bend-north",
        pos: [cx(gullyBend), 1.1, gullyBend.minZ + 1.6],
        color: GULLY_FILL,
        intensity: 20,
        distance: 14,
        breathe: false,
      },
      {
        id: "gully-bend-south",
        pos: [cx(gullyBend), 1.1, gullyBend.maxZ - 1.6],
        color: GULLY_FILL,
        intensity: 20,
        distance: 14,
        breathe: false,
      },
      {
        // The turn itself, so the corner is legible before you reach it.
        id: "gully-turn-cue",
        pos: [gullyLower.minX + 0.8, 0.6, cz(gullyLower)],
        color: "#b7e39c",
        intensity: 14,
        distance: 12,
        breathe: false,
      },
      {
        // The look back toward Fire's door stays legible rather than black.
        id: "gully-mouth-cue",
        pos: [gullyMouth.minX + 1.0, 1.2, cz(gullyMouth)],
        color: "#9ec98a",
        intensity: 12,
        distance: 12,
        breathe: false,
      },
      {
        // One faint sky bounce over the parapet. The canyon shelves are unlit
        // Basic material, so the old per-shelf point lights lit nothing but the
        // parapet — and blew it out.
        id: "canyon-sky-bounce",
        pos: [void_.center.x, RIM_Y + 3.0, parapet.minZ - 2.0],
        color: "#aeb8c6",
        intensity: 10,
        distance: 24,
        breathe: false,
      }
    );

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

  /**
   * The void's wall, cut on the arc the layout says the slab breaks through.
   * A CLOSED tube here is the bug that blanked the room: the apron hangs inside
   * the circle, so from the one viewpoint the room is designed around, the
   * tube's near inner face filled the whole frame and hid the performance.
   */
  const voidWallGeometry = $derived.by(() => {
    const arc = buildEarthCanyonLayout(grid)?.voidWallArc;
    return new CylinderGeometry(
      0.5,
      0.5,
      1,
      56,
      1,
      true,
      arc?.start ?? 0,
      arc?.length ?? Math.PI * 2
    );
  });
  let previousVoidWall: CylinderGeometry | null = null;
  $effect(() => {
    const current = voidWallGeometry;
    const stale = previousVoidWall;
    previousVoidWall = current;
    return () => {
      if (stale && stale !== current) stale.dispose();
    };
  });
  onDestroy(() => previousVoidWall?.dispose());

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
  <T.Group
    {visible}
    oncreate={(ref) => {
      // Dev-only handle: lets a browser session toggle individual meshes to find
      // what is occluding what, instead of guessing from screenshots.
      if (import.meta.env.DEV) (window as any).__earthGraybox = ref;
    }}
  >
    <!-- Floors, ramps, rock, walls, ceilings, parapet boulders, the slab -->
    {#each scene.boxes as box (box.id)}
      <T.Mesh
        name={box.id}
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
        name={cyl.id}
        geometry={cyl.id === "void-wall" ? voidWallGeometry : unitCylinder}
        material={materials[cyl.material]}
        position={cyl.pos}
        scale={cyl.size}
        receiveShadow
      />
    {/each}

    <!-- Carved concentric target rings on the boss tops -->
    {#each scene.rings as ring (ring.id)}
      <T.Mesh
        name={ring.id}
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
        name={shelf.id}
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
        name="daylight-shaft"
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
