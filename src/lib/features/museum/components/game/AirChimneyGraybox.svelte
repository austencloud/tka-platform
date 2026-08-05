<script lang="ts">
  /**
   * Graybox shell for the Air chimney — the Vulcan Cave air bay's updraft
   * feel-prototype.
   *
   * EVERY rect, post and light position below comes off
   * buildAirChimneyLayout(grid). There is not one world coordinate in this
   * file. If a shape here disagrees with where physics puts the player, the
   * layout is wrong, not this file.
   *
   * The column has to be SEEN, not inferred: a translucent cylinder marks the
   * lift's exact footprint and ceiling, and rising motes give it motion. The
   * motes reuse the shared FallingParticles primitive in "embers" mode, which
   * already rises — no second particle system.
   */
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BoxGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    DoubleSide,
  } from "three";
  import FallingParticles from "$lib/shared/3d/environments/primitives/FallingParticles.svelte";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import {
    buildAirChimneyLayout,
    type AirChimneyLayout,
    AIR_CEILING_Y,
    AIR_FLOOR_Y,
    AIR_ROOM_ID,
    EARTH_ROOM_ID,
    LANDING_B_Y,
    OVERLOOK_Y,
  } from "../../data/air-chimney-layout";
  import type { WorldRect } from "../../data/drowned-gallery-terrain";

  interface Props {
    grid: MuseumGrid;
    /** Room the player is standing in; lights idle when they are elsewhere. */
    currentRoomId?: string | null;
    visible?: boolean;
  }
  const { grid, currentRoomId = null, visible = true }: Props = $props();

  // ── Palette ───────────────────────────────────────────────────────────────
  // Graybox values, not final art. The first verification pass rendered the
  // shaft as a black silhouette against a dim room; these are the values at
  // which the ramp, the ledges and the rim read as separate surfaces.
  const STONE = "#4a515c";
  const STONE_LIT = "#69727f";
  const LEDGE = "#8b95a3";
  const RIM_ROCK = "#343b44";
  const DRAFT = "#bfe4ff";
  const MARKER = "#e8f4ff";
  const FILL_LIGHT = "#8fb6d8";

  /** Slab thickness for every floor, ramp and ceiling box. */
  const SLAB_T = 0.3;
  /** How far above the lip the column's marker cylinder is drawn. */
  const COLUMN_VISUAL_TOP = OVERLOOK_Y + 0.4;
  /** Marker posts carry a bright cap so the height reads from across the room. */
  const CAP_H = 0.25;

  // ── Shared geometry + materials (disposed on destroy) ─────────────────────
  const unitBox = new BoxGeometry(1, 1, 1);
  const unitCylinder = new CylinderGeometry(1, 1, 1, 32, 1, true);

  const materials = {
    rock: new MeshStandardMaterial({ color: STONE, roughness: 1 }),
    rockLit: new MeshStandardMaterial({ color: STONE_LIT, roughness: 1 }),
    ledge: new MeshStandardMaterial({ color: LEDGE, roughness: 0.9 }),
    rim: new MeshStandardMaterial({ color: RIM_ROCK, roughness: 1 }),
    marker: new MeshStandardMaterial({
      color: MARKER,
      emissive: MARKER,
      emissiveIntensity: 1.2,
      toneMapped: false,
    }),
    // Barely there on purpose: the column must read as a boundary you can see
    // through, not a solid of light. At 0.14 opacity it filled the whole frame
    // the moment the player stood next to it (verification pass, 2026-08-05).
    draft: new MeshStandardMaterial({
      color: DRAFT,
      emissive: DRAFT,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.045,
      side: DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  } as const;

  type MaterialKey = keyof typeof materials;

  onDestroy(() => {
    unitBox.dispose();
    unitCylinder.dispose();
    for (const material of Object.values(materials)) material.dispose();
  });

  // ── Box helpers ───────────────────────────────────────────────────────────
  interface Box {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    rot: [number, number, number];
    material: MaterialKey;
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
      size: [
        Math.max(sx(r), 0.01),
        Math.max(topY - baseY, 0.01),
        Math.max(sz(r), 0.01),
      ],
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
    const angle = Math.atan2(dy, run);
    return {
      id,
      pos: [cx(r), (yAtMinZ + yAtMaxZ) / 2 - SLAB_T / 2 / Math.cos(angle), cz(r)],
      size: [sx(r), SLAB_T, Math.hypot(run, dy)],
      // Tilting about x raises the SOUTH edge when the angle is negative.
      rot: [-angle, 0, 0],
      material,
    };
  }

  // ── Scene assembly ────────────────────────────────────────────────────────
  interface Scene {
    boxes: Box[];
    lights: Lamp[];
  }

  function buildScene(layout: AirChimneyLayout): Scene {
    const boxes: Box[] = [];
    const lights: Lamp[] = [];

    const { ramp, platform, column, lip, rims, markers, floorRects, wallRects, ceilingRects } =
      layout;

    // ══ FLOORS ══ one box per layout floor rect, so the visible floor and the
    // walkable floor are the same list.
    for (const floor of floorRects) {
      const material: MaterialKey =
        floor.id === "air-lip" || floor.id === "air-platform"
          ? "ledge"
          : "rockLit";
      if (floor.kind === "ramp-z") {
        boxes.push(rampZ(floor.id, floor.rect, floor.fromY, floor.toY, material));
      } else {
        boxes.push(slab(floor.id, floor.rect, floor.fromY, material));
      }
    }

    // ══ MASS ══ the ramp, platform, shaft base and lip are cut out of rock, so
    // each one gets a visible body under it rather than floating.
    boxes.push(
      block("ramp-body", ramp, AIR_FLOOR_Y - 1.0, LANDING_B_Y - SLAB_T, "rock"),
      block("platform-body", platform, AIR_FLOOR_Y - 1.0, LANDING_B_Y - SLAB_T, "rock"),
      block("column-body", column, AIR_FLOOR_Y - 1.0, LANDING_B_Y - SLAB_T, "rock"),
      block("lip-body", lip, OVERLOOK_Y - 1.2, OVERLOOK_Y - SLAB_T, "rock")
    );

    // ══ RIMS ══ the blocked rock that makes the updraft the only way up.
    for (const rim of rims) {
      boxes.push(block(rim.id, rim.rect, AIR_FLOOR_Y - 1.0, rim.topY, "rim"));
    }

    // ══ WALLS + CEILING ══ door gaps already derived from real door tiles.
    for (const wall of wallRects) {
      boxes.push(block(wall.id, wall.rect, wall.baseY, wall.topY, "rock"));
    }
    for (const ceiling of ceilingRects) {
      boxes.push(slab(ceiling.id, ceiling.rect, ceiling.y + SLAB_T, "rock"));
    }

    // ══ HEIGHT MARKERS ══ plain posts at +1.6 / +4.6 / +7.6 with a lit cap, so
    // the rise has something to read against.
    for (const marker of markers) {
      boxes.push(
        block(`${marker.id}-post`, marker.rect, AIR_FLOOR_Y, marker.topY - CAP_H, "rockLit"),
        block(`${marker.id}-cap`, marker.rect, marker.topY - CAP_H, marker.topY, "marker")
      );
    }

    // ══ LIGHTS ══ sized for decay=2: a value that must still read at r metres
    // needs roughly target·r². Nothing in this room renders 100% black.
    lights.push(
      {
        id: "air-shaft-light",
        pos: [cx(column), OVERLOOK_Y + 1.5, cz(column)],
        color: DRAFT,
        intensity: 45,
        distance: 26,
      },
      {
        id: "air-platform-light",
        pos: [cx(platform), LANDING_B_Y + 2.0, cz(platform)],
        color: FILL_LIGHT,
        intensity: 40,
        distance: 22,
      },
      {
        id: "air-lip-light",
        pos: [cx(lip), OVERLOOK_Y + 2.0, cz(lip)],
        color: FILL_LIGHT,
        intensity: 40,
        distance: 22,
      },
      {
        id: "air-ramp-light",
        pos: [cx(ramp), LANDING_B_Y + 3.0, cz(ramp)],
        color: FILL_LIGHT,
        intensity: 120,
        distance: 40,
      },
      {
        id: "air-room-fill",
        pos: [cx(layout.shell), AIR_CEILING_Y - 2.0, cz(layout.shell)],
        color: FILL_LIGHT,
        intensity: 420,
        distance: 70,
      },
      {
        // The shaft's east face is what the room looks at; without this it
        // silhouettes as a black wall (verification pass, 2026-08-05).
        id: "air-shaft-face",
        pos: [lip.maxX + 3.0, OVERLOOK_Y - 1.0, cz(lip)],
        color: FILL_LIGHT,
        intensity: 150,
        distance: 34,
      },
      {
        id: "air-ramp-foot",
        pos: [cx(ramp), 3.0, ramp.minZ + 2.0],
        color: FILL_LIGHT,
        intensity: 90,
        distance: 28,
      },
      {
        id: "air-ramp-mid",
        pos: [ramp.maxX + 2.0, 6.0, cz(ramp)],
        color: FILL_LIGHT,
        intensity: 200,
        distance: 40,
      },
      {
        id: "air-north-fill",
        pos: [cx(layout.shell), 6.0, layout.shell.minZ + 8.0],
        color: FILL_LIGHT,
        intensity: 220,
        distance: 46,
      },
      {
        id: "air-entry-light",
        pos: [cx(layout.shell), 3.0, layout.shell.minZ + 2.0],
        color: FILL_LIGHT,
        intensity: 60,
        distance: 26,
      }
    );

    return { boxes, lights };
  }

  const layout = $derived(buildAirChimneyLayout(grid));
  const scene = $derived(layout ? buildScene(layout) : null);

  const AIR_ROUTE = new Set([AIR_ROOM_ID, EARTH_ROOM_ID]);
  /** Lights and motes idle when the player is nowhere near the bay. */
  const lit = $derived(
    visible && (currentRoomId === null || AIR_ROUTE.has(currentRoomId))
  );

  const columnHeight = $derived(COLUMN_VISUAL_TOP - LANDING_B_Y);
</script>

{#if scene && layout}
  <T.Group {visible}>
    <!-- Floors, ramp, ledges, rims, rock, walls, ceiling, markers -->
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

    <!-- The lift, made visible: a translucent shell on the exact footprint the
         terrain lifts inside, capped at the overlook it delivers to. -->
    <T.Mesh
      geometry={unitCylinder}
      material={materials.draft}
      position={[
        layout.columnCentre.x,
        LANDING_B_Y + columnHeight / 2,
        layout.columnCentre.z,
      ]}
      scale={[layout.columnRadius, columnHeight, layout.columnRadius]}
    />

    <!-- Rising motes: the shared particle primitive in its rising mode. -->
    <T.Group
      position={[
        layout.columnCentre.x,
        LANDING_B_Y + columnHeight / 2,
        layout.columnCentre.z,
      ]}
    >
      <FallingParticles
        type="embers"
        count={120}
        area={{
          width: layout.columnRadius * 1.8,
          height: columnHeight,
          depth: layout.columnRadius * 1.8,
        }}
        speed={1.0}
        colors={[DRAFT, "#ffffff", "#dff1ff"]}
        sizeRange={[0.018, 0.04]}
        spin={false}
        enabled={lit}
      />
    </T.Group>

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
