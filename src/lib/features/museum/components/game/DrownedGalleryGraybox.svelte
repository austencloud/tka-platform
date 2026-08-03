<script lang="ts">
  /**
   * Graybox shell for the Drowned Gallery route — "The Ring" (v2).
   *
   * Replaced by an authored GLB shell later; delete this component and its
   * Museum3DScene mount when roomPresentation.modelPath lands.
   *
   * EVERY rect, stair, anchor and light position below comes off
   * buildDrownedGalleryLayout(grid). There is not one world coordinate in this
   * file — offsets are metres measured from a layout rect, and every doorway is
   * a gap the layout derived from real door tiles. If a shape here disagrees
   * with where physics puts the player, the layout is wrong, not this file.
   */
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BackSide,
    BoxGeometry,
    CircleGeometry,
    ConeGeometry,
    DoubleSide,
    MeshStandardMaterial,
    PlaneGeometry,
    SphereGeometry,
  } from "three";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import {
    buildDrownedGalleryLayout,
    type DrownedGalleryLayout,
    type WorldRect,
    APPROACH_ROOM_ID,
    GALLERY_ROOM_ID,
    GROTTO_ROOM_ID,
    WATERLINE_Y,
    GALLERY_FLOOR_Y,
    GALLERY_ROOF_Y,
    CAUSEWAY_Y,
    SHELF_Y,
    CHANNEL_BED_Y,
    POOL_BOTTOM_Y,
  } from "../../data/drowned-gallery-terrain";

  interface Props {
    grid: MuseumGrid;
    /** Room the player is standing in; lights idle when they are elsewhere. */
    currentRoomId?: string | null;
    visible?: boolean;
  }
  const { grid, currentRoomId = null, visible = true }: Props = $props();

  // ── Palette ───────────────────────────────────────────────────────────────
  const ROCK = "#2b2620";
  const ROCK_WET = "#3a332a";
  const FLOOR_WET = "#4a3d2d";
  const STONE_WALK = "#7c6647";
  const WATER = "#0d3a52";
  const GOLD = "#d9a441";
  const GLYPH = "#c8884a";
  const FIRELIGHT = "#ffb35c";
  const CAVE_GLOW = "#7fe8c8";
  const PALE_BODY = "#cfd8cf";

  /** Slab thickness for every floor, ramp, roof and ceiling box. */
  const SLAB_T = 0.3;
  /** Target riser height for stair steps. */
  const RISER = 0.19;
  const RAIL_H = 0.55;
  /** Height of the alcove shore's rock mass above its shelf. */
  const SHORE_ROCK_H = 5.0;
  const NICHE_W = 3.5;
  const NICHE_H = 3.0;
  const NICHE_DEPTH = 2.5;

  // ── Shared geometry + materials (disposed on destroy) ─────────────────────
  const unitBox = new BoxGeometry(1, 1, 1);
  const unitPlane = new PlaneGeometry(1, 1);
  const glyphGeometry = new CircleGeometry(0.55, 32);
  const plantGeometry = new ConeGeometry(0.16, 0.85, 6);
  const fishGeometry = new SphereGeometry(0.1, 6, 4);

  const materials = {
    rock: new MeshStandardMaterial({ color: ROCK, roughness: 1 }),
    rockWet: new MeshStandardMaterial({ color: ROCK_WET, roughness: 1 }),
    floorWet: new MeshStandardMaterial({ color: FLOOR_WET, roughness: 1 }),
    stone: new MeshStandardMaterial({ color: STONE_WALK, roughness: 0.95 }),
    gold: new MeshStandardMaterial({
      color: GOLD,
      roughness: 0.4,
      metalness: 0.6,
      emissive: GOLD,
      emissiveIntensity: 0.18,
    }),
    glyph: new MeshStandardMaterial({
      color: GLYPH,
      emissive: GLYPH,
      emissiveIntensity: 0.25,
      side: DoubleSide,
    }),
    waterSurface: new MeshStandardMaterial({
      color: WATER,
      emissive: WATER,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      side: DoubleSide,
    }),
    waterVolume: new MeshStandardMaterial({
      color: WATER,
      transparent: true,
      opacity: 0.28,
      side: BackSide,
      depthWrite: false,
    }),
    waterfall: new MeshStandardMaterial({
      color: "#dff2ff",
      emissive: "#dff2ff",
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.75,
    }),
    plant: new MeshStandardMaterial({
      color: "#1d4a3e",
      emissive: CAVE_GLOW,
      emissiveIntensity: 0.25,
      roughness: 0.9,
    }),
    fish: new MeshStandardMaterial({
      color: PALE_BODY,
      emissive: PALE_BODY,
      emissiveIntensity: 0.12,
      roughness: 0.8,
    }),
  } as const;

  type MaterialKey = keyof typeof materials;

  onDestroy(() => {
    unitBox.dispose();
    unitPlane.dispose();
    glyphGeometry.dispose();
    plantGeometry.dispose();
    fishGeometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  });

  // ── Seeded RNG ────────────────────────────────────────────────────────────
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
  interface Plane {
    id: string;
    pos: [number, number, number];
    size: [number, number];
  }
  interface Disc {
    id: string;
    pos: [number, number, number];
  }
  interface Marker {
    id: string;
    pos: [number, number, number];
    scale: number;
  }
  interface Lamp {
    id: string;
    pos: [number, number, number];
    color: string;
    intensity: number;
    distance: number;
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
      size: [Math.max(sx(r), 0.01), Math.max(topY - baseY, 0.01), Math.max(sz(r), 0.01)],
      rot: [0, 0, 0],
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
    const angle = -Math.atan2(dy, run);
    return {
      id,
      pos: [cx(r), (yAtMinZ + yAtMaxZ) / 2 - SLAB_T / 2 / Math.cos(angle), cz(r)],
      size: [sx(r), SLAB_T, Math.hypot(run, dy)],
      rot: [angle, 0, 0],
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

  /**
   * Solid riser steps over a z-running ramp. The terrain is still the ramp —
   * these are what the eye reads as a stair, sized so no riser is taller than
   * the walker can plausibly climb.
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
    waterPlanes: Plane[];
    waterVolumes: Box[];
    glyphs: Disc[];
    plants: Marker[];
    fish: Marker[];
    lights: Lamp[];
  }

  function buildScene(layout: DrownedGalleryLayout): Scene {
    const boxes: Box[] = [];
    const waterPlanes: Plane[] = [];
    const waterVolumes: Box[] = [];
    const glyphs: Disc[] = [];
    const plants: Marker[] = [];
    const fish: Marker[] = [];
    const lights: Lamp[] = [];
    const rng = mulberry32(0x0d20ac03);

    const {
      approach,
      descentRoofed,
      westRun,
      northRun,
      eastBend,
      surfacingUpper,
      surfacingLower,
      shore,
      channel,
      pool,
      apron,
      waterfall,
      threshold,
      thresholdJambs,
      thresholdOpening,
      alcoves,
      balustrades,
      bloomAnchor,
      floorRects,
      wallRects,
      ceilingRects,
      roofRects,
    } = layout;

    const stairIds = new Set([
      "descent-stair",
      "surfacing-upper",
      "surfacing-lower",
    ]);

    // ══ FLOORS ══ one box per layout floor rect, so the visible floor and the
    // walkable floor are the same list. The two stairs render as riser steps
    // over their ramp; the landing between them keeps a plain slab, so the
    // surface break lands on a plainly different surface.
    for (const floor of floorRects) {
      if (floor.id === "shore-shelf") continue; // rendered as the shore mass
      if (floor.id === "pool-bottom" || floor.id === "channel-bed") {
        boxes.push(slab(floor.id, floor.rect, floor.fromY, "rockWet"));
        continue;
      }
      if (stairIds.has(floor.id)) {
        boxes.push(
          ...stairSteps(
            floor.id,
            floor.rect,
            floor.fromY,
            floor.toY,
            Math.min(floor.fromY, floor.toY) - 0.8,
            "stone"
          )
        );
        continue;
      }
      const material: MaterialKey =
        Math.min(floor.fromY, floor.toY) < WATERLINE_Y ? "floorWet" : "stone";
      if (floor.kind === "ramp-z") {
        boxes.push(rampZ(floor.id, floor.rect, floor.fromY, floor.toY, material));
      } else if (floor.kind === "ramp-x") {
        boxes.push(rampX(floor.id, floor.rect, floor.fromY, floor.toY, material));
      } else {
        boxes.push(
          slab(
            floor.id,
            floor.rect,
            floor.fromY,
            floor.id === "surfacing-landing" ? "stone" : material
          )
        );
      }
    }

    // ══ GALLERY ROCK ══ every interior tile that is not path, plus the roof
    // over every path tile deep enough to carry it.
    layout.rockFill.forEach((rect, i) => {
      boxes.push(block(`rock-${i}`, rect, POOL_BOTTOM_Y, GALLERY_ROOF_Y, "rock"));
    });
    roofRects.forEach((rect, i) => {
      boxes.push(slab(`roof-${i}`, rect, GALLERY_ROOF_Y + SLAB_T, "rock"));
    });

    // ══ WALLS ══ envelopes, corridor enclosures and shaft collars, all with
    // their door gaps already derived from real door tiles by the layout.
    for (const wall of wallRects) {
      boxes.push(block(wall.id, wall.rect, wall.baseY, wall.topY, "rock"));
    }

    // ══ CEILINGS ══
    for (const ceiling of ceilingRects) {
      boxes.push(slab(ceiling.id, ceiling.rect, ceiling.y + SLAB_T, "rock"));
    }

    // ══ POOL + CHANNEL BASINS ══
    const basin = (id: string, rect: WorldRect, bedY: number, skipNorth: boolean) => {
      const T = 0.25;
      const sides: [string, WorldRect][] = [
        [`${id}-west`, { ...rect, maxX: rect.minX + T }],
        [`${id}-east`, { ...rect, minX: rect.maxX - T }],
        [`${id}-south`, { ...rect, minZ: rect.maxZ - T }],
      ];
      if (!skipNorth) sides.push([`${id}-north`, { ...rect, maxZ: rect.minZ + T }]);
      for (const [sideId, sideRect] of sides) {
        boxes.push(block(sideId, sideRect, bedY, CAUSEWAY_Y, "rockWet"));
      }
    };
    basin("pool-basin", pool, POOL_BOTTOM_Y, false);
    basin("channel-basin", channel, CHANNEL_BED_Y, true);

    // ══ ALCOVE SHORE ══ a rock mass with three cut niches. The shelf is the
    // layout's shore floor rect; the mass stands on it.
    boxes.push(block("shore-base", shore, POOL_BOTTOM_Y, SHELF_Y, "rock"));
    const shoreTop = SHELF_Y + SHORE_ROCK_H;
    const niches = alcoves.map((a) => ({
      minX: a.x - NICHE_W / 2,
      maxX: a.x + NICHE_W / 2,
    }));
    // rock piers between and beside the niches
    const edges = [shore.minX, ...niches.flatMap((n) => [n.minX, n.maxX]), shore.maxX];
    for (let i = 0; i < edges.length - 1; i += 2) {
      const pier: WorldRect = { ...shore, minX: edges[i]!, maxX: edges[i + 1]! };
      if (sx(pier) < 0.05) continue;
      boxes.push(block(`shore-pier-${i}`, pier, SHELF_Y, shoreTop, "rock"));
    }
    niches.forEach((niche, i) => {
      // back wall behind the niche, and the lintel over its opening
      boxes.push(
        block(
          `niche-back-${i}`,
          { ...shore, ...niche, minZ: shore.minZ + NICHE_DEPTH },
          SHELF_Y,
          shoreTop,
          "rock"
        ),
        block(
          `niche-lintel-${i}`,
          { ...shore, ...niche, maxZ: shore.minZ + NICHE_DEPTH },
          SHELF_Y + NICHE_H,
          shoreTop,
          "rock"
        )
      );
      glyphs.push({
        id: `glyph-${i}`,
        pos: [
          alcoves[i]!.x,
          SHELF_Y + NICHE_H * 0.55,
          shore.minZ + NICHE_DEPTH - 0.06,
        ],
      });
    });

    // ══ BALUSTRADE ══ every walkway edge that faces water.
    balustrades.forEach((rect, i) => {
      boxes.push(block(`rail-${i}`, rect, CAUSEWAY_Y, CAUSEWAY_Y + RAIL_H, "stone"));
    });

    // ══ CARVED THRESHOLD ══ frames the Fire exit, never blocks it.
    const jambTop = CAUSEWAY_Y + 3.6;
    const lintelBase = CAUSEWAY_Y + 3.2;
    const transomBase = CAUSEWAY_Y + 2.4;
    thresholdJambs.forEach((jamb, i) => {
      boxes.push(block(`threshold-jamb-${i}`, jamb, CAUSEWAY_Y, jambTop, "stone"));
    });
    boxes.push(block("threshold-lintel", threshold, lintelBase, jambTop, "stone"));
    const BAR_COUNT = 11;
    const barWidth = 0.06;
    const openingWidth = sx(thresholdOpening);
    const barGap = (openingWidth - BAR_COUNT * barWidth) / (BAR_COUNT + 1);
    for (let i = 0; i < BAR_COUNT; i++) {
      const minX =
        thresholdOpening.minX + barGap * (i + 1) + barWidth * i;
      boxes.push(
        block(
          `threshold-bar-${i}`,
          {
            ...thresholdOpening,
            minX,
            maxX: minX + barWidth,
            minZ: cz(threshold) - 0.05,
            maxZ: cz(threshold) + 0.05,
          },
          transomBase,
          lintelBase,
          "gold"
        )
      );
    }

    // ══ WATERFALL ══ one column at the channel's west end.
    boxes.push(block("waterfall", waterfall, CHANNEL_BED_Y, CAUSEWAY_Y + 6, "waterfall"));

    // ══ WATER ══
    layout.waterPlanes.forEach((rect, i) => {
      if (sx(rect) < 0.05 || sz(rect) < 0.05) return;
      waterPlanes.push({
        id: `water-plane-${i}`,
        pos: [cx(rect), WATERLINE_Y, cz(rect)],
        size: [sx(rect), sz(rect)],
      });
    });
    for (const volume of layout.waterVolumes) {
      if (sz(volume.rect) < 0.05) continue;
      waterVolumes.push(
        block(volume.id, volume.rect, volume.floorY, WATERLINE_Y, "waterVolume")
      );
    }

    // ══ LIFE STAND-INS ══ cave-native: dark plants with a cool glow, pale
    // bodies. Placeholders for the GLB fauna pass; seeded so they never move.
    const scatter = (
      rect: WorldRect,
      inset: number,
      yBase: number,
      yLift: number
    ): [number, number, number] => [
      rect.minX + inset + rng() * Math.max(sx(rect) - inset * 2, 0.05),
      yBase + rng() * yLift,
      rect.minZ + inset + rng() * Math.max(sz(rect) - inset * 2, 0.05),
    ];

    // The bloom: thickest at the north run's midpoint, thinning along the path.
    const bloomRect: WorldRect = {
      minX: northRun.minX,
      maxX: northRun.maxX,
      minZ: Math.max(northRun.minZ, bloomAnchor.z - 3),
      maxZ: Math.min(northRun.maxZ, bloomAnchor.z + 3),
    };
    for (let i = 0; i < 10; i++) {
      plants.push({
        id: `bloom-plant-${i}`,
        pos: scatter(bloomRect, 0.4, GALLERY_FLOOR_Y + 0.42, 0),
        scale: 0.8 + rng() * 0.7,
      });
    }
    const pathRects = [descentRoofed, westRun, northRun, eastBend, westRun, northRun];
    pathRects.forEach((rect, i) => {
      plants.push({
        id: `path-plant-${i}`,
        pos: scatter(rect, 0.4, GALLERY_FLOOR_Y + 0.42, 0),
        scale: 0.6 + rng() * 0.5,
      });
    });
    for (let i = 0; i < 8; i++) {
      fish.push({
        id: `fish-${i}`,
        pos: scatter(bloomRect, 0.3, GALLERY_FLOOR_Y + 0.8, 1.4),
        scale: 0.7 + rng() * 0.6,
      });
    }

    // ══ LIGHTS ══ eleven, all seeded off layout rects. Nothing in this room
    // is allowed to render 100% black.
    lights.push(
      {
        // the waterline you wade into on the approach
        id: "approach-waterline",
        pos: [cx(approach), WATERLINE_Y + 1.2, approach.minZ + 1],
        color: "#4a8aa8",
        intensity: 2.2,
        distance: 12,
      },
      {
        id: "gallery-bend-west",
        pos: [cx(northRun), GALLERY_ROOF_Y - 0.5, westRun.minZ],
        color: "#5fbfd8",
        intensity: 2.4,
        distance: 14,
      },
      {
        id: "gallery-bend-north",
        pos: [cx(northRun), GALLERY_ROOF_Y - 0.5, eastBend.maxZ],
        color: "#5fbfd8",
        intensity: 2.4,
        distance: 14,
      },
      {
        id: "gallery-bloom",
        pos: [bloomAnchor.x, GALLERY_FLOOR_Y + 1.2, bloomAnchor.z],
        color: CAVE_GLOW,
        intensity: 3.0,
        distance: 16,
      },
      {
        // warm spill down the surfacing stair — visible through the water from
        // the last bend, which is the cue to turn
        id: "surfacing-spill",
        pos: [cx(surfacingUpper), CAUSEWAY_Y + 1.6, surfacingUpper.minZ + 1],
        color: FIRELIGHT,
        intensity: 3.4,
        distance: 18,
      },
      {
        id: "apron-fill",
        pos: [cx(apron), CAUSEWAY_Y + 4.5, cz(apron)],
        color: "#6f93a6",
        intensity: 2.6,
        distance: 30,
      },
      {
        id: "south-fill",
        pos: [cx(threshold), CAUSEWAY_Y + 3.5, cz(threshold)],
        color: "#8a7a62",
        intensity: 2.0,
        distance: 20,
      },
      {
        id: "waterfall-accent",
        pos: [cx(waterfall), CAUSEWAY_Y + 2.2, cz(waterfall)],
        color: "#bfe9ff",
        intensity: 2.6,
        distance: 14,
      }
    );
    alcoves.forEach((a, i) => {
      lights.push({
        id: `alcove-firelight-${i}`,
        pos: [a.x, SHELF_Y + 1.6, shore.minZ + NICHE_DEPTH - 0.9],
        color: FIRELIGHT,
        intensity: 4.2,
        distance: 14,
      });
    });

    return { boxes, waterPlanes, waterVolumes, glyphs, plants, fish, lights };
  }

  const layout = $derived(buildDrownedGalleryLayout(grid));
  const scene = $derived(layout ? buildScene(layout) : null);

  const WATER_ROUTE = new Set([
    APPROACH_ROOM_ID,
    GALLERY_ROOM_ID,
    GROTTO_ROOM_ID,
  ]);
  /** Lights idle to zero when the player is nowhere near the bay. */
  const lit = $derived(
    visible && (currentRoomId === null || WATER_ROUTE.has(currentRoomId))
  );
</script>

{#if scene}
  <T.Group {visible}>
    <!-- Floors, ramps, stairs, rock, walls, ceilings, fittings -->
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

    <!-- Water surfaces: only where a shaft or a basin actually shows one -->
    {#each scene.waterPlanes as plane (plane.id)}
      <T.Mesh
        geometry={unitPlane}
        material={materials.waterSurface}
        position={plane.pos}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[plane.size[0], plane.size[1], 1]}
      />
    {/each}

    <!-- Submerged volume tint, viewed from inside -->
    {#each scene.waterVolumes as volume (volume.id)}
      <T.Mesh
        geometry={unitBox}
        material={materials.waterVolume}
        position={volume.pos}
        scale={volume.size}
      />
    {/each}

    <!-- Cave-art glyph disc behind each performer -->
    {#each scene.glyphs as glyph (glyph.id)}
      <T.Mesh
        geometry={glyphGeometry}
        material={materials.glyph}
        position={glyph.pos}
      />
    {/each}

    <!-- Life stand-ins: bioluminescent plants and pale cave fish -->
    {#each scene.plants as plant (plant.id)}
      <T.Mesh
        geometry={plantGeometry}
        material={materials.plant}
        position={plant.pos}
        scale={plant.scale}
      />
    {/each}
    {#each scene.fish as marker (marker.id)}
      <T.Mesh
        geometry={fishGeometry}
        material={materials.fish}
        position={marker.pos}
        scale={[marker.scale * 1.8, marker.scale, marker.scale]}
      />
    {/each}

    <!-- Light plan -->
    {#each scene.lights as light (light.id)}
      <T.PointLight
        position={light.pos}
        color={light.color}
        intensity={lit ? light.intensity : 0}
        distance={light.distance}
        decay={2}
        castShadow={false}
      />
    {/each}
  </T.Group>
{/if}
