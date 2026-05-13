<script lang="ts">
  import { T } from "@threlte/core";

  interface Props {
    seed?: number;
    trunkColor?: string;
    canopyColors?: string[];
    emissiveColor?: string;
    emissiveIntensity?: number;
  }

  let {
    seed = 0,
    trunkColor = "#3d2520",
    canopyColors = ["#ffb0c0", "#ffc0d0", "#ff90a8", "#ffe0e8"],
    emissiveColor = "#ff69b4",
    emissiveIntensity = 0.12,
  }: Props = $props();

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function pickColor(i: number): string {
    return canopyColors[Math.floor(hash(seed * 13 + i * 7.3) * canopyColors.length)] ?? canopyColors[0]!;
  }

  const trunkH = $derived(2.0 + hash(seed * 1.3) * 0.8);
  const trunkLean = $derived((hash(seed * 8.7) - 0.5) * 0.08);
  const branchStartY = $derived(trunkH * (0.55 + hash(seed * 2.7) * 0.15));

  interface Branch {
    yRot: number;
    tilt: number;
    len: number;
    rad: number;
    subs: { yRot: number; tilt: number; len: number; rad: number }[];
    clusterR: number;
    clusterColor: string;
  }

  const branches = $derived.by(() => {
    const count = 2 + Math.floor(hash(seed * 3.7) * 3);
    const result: Branch[] = [];
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2 + hash(seed + i) * 0.5;
      const tilt = 0.5 + hash(seed * 5 + i * 3.1) * 0.4;
      const len = 1.0 + hash(seed * 6 + i * 2.3) * 0.8;
      const subCount = hash(seed * 9 + i) > 0.5 ? 1 : 0;

      const subs: Branch["subs"] = [];
      for (let j = 0; j < subCount; j++) {
        subs.push({
          yRot: hash(seed * 14 + i * 5 + j) * Math.PI - Math.PI * 0.5,
          tilt: 0.3 + hash(seed * 15 + i * 4 + j) * 0.4,
          len: 0.5 + hash(seed * 16 + i * 3 + j) * 0.5,
          rad: 0.015 + hash(seed * 17 + i + j) * 0.01,
        });
      }

      result.push({
        yRot: baseAngle,
        tilt,
        len,
        rad: 0.03 + hash(seed * 7 + i) * 0.02,
        subs,
        clusterR: 0.5 + hash(seed * 10 + i) * 0.35,
        clusterColor: pickColor(i),
      });
    }
    return result;
  });

  const topClusterR = $derived(0.7 + hash(seed * 4.1) * 0.3);
  const topClusterColor = $derived(pickColor(99));
</script>

<T.Group>
  <!-- Trunk — slight lean for organic feel -->
  <T.Group rotation.z={trunkLean}>
    <T.Mesh position.y={trunkH / 2}>
      <T.CylinderGeometry args={[0.06, 0.12, trunkH, 6]} />
      <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
    </T.Mesh>

    <!-- Top canopy cluster — large, slightly oblate -->
    <T.Mesh
      position.y={trunkH + topClusterR * 0.25}
      scale.y={0.7}
    >
      <T.IcosahedronGeometry args={[topClusterR, 1]} />
      <T.MeshStandardMaterial
        color={topClusterColor}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.75}
      />
    </T.Mesh>

    <!-- Primary branches spreading outward -->
    {#each branches as branch, bi}
      <T.Group
        position.y={branchStartY + bi * 0.15}
        rotation.y={branch.yRot}
      >
        <T.Group rotation.z={branch.tilt}>
          <!-- Branch cylinder -->
          <T.Mesh position.y={branch.len / 2}>
            <T.CylinderGeometry args={[branch.rad * 0.6, branch.rad, branch.len, 5]} />
            <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
          </T.Mesh>

          <!-- Canopy at branch tip — oblate -->
          <T.Mesh
            position.y={branch.len}
            scale.y={0.65}
          >
            <T.IcosahedronGeometry args={[branch.clusterR, 1]} />
            <T.MeshStandardMaterial
              color={branch.clusterColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity * (0.8 + hash(seed * 20 + bi) * 0.4)}
              roughness={0.75}
            />
          </T.Mesh>

          <!-- Sub-branches -->
          {#each branch.subs as sub, si}
            <T.Group
              position.y={branch.len * 0.75}
              rotation.y={sub.yRot}
            >
              <T.Group rotation.z={sub.tilt}>
                <T.Mesh position.y={sub.len / 2}>
                  <T.CylinderGeometry args={[sub.rad * 0.6, sub.rad, sub.len, 5]} />
                  <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
                </T.Mesh>

                <T.Mesh
                  position.y={sub.len}
                  scale.y={0.6}
                >
                  <T.IcosahedronGeometry
                    args={[0.35 + hash(seed * 18 + bi * 3 + si) * 0.25, 1]}
                  />
                  <T.MeshStandardMaterial
                    color={pickColor(bi * 10 + si)}
                    emissive={emissiveColor}
                    emissiveIntensity={emissiveIntensity}
                    roughness={0.75}
                  />
                </T.Mesh>
              </T.Group>
            </T.Group>
          {/each}
        </T.Group>
      </T.Group>
    {/each}
  </T.Group>
</T.Group>
