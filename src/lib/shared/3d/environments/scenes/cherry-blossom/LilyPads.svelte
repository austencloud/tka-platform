<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    pondPosition?: { x: number; z: number };
    pondRadius?: number;
    count?: number;
    seed?: number;
    padColor?: string;
    flowerColor?: string;
  }

  let {
    pondPosition = { x: -5, z: 4 },
    pondRadius = 3.5,
    count = 5,
    seed = 13,
    padColor = "#1a3a1a",
    flowerColor = "#ffb0c0",
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  interface Pad {
    x: number;
    z: number;
    radius: number;
    rotY: number;
    tiltX: number;
    hasFlower: boolean;
  }

  const pads = $derived.by(() => {
    const result: Pad[] = [];
    const innerRadius = pondRadius * 0.7;

    for (let i = 0; i < count; i++) {
      const h0 = hash(seed * 500 + i * 5.3);
      const h1 = hash(seed * 500 + i * 5.3 + 1);
      const angle = h0 * Math.PI * 2;
      const dist = Math.sqrt(h1) * innerRadius;
      const x = pondPosition.x + Math.cos(angle) * dist;
      const z = pondPosition.z + Math.sin(angle) * dist;

      result.push({
        x,
        z,
        radius: 0.12 + hash(seed * 600 + i) * 0.08,
        rotY: hash(seed * 700 + i) * Math.PI * 2,
        tiltX: (hash(seed * 800 + i) - 0.5) * 0.04,
        hasFlower: hash(seed * 900 + i) < 0.3,
      });
    }
    return result;
  });
</script>

{#each pads as pad}
  <T.Group
    position.x={pad.x}
    position.y={groundY + 0.02}
    position.z={pad.z}
    rotation.y={pad.rotY}
  >
    <!-- Lily pad disc -->
    <T.Mesh rotation.x={-Math.PI / 2 + pad.tiltX}>
      <T.CircleGeometry args={[pad.radius, 12]} />
      <T.MeshStandardMaterial color={padColor} roughness={0.85} />
    </T.Mesh>

    <!-- Small flower on ~30% of pads -->
    {#if pad.hasFlower}
      <T.Mesh position.y={0.02}>
        <T.SphereGeometry args={[0.03, 6, 4]} />
        <T.MeshStandardMaterial color={flowerColor} roughness={0.7} />
      </T.Mesh>
    {/if}
  </T.Group>
{/each}
