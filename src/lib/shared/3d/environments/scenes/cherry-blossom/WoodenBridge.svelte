<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    position?: { x: number; z: number };
    rotationY?: number;
    scale?: number;
    woodColor?: string;
    railColor?: string;
    length?: number;
    width?: number;
    archHeight?: number;
  }

  let {
    position = { x: 0, z: 0 },
    rotationY = 0,
    scale = 1,
    woodColor = "#3d2a1a",
    railColor = "#4a3020",
    length = 3,
    width = 0.8,
    archHeight = 0.4,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const PLANK_COUNT = 10;
  const PLANK_THICKNESS = 0.03;
  const RAIL_HEIGHT_ABOVE_DECK = 0.3;
  const RAIL_SEGMENT_COUNT = 8;
  const POSTS_PER_SIDE = 5;
  const POST_RADIUS = 0.02;
  const RAIL_RADIUS = 0.015;

  /** Sine-arch helper: returns y for a normalized t in [0, 1]. */
  function archY(t: number): number {
    return archHeight * Math.sin(t * Math.PI);
  }

  /** Slope of the arch at t (for plank rotation). */
  function archSlope(t: number): number {
    return archHeight * Math.PI * Math.cos(t * Math.PI);
  }

  // --- Deck planks ---
  const planks = $derived.by(() => {
    const items: { x: number; y: number; rot: number; w: number }[] = [];
    const plankSpan = length / PLANK_COUNT;
    for (let i = 0; i < PLANK_COUNT; i++) {
      const t = (i + 0.5) / PLANK_COUNT;
      const x = (t - 0.5) * length;
      const y = archY(t);
      const rot = -Math.atan2(archSlope(t), length);
      items.push({ x, y, rot, w: plankSpan * 0.92 });
    }
    return items;
  });

  // --- Rail posts (both sides) ---
  const posts = $derived.by(() => {
    const items: { x: number; y: number; h: number; z: number }[] = [];
    for (let i = 0; i < POSTS_PER_SIDE; i++) {
      const t = (i + 0.5) / POSTS_PER_SIDE;
      const x = (t - 0.5) * length;
      const deckY = archY(t);
      const postH = RAIL_HEIGHT_ABOVE_DECK;
      const halfSide = width / 2;

      // Left side
      items.push({ x, y: deckY + postH / 2, h: postH, z: -halfSide });
      // Right side
      items.push({ x, y: deckY + postH / 2, h: postH, z: halfSide });
    }
    return items;
  });

  // --- Rail segments (both sides) ---
  const railSegments = $derived.by(() => {
    const items: {
      x: number;
      y: number;
      z: number;
      len: number;
      rot: number;
    }[] = [];
    const halfSide = width / 2;

    for (let i = 0; i < RAIL_SEGMENT_COUNT; i++) {
      const t0 = i / RAIL_SEGMENT_COUNT;
      const t1 = (i + 1) / RAIL_SEGMENT_COUNT;
      const x0 = (t0 - 0.5) * length;
      const x1 = (t1 - 0.5) * length;
      const y0 = archY(t0) + RAIL_HEIGHT_ABOVE_DECK;
      const y1 = archY(t1) + RAIL_HEIGHT_ABOVE_DECK;

      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const rot = Math.atan2(dy, dx);

      // Left rail
      items.push({ x: mx, y: my, z: -halfSide, len: segLen, rot });
      // Right rail
      items.push({ x: mx, y: my, z: halfSide, len: segLen, rot });
    }
    return items;
  });
</script>

<T.Group
  position.x={position.x}
  position.y={groundY}
  position.z={position.z}
  rotation.y={rotationY}
  scale={[scale, scale, scale]}
>
  <!-- Deck planks -->
  {#each planks as plank}
    <T.Mesh position.x={plank.x} position.y={plank.y} rotation.z={plank.rot}>
      <T.BoxGeometry args={[plank.w, PLANK_THICKNESS, width]} />
      <T.MeshStandardMaterial color={woodColor} roughness={0.85} />
    </T.Mesh>
  {/each}

  <!-- Rail posts -->
  {#each posts as post}
    <T.Mesh position.x={post.x} position.y={post.y} position.z={post.z}>
      <T.CylinderGeometry args={[POST_RADIUS, POST_RADIUS, post.h, 6]} />
      <T.MeshStandardMaterial color={railColor} roughness={0.85} />
    </T.Mesh>
  {/each}

  <!-- Rail segments -->
  {#each railSegments as seg}
    <T.Mesh
      position.x={seg.x}
      position.y={seg.y}
      position.z={seg.z}
      rotation.z={seg.rot}
    >
      <T.CylinderGeometry
        args={[RAIL_RADIUS, RAIL_RADIUS, seg.len, 6]}
        rotation={[0, 0, Math.PI / 2]}
      />
      <T.MeshStandardMaterial color={railColor} roughness={0.85} />
    </T.Mesh>
  {/each}
</T.Group>
