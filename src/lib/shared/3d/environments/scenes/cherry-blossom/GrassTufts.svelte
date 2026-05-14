<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    count?: number;
    radius?: number;
    seed?: number;
    color?: string;
    altColor?: string;
  }

  let {
    count = 40,
    radius = 15,
    seed = 7,
    color = "#1e3518",
    altColor = "#2a4025",
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  interface MossClump {
    x: number;
    z: number;
    color: string;
    scaleX: number;
    scaleZ: number;
    rotY: number;
  }

  const clumps = $derived.by(() => {
    const result: MossClump[] = [];
    for (let i = 0; i < count; i++) {
      const h0 = hash(seed * 1000 + i * 3.1);
      const h1 = hash(seed * 1000 + i * 3.1 + 1);
      const angle = h0 * Math.PI * 2;
      const dist = Math.sqrt(h1) * radius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (x * x + z * z < 4) continue;

      const dx = x - -5;
      const dz = z - 4;
      if (dx * dx + dz * dz < 16) continue;

      result.push({
        x,
        z,
        color: hash(seed * 4000 + i) > 0.5 ? color : altColor,
        scaleX: 0.08 + hash(seed * 2000 + i) * 0.1,
        scaleZ: 0.08 + hash(seed * 2500 + i) * 0.1,
        rotY: hash(seed * 3000 + i) * Math.PI * 2,
      });
    }
    return result;
  });
</script>

{#each clumps as clump}
  <T.Mesh
    position.x={clump.x}
    position.y={groundY + 0.005}
    position.z={clump.z}
    rotation.y={clump.rotY}
    scale.x={clump.scaleX}
    scale.z={clump.scaleZ}
  >
    <T.SphereGeometry args={[1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
    <T.MeshStandardMaterial color={clump.color} roughness={0.95} />
  </T.Mesh>
{/each}
