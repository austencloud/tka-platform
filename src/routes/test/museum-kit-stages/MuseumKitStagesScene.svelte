<script module lang="ts">
  export type Stage = "asis" | "sealed" | "merged" | "kit";
</script>

<script lang="ts">
  /**
   * MuseumKitStagesScene — a teaching scene, NOT production code.
   *
   * One small institutional-wing room, morphed through the four stages of the
   * modular-kit redesign so the difference is visible:
   *
   *   asis   — faithful replica of the CURRENT builder output: a 1-tile-thick
   *            perimeter of separate 0.5m wall slabs, with doorway / exhibit
   *            tiles left as full-height gaps (skybox shows through), per-tile
   *            thin floor slabs over a void (see-through seams), and the real
   *            ambient-only lighting (walls read black). This is the bug.
   *   sealed — same primitive boxes, but gaps filled, a ceiling added, walls
   *            given exterior backing, floor merged into one plane. Holes and
   *            see-through floor are gone. Geometry only; still flat boxes.
   *   merged — wall RUNS merged into long pieces with distinct corner posts and
   *            a framed doorway, instead of per-tile slabs. This is what the
   *            wall-run-resolver produces. Fewer, aligned pieces.
   *   kit    — REPRESENTATIVE stand-in for the Blender-authored CC0 kit:
   *            paneled walls (baseboard + cornice) under baked-feel lighting so
   *            surfaces read with form, not black. The final uses an optimized
   *            GLB; this shows the lighting + paneling target, not the real art.
   */
  import { T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { BackSide } from "three";

  interface Props {
    stage: Stage;
  }

  const { stage }: Props = $props();

  // ── Room dimensions (mirrors the real builder: 0.5m tiles, 4.5m walls) ──
  const TILE = 0.5;
  const WALL_H = 4.5;
  const WT = 16; // tiles wide (x)
  const DT = 10; // tiles deep (z)
  const W = WT * TILE; // 8m
  const D = DT * TILE; // 5m
  const HALF_W = W / 2;
  const HALF_D = D / 2;

  // Institutional / marble palette (real WING_WALL_COLORS.institutional)
  const WALL_COLOR = "#e8e4e0";
  const FLOOR_COLOR = "#e0d8c8";
  const ACCENT = "#9a8f7a";

  // Gaps on the front (south, +z) wall — the tiles that are floor not wall in
  // the real grid: a centered doorway (2 tiles) and one exhibit slot (1 tile).
  const DOORWAY_TILES = new Set([7, 8]);
  const EXHIBIT_TILES = new Set([3]);
  const FRONT_GAP_TILES = new Set([...DOORWAY_TILES, ...EXHIBIT_TILES]);

  type Side = "north" | "south" | "east" | "west";

  interface Slab {
    x: number;
    z: number;
    gap: boolean; // a doorway/exhibit opening
  }

  // Per-tile slabs for all four perimeter walls (asis / sealed geometry mode).
  const slabs = $derived.by<Slab[]>(() => {
    const out: Slab[] = [];
    // south (+z) and north (-z): advance along x
    for (let i = 0; i < WT; i++) {
      const x = -HALF_W + TILE / 2 + i * TILE;
      out.push({ x, z: HALF_D - TILE / 2, gap: FRONT_GAP_TILES.has(i) });
      out.push({ x, z: -HALF_D + TILE / 2, gap: false });
    }
    // east (+x) and west (-x): advance along z (skip shared corners)
    for (let j = 1; j < DT - 1; j++) {
      const z = -HALF_D + TILE / 2 + j * TILE;
      out.push({ x: HALF_W - TILE / 2, z, gap: false });
      out.push({ x: -HALF_W + TILE / 2, z, gap: false });
    }
    return out;
  });

  // Per-tile floor slabs (asis only) — 0.48 wide, 0.05 thin, 0.02 seam, void below.
  const floorSlabs = $derived.by(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < WT; i++) {
      for (let j = 0; j < DT; j++) {
        out.push({
          x: -HALF_W + TILE / 2 + i * TILE,
          z: -HALF_D + TILE / 2 + j * TILE,
        });
      }
    }
    return out;
  });

  // Merged wall runs (merged / kit geometry mode): one box per side, with the
  // front wall split around the doorway. [centerX, centerZ, lenX, lenZ]
  interface Run {
    x: number;
    z: number;
    lx: number;
    lz: number;
  }
  const doorHalf = TILE; // doorway spans tiles 7-8 → centered, 1m wide opening
  const runs = $derived.by<Run[]>(() => {
    const t = TILE;
    const back = -HALF_D + t / 2;
    const front = HALF_D - t / 2;
    const left = -HALF_W + t / 2;
    const right = HALF_W - t / 2;
    // front wall is split around the centered 1m doorway into two segments
    const segLen = HALF_W - doorHalf;
    return [
      { x: 0, z: back, lx: W, lz: t }, // north (solid)
      { x: left, z: 0, lx: t, lz: D }, // west
      { x: right, z: 0, lx: t, lz: D }, // east
      { x: -(doorHalf + segLen / 2), z: front, lx: segLen, lz: t }, // front-left
      { x: doorHalf + segLen / 2, z: front, lx: segLen, lz: t }, // front-right
    ];
  });

  const corners = $derived([
    { x: -HALF_W + TILE / 2, z: -HALF_D + TILE / 2 },
    { x: HALF_W - TILE / 2, z: -HALF_D + TILE / 2 },
    { x: -HALF_W + TILE / 2, z: HALF_D - TILE / 2 },
    { x: HALF_W - TILE / 2, z: HALF_D - TILE / 2 },
  ]);

  // Stage flags
  const isPerTile = $derived(stage === "asis" || stage === "sealed");
  const fillGaps = $derived(stage !== "asis"); // asis leaves gaps open
  const hasCeiling = $derived(stage !== "asis");
  const mergedMode = $derived(stage === "merged" || stage === "kit");
  const paneled = $derived(stage === "kit");
  const wallThick = $derived(stage === "asis" ? TILE : TILE * 1.4); // thicker shell once sealed

  // Lighting per stage
  const ambient = $derived(
    stage === "asis" ? 0.15 : stage === "kit" ? 0.5 : 0.35,
  );
  const dirIntensity = $derived(stage === "asis" ? 0 : stage === "kit" ? 1.1 : 0.55);
  const ambientColor = $derived(stage === "kit" ? "#fff2dc" : "#c8b890");
</script>

<T.PerspectiveCamera makeDefault position={[0, 2.4, 7.5]} fov={55}>
  <OrbitControls target={[0, 1.6, 0]} enableDamping maxPolarAngle={1.5} />
</T.PerspectiveCamera>

<!-- Sky dome — so wall gaps and floor seams read as open sky / void -->
<T.Mesh>
  <T.SphereGeometry args={[40, 32, 16]} />
  <T.MeshBasicMaterial color="#1d3a5f" side={BackSide} />
</T.Mesh>

<!-- Lighting -->
<T.AmbientLight intensity={ambient} color={ambientColor} />
<T.HemisphereLight intensity={0.3} color="#fff8e0" groundColor="#2a2015" />
{#if dirIntensity > 0}
  <T.DirectionalLight intensity={dirIntensity} position={[4, 8, 6]} color="#fff4e2" />
{/if}
{#if stage === "kit"}
  <T.PointLight intensity={6} distance={14} decay={2} position={[0, 3.5, 0]} color="#ffe8c0" />
{/if}

<!-- ─────────── FLOOR ─────────── -->
{#if stage === "asis"}
  <!-- per-tile thin slabs over a void: seams + see-through -->
  {#each floorSlabs as f}
    <T.Mesh position={[f.x, 0.025, f.z]} receiveShadow>
      <T.BoxGeometry args={[TILE - 0.02, 0.05, TILE - 0.02]} />
      <T.MeshStandardMaterial color={FLOOR_COLOR} roughness={0.9} />
    </T.Mesh>
  {/each}
{:else}
  <!-- merged solid floor plane, no seams, no void -->
  <T.Mesh position={[0, 0, 0]} receiveShadow>
    <T.BoxGeometry args={[W, 0.2, D]} />
    <T.MeshStandardMaterial color={FLOOR_COLOR} roughness={0.85} />
  </T.Mesh>
{/if}

<!-- ─────────── CEILING ─────────── -->
{#if hasCeiling}
  <T.Mesh position={[0, WALL_H, 0]}>
    <T.BoxGeometry args={[W, 0.2, D]} />
    <T.MeshStandardMaterial color={ACCENT} roughness={0.9} side={BackSide} />
  </T.Mesh>
{/if}

<!-- ─────────── WALLS ─────────── -->
{#if isPerTile}
  {#each slabs as s}
    {#if !s.gap || fillGaps}
      <T.Mesh position={[s.x, WALL_H / 2, s.z]} castShadow receiveShadow>
        <T.BoxGeometry args={[TILE, WALL_H, wallThick]} />
        <T.MeshStandardMaterial color={WALL_COLOR} roughness={0.85} />
      </T.Mesh>
    {/if}
  {/each}
{:else}
  <!-- merged runs -->
  {#each runs as r}
    <T.Mesh position={[r.x, WALL_H / 2, r.z]} castShadow receiveShadow>
      <T.BoxGeometry args={[r.lx, WALL_H, r.lz]} />
      <T.MeshStandardMaterial color={WALL_COLOR} roughness={0.8} />
    </T.Mesh>
    {#if paneled}
      <!-- baseboard -->
      <T.Mesh position={[r.x, 0.3, r.z]}>
        <T.BoxGeometry args={[r.lx + 0.06, 0.6, r.lz + 0.06]} />
        <T.MeshStandardMaterial color={ACCENT} roughness={0.6} />
      </T.Mesh>
      <!-- cornice -->
      <T.Mesh position={[r.x, WALL_H - 0.25, r.z]}>
        <T.BoxGeometry args={[r.lx + 0.06, 0.5, r.lz + 0.06]} />
        <T.MeshStandardMaterial color={ACCENT} roughness={0.6} />
      </T.Mesh>
    {/if}
  {/each}
  <!-- corner posts -->
  {#each corners as c}
    <T.Mesh position={[c.x, WALL_H / 2, c.z]} castShadow>
      <T.BoxGeometry args={[TILE * 1.5, WALL_H, TILE * 1.5]} />
      <T.MeshStandardMaterial color={paneled ? ACCENT : WALL_COLOR} roughness={0.7} />
    </T.Mesh>
  {/each}
  <!-- doorway header (frames the opening instead of leaving a raw gap) -->
  <T.Mesh position={[0, WALL_H - 0.6, HALF_D - TILE / 2]} castShadow>
    <T.BoxGeometry args={[1.4, 1.2, wallThick]} />
    <T.MeshStandardMaterial color={paneled ? ACCENT : WALL_COLOR} roughness={0.75} />
  </T.Mesh>
{/if}
