<script lang="ts">
  /**
   * Graybox shell for The First Fire — the Vulcan Cave fire bay.
   *
   * Replaced by an authored GLB shell later; delete this component and its
   * Museum3DScene mount when roomPresentation.modelPath lands.
   *
   * EVERY rect, stair, anchor and light position below comes off
   * buildFirstFireLayout(grid). There is not one world coordinate in this
   * file — offsets are metres measured from a layout rect, and every doorway
   * is a gap the layout derived from real door tiles. If a shape here
   * disagrees with where physics puts the player, the layout is wrong, not
   * this file.
   */
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BoxGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    PlaneGeometry,
    RingGeometry,
    TorusGeometry,
    DoubleSide,
  } from "three";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import type { AuthoredPointLightPlanChange } from "../../services/museum-room-light-pool";
  import {
    buildFirstFireLayout,
    type FirstFireLayout,
    BRIDGE_Y,
    CAVE_CEILING_Y,
    FIRE_ROOM_ID,
    FISSURE_BED_Y,
    GROTTO_ROOM_ID,
    LAVA_BED_Y,
    SHORE_Y,
    TERRACE_Y,
  } from "../../data/first-fire-layout";
  import type { WorldRect } from "../../data/drowned-gallery-terrain";

  interface Props {
    grid: MuseumGrid;
    /** Room the player is standing in; lights idle when they are elsewhere. */
    currentRoomId?: string | null;
    visible?: boolean;
    onLightPlanChange?: AuthoredPointLightPlanChange;
  }
  const {
    grid,
    currentRoomId = null,
    visible = true,
    onLightPlanChange,
  }: Props = $props();

  const BASALT = "#221d1c";
  const BASALT_LIT = "#3a2f2a";
  const BENCH = "#4a3d39";
  const ASH = "#171514";
  const CHAR = "#0e0c0c";
  const LAVA = "#ff5a1f";
  const LAVA_DEEP = "#c62d05";
  const FIRELIGHT = "#ffb35c";
  const CRACK_COOL = "#5d7fa8";
  const TRAIL_HOT = "#fff3d6";
  const TRAIL_WARM = "#ffb35c";

  /** Slab thickness for every floor, ramp and ceiling box. */
  const SLAB_T = 0.3;
  /** Target riser height for the rendered terrace steps. */
  const RISER = 0.25;
  /** Height of the rock mass over the performers' shore. */
  const SHORE_ROCK_H = 5.0;
  /** Fire-pit ring radius and the prop-trail ring radius. */
  const PIT_RADIUS = 0.9;
  const TRAIL_RADIUS = 0.9;
  /** Trail rings sit at chest height above the station anchor. */
  const TRAIL_HEIGHT = 1.2;

  // ── Shared geometry + materials (disposed on destroy) ─────────────────────
  const unitBox = new BoxGeometry(1, 1, 1);
  const unitPlane = new PlaneGeometry(1, 1);
  const pitRing = new RingGeometry(PIT_RADIUS * 0.55, PIT_RADIUS, 28);
  const ashRing = new RingGeometry(0.1, 1, 40);
  const staveGeometry = new CylinderGeometry(0.045, 0.045, 1.1, 6);
  const trailGeometry = new TorusGeometry(TRAIL_RADIUS, 0.035, 8, 40);

  const materials = {
    rock: new MeshStandardMaterial({ color: BASALT, roughness: 1 }),
    rockLit: new MeshStandardMaterial({ color: BASALT_LIT, roughness: 1 }),
    bench: new MeshStandardMaterial({ color: BENCH, roughness: 0.95 }),
    ash: new MeshStandardMaterial({ color: ASH, roughness: 1 }),
    char: new MeshStandardMaterial({ color: CHAR, roughness: 1 }),
    lava: new MeshStandardMaterial({
      color: LAVA,
      emissive: LAVA,
      emissiveIntensity: 1.4,
      roughness: 0.6,
      side: DoubleSide,
      toneMapped: false,
    }),
    lavaDeep: new MeshStandardMaterial({
      color: LAVA_DEEP,
      emissive: LAVA_DEEP,
      emissiveIntensity: 0.9,
      roughness: 0.8,
      side: DoubleSide,
      toneMapped: false,
    }),
    pit: new MeshStandardMaterial({
      color: FIRELIGHT,
      emissive: FIRELIGHT,
      emissiveIntensity: 1.6,
      side: DoubleSide,
      toneMapped: false,
    }),
    trailHot: new MeshStandardMaterial({
      color: TRAIL_HOT,
      emissive: TRAIL_HOT,
      emissiveIntensity: 1.8,
      toneMapped: false,
    }),
    trailWarm: new MeshStandardMaterial({
      color: TRAIL_WARM,
      emissive: TRAIL_WARM,
      emissiveIntensity: 1.4,
      toneMapped: false,
    }),
  } as const;

  type MaterialKey = keyof typeof materials;

  onDestroy(() => {
    unitBox.dispose();
    unitPlane.dispose();
    pitRing.dispose();
    ashRing.dispose();
    staveGeometry.dispose();
    trailGeometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  });

  // ── Seeded RNG (charred staves never move between reloads) ────────────────
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  interface Box {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    rot: [number, number, number];
    material: MaterialKey;
  }
  interface Plane {
    id: string;
    pos: [number, number, number];
    size: [number, number];
    material: MaterialKey;
  }
  interface Disc {
    id: string;
    pos: [number, number, number];
    scale: number;
  }
  interface Stave {
    id: string;
    pos: [number, number, number];
    rot: [number, number, number];
  }
  interface Ring {
    id: string;
    pos: [number, number, number];
    rot: [number, number, number];
    material: MaterialKey;
  }
  interface Lamp {
    id: string;
    pos: [number, number, number];
    color: string;
    intensity: number;
    distance: number;
    /** Pit lights pulse; support lights hold. */
    pulse: boolean;
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
      pos: [
        cx(r),
        (yAtMinX + yAtMaxX) / 2 - SLAB_T / 2 / Math.cos(angle),
        cz(r),
      ],
      size: [Math.hypot(run, dy), SLAB_T, sz(r)],
      rot: [0, 0, angle],
      material,
    };
  }

  /**
   * Solid riser steps over a z-running ramp. The terrain is still the ramp —
   * these are what the eye reads as the amphitheatre's benches.
   */
  function stairSteps(
    id: string,
    r: WorldRect,
    yAtMinZ: number,
    yAtMaxZ: number,
    baseY: number,
    material: MaterialKey
  ): Box[] {
    const drop = yAtMaxZ - yAtMinZ;
    const count = Math.max(2, Math.round(Math.abs(drop) / RISER));
    const run = sz(r) / count;
    const steps: Box[] = [];
    for (let i = 0; i < count; i++) {
      const minZ = r.minZ + run * i;
      const top = yAtMinZ + (drop * (i + 0.5)) / count;
      steps.push(
        block(
          `${id}-${i}`,
          { minX: r.minX, maxX: r.maxX, minZ, maxZ: minZ + run },
          baseY,
          top,
          material
        )
      );
    }
    return steps;
  }

  // ── Scene assembly ────────────────────────────────────────────────────────
  interface Scene {
    boxes: Box[];
    planes: Plane[];
    pits: Disc[];
    ashRings: Disc[];
    staves: Stave[];
    trails: Ring[];
    lights: Lamp[];
  }

  function buildScene(layout: FirstFireLayout): Scene {
    const boxes: Box[] = [];
    const planes: Plane[] = [];
    const pits: Disc[] = [];
    const ashRings: Disc[] = [];
    const staves: Stave[] = [];
    const trails: Ring[] = [];
    const lights: Lamp[] = [];
    const rng = mulberry32(0x0f19e5a1);

    const {
      fire,
      bridge,
      approachRamp,
      lavaStream,
      crackWest,
      crackBend,
      crackEast,
      terraces,
      terraceRisers,
      ashCircle,
      fissure,
      shore,
      exitStair,
      stations,
      rockFill,
      floorRects,
      wallRects,
      ceilingRects,
    } = layout;

    const riserIds = new Set(terraceRisers.map((_, i) => `terrace-riser-${i}`));
    const benchIds = new Set(terraces.map((_, i) => `terrace-${i}`));

    // ══ FLOORS ══ one box per layout floor rect, so the visible floor and the
    // walkable floor are the same list. Terrace risers render as steps over
    // their ramp; the lava beds render as emissive planes, not slabs.
    for (const floor of floorRects) {
      if (floor.id === "shore") continue; // rendered as the shore rock mass
      if (floor.id === "fissure-bed" || floor.id.startsWith("lava-bed")) {
        continue; // rendered as emissive lava below
      }
      if (riserIds.has(floor.id)) {
        boxes.push(
          ...stairSteps(
            floor.id,
            floor.rect,
            floor.fromY,
            floor.toY,
            FISSURE_BED_Y,
            "bench"
          )
        );
        continue;
      }
      const material: MaterialKey = benchIds.has(floor.id)
        ? "bench"
        : "rockLit";
      if (floor.kind === "ramp-x") {
        boxes.push(
          rampX(floor.id, floor.rect, floor.fromY, floor.toY, material)
        );
      } else {
        boxes.push(slab(floor.id, floor.rect, floor.fromY, material));
      }
    }

    // ══ ROCK ══ every interior tile the programme does not use, plus the
    // mass over the performers' shore and the crack's walls.
    rockFill.forEach((rect, i) => {
      boxes.push(
        block(`rock-${i}`, rect, FISSURE_BED_Y - 0.5, CAVE_CEILING_Y, "rock")
      );
    });
    boxes.push(
      block("shore-base", shore, FISSURE_BED_Y - 0.5, SHORE_Y, "rock"),
      block(
        "shore-backdrop",
        { ...shore, maxZ: shore.minZ + 0.8 },
        SHORE_Y,
        SHORE_Y + SHORE_ROCK_H,
        "rock"
      )
    );

    // ══ WALLS ══ envelope and corridor enclosure, door gaps already derived
    // from real door tiles by the layout.
    for (const wall of wallRects) {
      boxes.push(block(wall.id, wall.rect, wall.baseY, wall.topY, "rock"));
    }

    // ══ CEILINGS ══
    for (const ceiling of ceilingRects) {
      boxes.push(slab(ceiling.id, ceiling.rect, ceiling.y + SLAB_T, "rock"));
    }

    // ══ BRIDGE ══ a basalt span with a visible underside over the stream.
    boxes.push(
      block(
        "bridge-underside",
        bridge,
        BRIDGE_Y - 0.9,
        BRIDGE_Y - SLAB_T,
        "rock"
      )
    );

    // ══ LAVA ══ emissive planes, no textures: the stream under the bridge and
    // the fissure that separates the benches from the shore.
    lavaStream.forEach((rect, i) => {
      planes.push({
        id: `lava-stream-${i}`,
        pos: [cx(rect), LAVA_BED_Y + 0.05, cz(rect)],
        size: [sx(rect), sz(rect)],
        material: "lava",
      });
      boxes.push(
        block(
          `lava-trough-${i}`,
          rect,
          LAVA_BED_Y - 0.6,
          LAVA_BED_Y,
          "lavaDeep"
        )
      );
    });
    planes.push({
      id: "fissure-lava",
      pos: [cx(fissure), FISSURE_BED_Y + 0.05, cz(fissure)],
      size: [sx(fissure), sz(fissure)],
      material: "lava",
    });
    boxes.push(
      block(
        "fissure-trough",
        fissure,
        FISSURE_BED_Y - 0.6,
        FISSURE_BED_Y,
        "lavaDeep"
      )
    );

    // ══ ASH CIRCLE ══ a dark ring on the top terrace with abandoned staves.
    ashRings.push({
      id: "ash-ring",
      pos: [cx(ashCircle), TERRACE_Y[0]! + 0.02, cz(ashCircle)],
      scale: Math.min(sx(ashCircle), sz(ashCircle)) / 2,
    });
    boxes.push(slab("ash-bed", ashCircle, TERRACE_Y[0]! + 0.01, "ash", 0.06));
    for (let i = 0; i < 3; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.min(sx(ashCircle), sz(ashCircle)) * 0.28;
      staves.push({
        id: `char-stave-${i}`,
        pos: [
          cx(ashCircle) + Math.cos(angle) * radius,
          TERRACE_Y[0]! + 0.06,
          cz(ashCircle) + Math.sin(angle) * radius,
        ],
        rot: [Math.PI / 2 - 0.06 + rng() * 0.12, rng() * Math.PI, 0],
      });
    }

    // ══ FIRE PITS + TRAIL PLACEHOLDERS ══ one pit per station, two emissive
    // rings each standing in for the Phase 3 prop trails.
    stations.forEach((station, i) => {
      pits.push({
        id: `pit-${i}`,
        pos: [station.x, SHORE_Y + 0.03, station.z],
        scale: 1,
      });
      trails.push(
        {
          id: `trail-hot-${i}`,
          pos: [station.x, SHORE_Y + TRAIL_HEIGHT, station.z],
          rot: [Math.PI / 2, 0, (25 * Math.PI) / 180],
          material: "trailHot",
        },
        {
          id: `trail-warm-${i}`,
          pos: [station.x, SHORE_Y + TRAIL_HEIGHT, station.z],
          rot: [Math.PI / 2, 0, (-25 * Math.PI) / 180],
          material: "trailWarm",
        }
      );
    });

    // ══ LIGHTS ══ the performance IS the room's light source. Intensities are
    // sized for decay=2 (physically-correct quadratic falloff): a value that
    // must still read at r metres needs roughly (target · r²), which is why
    // these look large. Nothing in this room renders 100% black.
    stations.forEach((station, i) => {
      lights.push({
        id: `pit-light-${i}`,
        // 48 @ +1.6: still throws warm spill to the far terrace (~0.2 at 15 m)
        // without blinding the front bench — 90 @ +1.1 washed the shore wall
        // to full white inside 3 m (seen in the verification frames).
        pos: [station.x, SHORE_Y + 1.6, station.z],
        color: FIRELIGHT,
        intensity: 48,
        distance: 34,
        pulse: true,
      });
    });
    lights.push(
      {
        // under-glow off the lava the bridge crosses — the heat beat
        id: "bridge-underglow",
        // Above deck level — at LAVA_BED_Y + 0.8 the bridge deck occluded its
        // own light and the whole crossing rendered black.
        pos: [cx(bridge), BRIDGE_Y + 1.2, cz(bridge)],
        color: LAVA,
        intensity: 20,
        distance: 18,
        pulse: false,
      },
      {
        id: "lava-north-glow",
        pos: [cx(bridge), BRIDGE_Y + 0.9, lavaStream[0]!.minZ + 2.0],
        color: LAVA,
        intensity: 14,
        distance: 14,
        pulse: false,
      },
      {
        id: "lava-south-glow",
        pos: [cx(bridge), BRIDGE_Y + 0.9, lavaStream[1]!.minZ + 2.0],
        color: LAVA,
        intensity: 14,
        distance: 14,
        pulse: false,
      },
      {
        id: "approach-glow",
        pos: [cx(approachRamp), BRIDGE_Y + 1.4, cz(approachRamp)],
        color: LAVA,
        intensity: 10,
        distance: 12,
        pulse: false,
      },
      {
        // the one cool cue in the crack: enough to read the bend, not the room
        id: "crack-cue",
        pos: [cx(crackBend), BRIDGE_Y + 2.0, cz(crackEast)],
        color: CRACK_COOL,
        intensity: 12,
        distance: 12,
        pulse: false,
      },
      {
        id: "crack-mouth",
        pos: [cx(crackWest), BRIDGE_Y + 1.8, cz(crackWest)],
        color: CRACK_COOL,
        intensity: 9,
        distance: 10,
        pulse: false,
      },
      {
        // faint amphitheatre fill so looking back from the front bench toward
        // the entry is dim but legible — never black (Water's defect)
        id: "amphitheatre-fill",
        pos: [cx(fire), TERRACE_Y[0]! + 6.0, cz(terraces[1]!)],
        color: "#6b4a3a",
        intensity: 40,
        distance: 46,
        pulse: false,
      },
      {
        id: "fissure-glow",
        pos: [cx(fissure), FISSURE_BED_Y + 1.2, cz(fissure)],
        color: LAVA_DEEP,
        intensity: 30,
        distance: 24,
        pulse: false,
      },
      {
        id: "exit-cue",
        pos: [cx(exitStair), TERRACE_Y[0]! + 1.6, cz(exitStair)],
        color: "#8a7a62",
        intensity: 9,
        distance: 14,
        pulse: false,
      }
    );
    // Warm rim along the bench edges, so the terraces read as steps from above.
    terraces.forEach((terrace, i) => {
      lights.push({
        id: `bench-rim-${i}`,
        pos: [cx(terrace), TERRACE_Y[i]! + 1.0, terrace.minZ + 0.4],
        color: FIRELIGHT,
        intensity: 12,
        distance: 20,
        pulse: false,
      });
    });

    return { boxes, planes, pits, ashRings, staves, trails, lights };
  }

  const layout = $derived(buildFirstFireLayout(grid));
  const scene = $derived(layout ? buildScene(layout) : null);

  const FIRE_ROUTE = new Set([FIRE_ROOM_ID, GROTTO_ROOM_ID]);
  /** Lights idle to zero when the player is nowhere near the bay. */
  const lit = $derived(
    visible && currentRoomId !== null && FIRE_ROUTE.has(currentRoomId)
  );

  // Slow sine pulse on the three pit lights — the graybox stand-in for
  // performance-synced flare. ~0.15 Hz, ±30%.
  const PULSE_HZ = 0.15;
  const PULSE_DEPTH = 0.3;
  $effect(() => {
    const currentScene = scene;
    if (!currentScene || !onLightPlanChange) return;
    onLightPlanChange("first-fire", {
      roomIds: [...FIRE_ROUTE],
      lights: currentScene.lights.map((light) => ({
        x: light.pos[0],
        y: light.pos[1],
        z: light.pos[2],
        color: light.color,
        intensity: light.intensity,
        distance: light.distance,
        modulationHz: light.pulse ? PULSE_HZ : undefined,
        modulationDepth: light.pulse ? PULSE_DEPTH : undefined,
      })),
    });
    return () => onLightPlanChange("first-fire", null);
  });
</script>

{#if scene}
  <T.Group {visible}>
    <!-- Floors, ramps, benches, rock, walls, ceilings -->
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

    <!-- Lava surfaces: the stream under the bridge and the fissure -->
    {#each scene.planes as plane (plane.id)}
      <T.Mesh
        geometry={unitPlane}
        material={materials[plane.material]}
        position={plane.pos}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[plane.size[0], plane.size[1], 1]}
      />
    {/each}

    <!-- Fire pit rings under each station -->
    {#each scene.pits as pit (pit.id)}
      <T.Mesh
        geometry={pitRing}
        material={materials.pit}
        position={pit.pos}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={pit.scale}
      />
    {/each}

    <!-- The visitor's side of the fire jam: a cold ash circle -->
    {#each scene.ashRings as ring (ring.id)}
      <T.Mesh
        geometry={ashRing}
        material={materials.char}
        position={ring.pos}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={ring.scale}
      />
    {/each}
    {#each scene.staves as stave (stave.id)}
      <T.Mesh
        geometry={staveGeometry}
        material={materials.char}
        position={stave.pos}
        rotation={stave.rot}
      />
    {/each}

    <!-- Prop-trail placeholders: two tilted emissive rings per station -->
    {#each scene.trails as ring (ring.id)}
      <T.Mesh
        geometry={trailGeometry}
        material={materials[ring.material]}
        position={ring.pos}
        rotation={ring.rot}
      />
    {/each}
  </T.Group>
{/if}
