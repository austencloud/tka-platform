<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    count?: number;
    ringRadius?: number;
    seed?: number;
    capColors?: string[];
    stemColor?: string;
    glowColor?: string;
    glowIntensity?: number;
  }

  let {
    count = 8,
    ringRadius = 7,
    seed = 42,
    capColors = ["#b5651d", "#8b4513", "#cd853f", "#a0522d"],
    stemColor = "#e8dcc8",
    glowColor = "#d4a040",
    glowIntensity = 0.15,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function cubicBez(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function isNearStream(px: number, pz: number, margin: number): boolean {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      let sx: number, sz: number;
      if (t < 0.5) {
        const u = t * 2;
        sx = cubicBez(-15, -8, -3, 0, u);
        sz = cubicBez(-5, -3, 3, 4, u);
      } else {
        const u = (t - 0.5) * 2;
        sx = cubicBez(0, 3, 8, 15, u);
        sz = cubicBez(4, 5, 2, 8, u);
      }
      const dx = px - sx, dz = pz - sz;
      if (dx * dx + dz * dz < margin * margin) return true;
    }
    return false;
  }

  interface Mushroom {
    x: number;
    z: number;
    capRadius: number;
    stemHeight: number;
    stemRadius: number;
    capColor: string;
    rotY: number;
    tilt: number;
  }

  interface ClusterCenter {
    x: number;
    z: number;
  }

  const clusterCenters = $derived.by(() => {
    const centers: ClusterCenter[] = [];
    for (let i = 0; i < count; i++) {
      const baseAngle =
        (i / count) * Math.PI * 2 + (hash(seed + i * 3.1) - 0.5) * 0.6;
      const r = ringRadius + (hash(seed + i * 7.7) - 0.5) * 2;
      const x = Math.cos(baseAngle) * r;
      const z = Math.sin(baseAngle) * r;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < 2.5) continue;
      if (isNearStream(x, z, 2.5)) continue;

      centers.push({ x, z });
    }
    return centers;
  });

  const mushrooms = $derived.by(() => {
    const result: Mushroom[] = [];
    for (let ci = 0; ci < clusterCenters.length; ci++) {
      const center = clusterCenters[ci]!;
      const mushroomCount =
        2 + Math.floor(hash(seed * 17 + ci * 11.3) * 3);

      for (let mi = 0; mi < mushroomCount; mi++) {
        const offsetX =
          (hash(seed * 23 + ci * 31 + mi * 5.7) - 0.5) * 1.0;
        const offsetZ =
          (hash(seed * 29 + ci * 37 + mi * 7.3) - 0.5) * 1.0;
        const capRadius =
          0.06 + hash(seed * 41 + ci * 43 + mi * 11.1) * 0.08;
        const stemHeight =
          0.08 + hash(seed * 47 + ci * 53 + mi * 13.7) * 0.1;
        const stemRadius =
          0.015 + hash(seed * 59 + ci * 61 + mi * 17.3) * 0.015;
        const capColor =
          capColors[
            Math.floor(
              hash(seed * 67 + ci * 71 + mi * 19.1) * capColors.length,
            )
          ] ?? capColors[0]!;
        const rotY =
          hash(seed * 73 + ci * 79 + mi * 23.7) * Math.PI * 2;
        const tilt =
          (hash(seed * 83 + ci * 89 + mi * 29.3) - 0.5) * 0.3;

        result.push({
          x: center.x + offsetX,
          z: center.z + offsetZ,
          capRadius,
          stemHeight,
          stemRadius,
          capColor,
          rotY,
          tilt,
        });
      }
    }
    return result;
  });
</script>

{#each mushrooms as m}
  <T.Group
    position.x={m.x}
    position.y={groundY}
    position.z={m.z}
    rotation.y={m.rotY}
  >
    <!-- Stem -->
    <T.Mesh position.y={m.stemHeight / 2} rotation.z={m.tilt}>
      <T.CylinderGeometry
        args={[m.stemRadius * 0.7, m.stemRadius, m.stemHeight, 5]}
      />
      <T.MeshStandardMaterial color={stemColor} roughness={0.8} />
    </T.Mesh>
    <!-- Cap -->
    <T.Mesh position.y={m.stemHeight} rotation.z={m.tilt}>
      <T.SphereGeometry
        args={[m.capRadius, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2]}
      />
      <T.MeshStandardMaterial
        color={m.capColor}
        emissive={glowColor}
        emissiveIntensity={glowIntensity}
        roughness={0.7}
      />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Subtle warm glow per cluster -->
{#each clusterCenters as center}
  <T.PointLight
    position.x={center.x}
    position.y={groundY + 0.15}
    position.z={center.z}
    color={glowColor}
    intensity={2}
    distance={3}
    decay={2}
  />
{/each}
