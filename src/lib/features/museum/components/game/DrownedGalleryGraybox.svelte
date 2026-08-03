<script lang="ts">
  /**
   * TEMPORARY Phase-1 graybox for the Drowned Gallery (Water room).
   * Replaced by the authored GLB shell in Phase 2 — delete this component
   * and its Museum3DScene mount when roomPresentation.modelPath lands.
   * Geometry derives entirely from buildDrownedGalleryLayout(grid); do not
   * hardcode world coordinates here.
   */
  import { T } from "@threlte/core";
  import {
    AdditiveBlending,
    BackSide,
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    PointsMaterial,
  } from "three";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import {
    buildDrownedGalleryLayout,
    type WorldRect,
    WATERLINE_Y,
    SUMP_FLOOR_Y,
    SUMP_CEILING_Y,
    CAUSEWAY_Y,
    SHELF_Y,
    POOL_BOTTOM_Y,
    DOME_APEX_Y,
    CORRIDOR_SURFACING_Y,
  } from "../../data/drowned-gallery-terrain";

  interface Props {
    grid: MuseumGrid;
  }
  const { grid }: Props = $props();
  const layout = buildDrownedGalleryLayout(grid);

  const ROCK = "#2b2620";
  const FLOOR_WET = "#4a3d2d";
  const STONE_WALK = "#7c6647";
  const WATER = "#0d3a52";
  const GLOW = "#9fe8ff";
  const FIRELIGHT = "#ffb35c";
  const GATE_GOLD = "#d9a441";

  /** Slab thickness for every floor/ramp box. */
  const FLOOR_T = 0.3;
  /** Wall thickness for the room envelope. */
  const WALL_T = 0.6;
  /** Width of the door gaps left in the graybox walls. */
  const DOOR_GAP = 3;

  interface Box {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    rot: [number, number, number];
    color: string;
  }

  const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
  const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
  const sx = (r: WorldRect) => r.maxX - r.minX;
  const sz = (r: WorldRect) => r.maxZ - r.minZ;

  /** Flat slab whose TOP surface sits at `topY`. */
  function slab(id: string, r: WorldRect, topY: number, color: string): Box {
    return {
      id,
      pos: [cx(r), topY - FLOOR_T / 2, cz(r)],
      size: [sx(r), FLOOR_T, sz(r)],
      rot: [0, 0, 0],
      color,
    };
  }

  /** Ramp tilted along z: `yAtMinZ` at the rect's north edge, `yAtMaxZ` south. */
  function rampZ(
    id: string,
    r: WorldRect,
    yAtMinZ: number,
    yAtMaxZ: number,
    color: string
  ): Box {
    const run = sz(r);
    const dy = yAtMaxZ - yAtMinZ;
    const angle = -Math.atan2(dy, run);
    return {
      id,
      pos: [
        cx(r),
        (yAtMinZ + yAtMaxZ) / 2 - FLOOR_T / 2 / Math.cos(angle),
        cz(r),
      ],
      size: [sx(r), FLOOR_T, Math.hypot(run, dy)],
      rot: [angle, 0, 0],
      color,
    };
  }

  /** Ramp tilted along x: `yAtMinX` at the rect's west edge, `yAtMaxX` east. */
  function rampX(
    id: string,
    r: WorldRect,
    yAtMinX: number,
    yAtMaxX: number,
    color: string
  ): Box {
    const run = sx(r);
    const dy = yAtMaxX - yAtMinX;
    const angle = Math.atan2(dy, run);
    return {
      id,
      pos: [
        cx(r),
        (yAtMinX + yAtMaxX) / 2 - FLOOR_T / 2 / Math.cos(angle),
        cz(r),
      ],
      size: [Math.hypot(run, dy), FLOOR_T, sz(r)],
      rot: [0, 0, angle],
      color,
    };
  }

  /** Upright slab spanning `baseY`..`topY` over a rect footprint. */
  function wall(
    id: string,
    r: WorldRect,
    baseY: number,
    topY: number,
    color = ROCK
  ): Box {
    return {
      id,
      pos: [cx(r), (baseY + topY) / 2, cz(r)],
      size: [Math.max(sx(r), 0.01), topY - baseY, Math.max(sz(r), 0.01)],
      rot: [0, 0, 0],
      color,
    };
  }

  /** Split `min`..`max` around the excluded spans, returning the remainder. */
  function spansExcluding(
    min: number,
    max: number,
    holes: [number, number][]
  ): [number, number][] {
    const sorted = [...holes].sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    let cursor = min;
    for (const [h0, h1] of sorted) {
      if (h0 > cursor) out.push([cursor, Math.min(h0, max)]);
      cursor = Math.max(cursor, h1);
    }
    if (cursor < max) out.push([cursor, max]);
    return out.filter(([a, b]) => b - a > 0.01);
  }

  // ── Derived geometry ──────────────────────────────────────────────────────

  const floors: Box[] = [];
  const walls: Box[] = [];
  const ceilings: Box[] = [];
  const waterSurfaces: { id: string; rect: WorldRect }[] = [];
  const waterVolumes: Box[] = [];
  const habitat: Box[] = [];
  const gateBars: Box[] = [];
  const balustrade: Box[] = [];
  const pictographDiscs: { id: string; pos: [number, number, number] }[] = [];
  const lights: {
    id: string;
    pos: [number, number, number];
    color: string;
    intensity: number;
    distance: number;
  }[] = [];
  const glowwormGeometry = new BufferGeometry();
  const glowwormMaterial = new PointsMaterial({
    color: GLOW,
    size: 0.07,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  let waterfall: Box | null = null;

  if (layout) {
    const { approach, sump, grotto, pool, shore, overlooks, gate, alcoves } =
      layout;

    // Corridor stubs between the three rooms (north is decreasing z). The
    // sump↔grotto corridor and the surfacing steps come straight off the
    // layout — the same rects the terrain program's elevation zones use — so
    // the visible floor can never disagree with where physics puts the player
    // (the corridor jogs ~11 m west between the two doors; see
    // buildDrownedGalleryLayout).
    const corridorAS: WorldRect = {
      minX: sump.minX - 1,
      minZ: sump.maxZ,
      maxX: sump.maxX + 1,
      maxZ: approach.minZ,
    };
    const corridorSG = layout.corridorSG;
    const surfacing = layout.surfacingSteps;
    const sumpSouthRamp: WorldRect = { ...sump, minZ: sump.maxZ - 4 };
    const sumpNorthRamp: WorldRect = { ...sump, maxZ: sump.minZ + 3 };
    const sumpFlat: WorldRect = {
      ...sump,
      minZ: sump.minZ + 3,
      maxZ: sump.maxZ - 4,
    };
    const exitRamp: WorldRect = {
      minX: grotto.maxX - 2,
      minZ: grotto.maxZ - 6,
      maxX: grotto.maxX,
      maxZ: grotto.maxZ,
    };

    // ══ FLOORS ══
    floors.push(
      rampZ("approach", approach, WATERLINE_Y, 0, FLOOR_WET),
      slab("corridor-approach-sump", corridorAS, WATERLINE_Y, FLOOR_WET),
      rampZ("sump-south", sumpSouthRamp, SUMP_FLOOR_Y, WATERLINE_Y, FLOOR_WET),
      slab("sump-floor", sumpFlat, SUMP_FLOOR_Y, FLOOR_WET),
      rampZ(
        "sump-north",
        sumpNorthRamp,
        CORRIDOR_SURFACING_Y,
        SUMP_FLOOR_Y,
        FLOOR_WET
      ),
      // The sump↔grotto corridor floor follows the carved Z shape, segment by
      // segment — a bbox slab here would read as an open cavern whose true
      // edges are invisible tile walls.
      ...layout.corridorSegments.map((seg, i) =>
        slab(`corridor-sump-grotto-${i}`, seg, CORRIDOR_SURFACING_Y, FLOOR_WET)
      ),
      rampZ(
        "surfacing-steps",
        surfacing,
        CAUSEWAY_Y,
        CORRIDOR_SURFACING_Y,
        STONE_WALK
      ),
      rampX("exit-ramp", exitRamp, CAUSEWAY_Y, 0, STONE_WALK)
    );

    // Causeway: the walkable ring around the pool, split so it never overlaps
    // the surfacing steps or the exit ramp.
    const causewayPieces: [string, WorldRect][] = [
      [
        "causeway-west",
        {
          minX: grotto.minX,
          minZ: pool.minZ,
          maxX: pool.minX,
          maxZ: surfacing.minZ,
        },
      ],
      [
        "causeway-sw",
        {
          minX: pool.minX,
          minZ: pool.maxZ,
          maxX: surfacing.maxX,
          maxZ: surfacing.minZ,
        },
      ],
      [
        "causeway-south",
        {
          minX: surfacing.maxX,
          minZ: pool.maxZ,
          maxX: pool.maxX,
          maxZ: grotto.maxZ,
        },
      ],
      [
        // South-west floor west of the (relocated) surfacing steps
        "causeway-s-far-west",
        {
          minX: grotto.minX,
          minZ: surfacing.minZ,
          maxX: surfacing.minX,
          maxZ: grotto.maxZ,
        },
      ],
      [
        "causeway-east-inner",
        {
          minX: pool.maxX,
          minZ: pool.minZ,
          maxX: exitRamp.minX,
          maxZ: grotto.maxZ,
        },
      ],
      [
        "causeway-east-outer",
        {
          minX: exitRamp.minX,
          minZ: pool.minZ,
          maxX: grotto.maxX,
          maxZ: exitRamp.minZ,
        },
      ],
    ];
    for (const [id, rect] of causewayPieces) {
      // With the surfacing steps at the grotto's west-biased door, some
      // pieces collapse to zero footprint — skip them rather than render
      // degenerate slabs.
      if (sx(rect) > 0.01 && sz(rect) > 0.01) {
        floors.push(slab(id, rect, CAUSEWAY_Y, STONE_WALK));
      }
    }
    overlooks.forEach((o, i) => {
      floors.push(slab(`overlook-${i}`, o, CAUSEWAY_Y, STONE_WALK));
    });

    // Pool basin: bottom slab plus four side walls up to the causeway.
    floors.push(slab("pool-bottom", pool, POOL_BOTTOM_Y, FLOOR_WET));
    const basinSides: [string, WorldRect][] = [
      ["basin-west", { ...pool, maxX: pool.minX + 0.2 }],
      ["basin-east", { ...pool, minX: pool.maxX - 0.2 }],
      ["basin-north", { ...pool, maxZ: pool.minZ + 0.2 }],
      ["basin-south", { ...pool, minZ: pool.maxZ - 0.2 }],
    ];
    for (const [id, rect] of basinSides) {
      walls.push(wall(id, rect, POOL_BOTTOM_Y, CAUSEWAY_Y, FLOOR_WET));
    }

    // ══ WALLS ══
    const grottoBase = POOL_BOTTOM_Y - 0.5;
    const exitGapZ = cz(exitRamp);
    // The gap in the grotto's south wall must sit over the REAL door (the
    // grotto's own west-biased span, where the surfacing steps are) — not the
    // corridor rect's center, which averages in the sump-side end of the jog.
    const sumpGapX = cx(surfacing);
    walls.push(
      wall(
        "grotto-north",
        {
          minX: grotto.minX - WALL_T,
          minZ: grotto.minZ - WALL_T,
          maxX: grotto.maxX + WALL_T,
          maxZ: grotto.minZ,
        },
        grottoBase,
        DOME_APEX_Y
      ),
      wall(
        "grotto-west",
        {
          minX: grotto.minX - WALL_T,
          minZ: grotto.minZ,
          maxX: grotto.minX,
          maxZ: grotto.maxZ,
        },
        grottoBase,
        DOME_APEX_Y
      )
    );
    for (const [z0, z1] of spansExcluding(grotto.minZ, grotto.maxZ, [
      [exitGapZ - DOOR_GAP / 2, exitGapZ + DOOR_GAP / 2],
    ])) {
      walls.push(
        wall(
          `grotto-east-${z0.toFixed(2)}`,
          { minX: grotto.maxX, minZ: z0, maxX: grotto.maxX + WALL_T, maxZ: z1 },
          grottoBase,
          DOME_APEX_Y
        )
      );
    }
    for (const [x0, x1] of spansExcluding(
      grotto.minX - WALL_T,
      grotto.maxX + WALL_T,
      [[sumpGapX - DOOR_GAP / 2, sumpGapX + DOOR_GAP / 2]]
    )) {
      walls.push(
        wall(
          `grotto-south-${x0.toFixed(2)}`,
          { minX: x0, minZ: grotto.maxZ, maxX: x1, maxZ: grotto.maxZ + WALL_T },
          grottoBase,
          DOME_APEX_Y
        )
      );
    }

    // The approach/sump chain shares one pair of side walls from the grotto's
    // south face to the approach's south door.
    const chainBase = SUMP_FLOOR_Y - 0.5;
    const chainTop = 2.8;
    walls.push(
      wall(
        "chain-west",
        {
          minX: corridorAS.minX - WALL_T,
          minZ: corridorSG.maxZ,
          maxX: corridorAS.minX,
          maxZ: approach.maxZ,
        },
        chainBase,
        chainTop
      ),
      wall(
        "chain-east",
        {
          minX: corridorAS.maxX,
          minZ: grotto.maxZ,
          maxX: corridorAS.maxX + WALL_T,
          maxZ: approach.maxZ,
        },
        chainBase,
        chainTop
      )
    );
    // The sump↔grotto corridor's enclosure renders its REAL carved wall
    // tiles (row-run merged), so the visible passage matches the walkable
    // one exactly — including the ~11 m westward jog.
    layout.corridorWallRuns.forEach((run, i) => {
      walls.push(wall(`corridor-sg-wall-${i}`, run, chainBase, chainTop));
    });

    // ══ CEILINGS ══
    ceilings.push(
      slab("sump-ceiling", sumpFlat, SUMP_CEILING_Y + FLOOR_T, ROCK),
      slab("grotto-dome", grotto, DOME_APEX_Y + FLOOR_T, ROCK)
    );

    // ══ WATER ══
    layout.waterPlanes.forEach((rect, i) => {
      waterSurfaces.push({ id: `water-${i}`, rect });
    });
    waterVolumes.push(
      wall("water-vol-pool", pool, POOL_BOTTOM_Y, WATERLINE_Y, WATER),
      wall(
        "water-vol-sump",
        {
          minX: sump.minX,
          minZ: sump.minZ,
          maxX: sump.maxX,
          maxZ: approach.minZ,
        },
        SUMP_FLOOR_Y,
        WATERLINE_Y,
        WATER
      ),
      // The corridor jog is fully submerged too; volumes follow the carved
      // segments so the water body ends where the passage does.
      ...layout.corridorSegments.map((seg, i) =>
        wall(`water-vol-corridor-${i}`, seg, CORRIDOR_SURFACING_Y, WATERLINE_Y, WATER)
      )
    );

    // ══ HABITAT ══ shelves, back walls, rock fins, alcove lights.
    const SHELF_W = 4;
    const SHELF_D = 3;
    alcoves.forEach((a, i) => {
      habitat.push(
        {
          id: `shelf-${i}`,
          pos: [a.x, SHELF_Y - 0.2, a.z],
          size: [SHELF_W, 0.4, SHELF_D],
          rot: [0, 0, 0],
          color: STONE_WALK,
        },
        {
          id: `alcove-back-${i}`,
          pos: [a.x, SHELF_Y + 1.4, shore.minZ + 0.3],
          size: [SHELF_W + 0.4, 3.2, 0.6],
          rot: [0, 0, 0],
          color: ROCK,
        }
      );
      lights.push({
        id: `alcove-light-${i}`,
        pos: [a.x, SHELF_Y + 1.8, a.z],
        color: FIRELIGHT,
        intensity: 3.6,
        distance: 10,
      });
      pictographDiscs.push({
        id: `alcove-glyph-${i}`,
        pos: [a.x, SHELF_Y + 1.6, shore.minZ + 0.62],
      });
    });
    for (let i = 0; i < alcoves.length - 1; i++) {
      const finX = (alcoves[i].x + alcoves[i + 1].x) / 2;
      habitat.push({
        id: `rock-fin-${i}`,
        pos: [finX, SHELF_Y + 1, shore.minZ + 1.6],
        size: [0.9, 3.2, 3.2],
        rot: [0, 0, 0],
        color: ROCK,
      });
    }

    // ══ GATE ══ six bars plus a crossbar across the east walkway.
    const BAR = 0.08;
    const GATE_H = 1.6;
    const gateZ = cz(gate);
    const barCount = 6;
    for (let i = 0; i < barCount; i++) {
      const t = (i + 0.5) / barCount;
      gateBars.push({
        id: `gate-bar-${i}`,
        pos: [gate.minX + sx(gate) * t, CAUSEWAY_Y + GATE_H / 2, gateZ],
        size: [BAR, GATE_H, BAR],
        rot: [0, 0, 0],
        color: GATE_GOLD,
      });
    }
    gateBars.push({
      id: "gate-crossbar",
      pos: [cx(gate), CAUSEWAY_Y + GATE_H, gateZ],
      size: [sx(gate), BAR, BAR],
      rot: [0, 0, 0],
      color: GATE_GOLD,
    });

    // ══ WATERFALL PLACEHOLDER ══ emissive column at the pool's north-west
    // corner, with a cool key light over the plunge point.
    waterfall = {
      id: "waterfall",
      pos: [
        pool.minX + 0.8,
        (DOME_APEX_Y + WATERLINE_Y) / 2,
        pool.minZ + 0.25,
      ],
      size: [1.6, DOME_APEX_Y - WATERLINE_Y, 0.5],
      rot: [0, 0, 0],
      color: "#dff2ff",
    };
    lights.push({
      id: "waterfall-light",
      pos: [pool.minX + 0.8, WATERLINE_Y + 3, pool.minZ + 0.8],
      color: "#bfe9ff",
      intensity: 3,
      distance: 14,
    });

    // ══ BALUSTRADE ══ along the causeway's pool edge, skipping the overlooks.
    const BAL_H = 0.5;
    for (const [x0, x1] of spansExcluding(
      pool.minX,
      pool.maxX,
      overlooks.map((o) => [o.minX, o.maxX] as [number, number])
    )) {
      balustrade.push({
        id: `balustrade-${x0.toFixed(2)}`,
        pos: [(x0 + x1) / 2, CAUSEWAY_Y + BAL_H / 2, pool.maxZ + 0.125],
        size: [x1 - x0, BAL_H, 0.25],
        rot: [0, 0, 0],
        color: STONE_WALK,
      });
    }

    // ══ GLOWWORMS ══ ~250 points on the dome underside.
    const worms: number[] = [];
    for (let i = 0; i < 250; i++) {
      worms.push(
        grotto.minX + Math.random() * sx(grotto),
        DOME_APEX_Y - 0.2 - Math.random() * 1.4,
        grotto.minZ + Math.random() * sz(grotto)
      );
    }
    glowwormGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(worms, 3)
    );

    // ══ FILL LIGHTS ══
    lights.push(
      {
        id: "pool-fill",
        pos: [cx(pool), 5, cz(pool)],
        color: "#7fd8ff",
        intensity: 2.6,
        distance: 30,
      },
      {
        id: "dome-fill",
        pos: [cx(grotto), 8, cz(grotto)],
        color: "#5a7a8a",
        intensity: 1.2,
        distance: 34,
      },
      {
        id: "surfacing-fill",
        pos: [cx(surfacing), CAUSEWAY_Y + 2.4, cz(surfacing)],
        color: FIRELIGHT,
        intensity: 1.1,
        distance: 11,
      },
      {
        // Waterfall glow at the plunge point
        id: "waterfall-glow",
        pos: [pool.minX + 1.2, WATERLINE_Y + 1.2, pool.minZ + 1.6],
        color: "#bfe9ff",
        intensity: 2.4,
        distance: 12,
      },
      {
        // Last warm light behind the visitor at the approach mouth
        id: "approach-entry",
        pos: [cx(approach), 2.2, approach.maxZ - 1.5],
        color: "#8a6a4a",
        intensity: 0.9,
        distance: 9,
      },
      {
        // Cool water-glow pulling the visitor down the approach
        id: "approach-waterglow",
        pos: [cx(approach), 0.8, approach.minZ + 1],
        color: "#4a8aa8",
        intensity: 1.4,
        distance: 11,
      },
      {
        // Underwater half-light through the sump
        id: "sump-light-south",
        pos: [cx(sump), -1.2, sump.maxZ - 3],
        color: "#2a7a9a",
        intensity: 1.4,
        distance: 9,
      },
      {
        id: "sump-light-north",
        pos: [cx(sump), -1.2, sump.minZ + 3],
        color: "#2a7a9a",
        intensity: 1.4,
        distance: 9,
      }
    );
  }

  const structural = [...floors, ...walls, ...ceilings, ...habitat, ...balustrade];
</script>

{#if layout}
  <!-- Floors, ramps, basin, walls, ceilings, shelves, balustrade -->
  {#each structural as box (box.id)}
    <T.Mesh position={box.pos} rotation={box.rot} castShadow receiveShadow>
      <T.BoxGeometry args={box.size} />
      <T.MeshStandardMaterial color={box.color} roughness={1} />
    </T.Mesh>
  {/each}

  <!-- Water surfaces at the waterline -->
  {#each waterSurfaces as plane (plane.id)}
    <T.Mesh
      position={[
        (plane.rect.minX + plane.rect.maxX) / 2,
        WATERLINE_Y,
        (plane.rect.minZ + plane.rect.maxZ) / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <T.PlaneGeometry
        args={[
          plane.rect.maxX - plane.rect.minX,
          plane.rect.maxZ - plane.rect.minZ,
        ]}
      />
      <T.MeshStandardMaterial
        color={WATER}
        emissive={WATER}
        emissiveIntensity={0.85}
        transparent
        opacity={0.55}
        roughness={0.15}
        side={DoubleSide}
      />
    </T.Mesh>
  {/each}

  <!-- Submerged volume tint (viewed from inside) -->
  {#each waterVolumes as vol (vol.id)}
    <T.Mesh position={vol.pos}>
      <T.BoxGeometry args={vol.size} />
      <T.MeshStandardMaterial
        color={vol.color}
        transparent
        opacity={0.3}
        side={BackSide}
        depthWrite={false}
      />
    </T.Mesh>
  {/each}

  <!-- Barred museum gate at the causeway's dead end -->
  {#each gateBars as bar (bar.id)}
    <T.Mesh position={bar.pos}>
      <T.BoxGeometry args={bar.size} />
      <T.MeshStandardMaterial
        color={bar.color}
        roughness={0.4}
        metalness={0.6}
        emissive={bar.color}
        emissiveIntensity={0.3}
      />
    </T.Mesh>
  {/each}

  <!-- Waterfall placeholder -->
  {#if waterfall}
    <T.Mesh position={waterfall.pos}>
      <T.BoxGeometry args={waterfall.size} />
      <T.MeshStandardMaterial
        color={waterfall.color}
        emissive={waterfall.color}
        emissiveIntensity={0.6}
        transparent
        opacity={0.8}
      />
    </T.Mesh>
  {/if}

  <!-- Cave-art pictograph placeholders behind each performer -->
  {#each pictographDiscs as disc (disc.id)}
    <T.Mesh position={disc.pos}>
      <T.CircleGeometry args={[0.6, 32]} />
      <T.MeshStandardMaterial
        color={GLOW}
        emissive={GLOW}
        emissiveIntensity={0.9}
        side={DoubleSide}
      />
    </T.Mesh>
  {/each}

  <!-- Glowworm dome -->
  <T.Points geometry={glowwormGeometry} material={glowwormMaterial} />

  <!-- Fill + accent lights -->
  {#each lights as light (light.id)}
    <T.PointLight
      position={light.pos}
      color={light.color}
      intensity={light.intensity}
      distance={light.distance}
      decay={2}
      castShadow={false}
    />
  {/each}
{/if}
