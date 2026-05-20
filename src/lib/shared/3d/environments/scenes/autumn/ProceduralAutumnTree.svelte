<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import type { Group } from "three";

  interface Props {
    seed?: number;
    trunkColor?: string;
    canopyColors?: string[];
  }

  let {
    seed = 0,
    trunkColor = "#4a3228",
    canopyColors = [
      "#d4a030",
      "#d97706",
      "#c2410c",
      "#b91c1c",
      "#7c2d12",
      "#92400e",
    ],
  }: Props = $props();

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function pickColor(i: number): string {
    return (
      canopyColors[
        Math.floor(hash(seed * 13 + i * 7.3) * canopyColors.length)
      ] ?? canopyColors[0]!
    );
  }

  interface FoliageSphere {
    x: number;
    y: number;
    z: number;
    r: number;
    color: string;
  }

  function foliageCloud(
    cloudSeed: number,
    baseR: number,
  ): FoliageSphere[] {
    const spheres: FoliageSphere[] = [
      { x: 0, y: 0, z: 0, r: baseR, color: pickColor(cloudSeed) },
      {
        x: (hash(cloudSeed + 1) - 0.5) * baseR * 0.9,
        y: (hash(cloudSeed + 2) - 0.5) * baseR * 0.5,
        z: (hash(cloudSeed + 3) - 0.5) * baseR * 0.9,
        r: baseR * (0.5 + hash(cloudSeed + 4) * 0.2),
        color: pickColor(cloudSeed + 5),
      },
      {
        x: (hash(cloudSeed + 6) - 0.5) * baseR * 0.8,
        y: (hash(cloudSeed + 7) - 0.5) * baseR * 0.4,
        z: (hash(cloudSeed + 8) - 0.5) * baseR * 0.8,
        r: baseR * (0.4 + hash(cloudSeed + 9) * 0.2),
        color: pickColor(cloudSeed + 10),
      },
      {
        x: (hash(cloudSeed + 11) - 0.5) * baseR * 1.0,
        y: (hash(cloudSeed + 12) - 0.5) * baseR * 0.3,
        z: (hash(cloudSeed + 13) - 0.5) * baseR * 1.0,
        r: baseR * (0.45 + hash(cloudSeed + 14) * 0.2),
        color: pickColor(cloudSeed + 15),
      },
      {
        x: (hash(cloudSeed + 16) - 0.5) * baseR * 0.7,
        y: (hash(cloudSeed + 17) - 0.5) * baseR * 0.35,
        z: (hash(cloudSeed + 18) - 0.5) * baseR * 0.7,
        r: baseR * (0.35 + hash(cloudSeed + 19) * 0.15),
        color: pickColor(cloudSeed + 20),
      },
    ];
    return spheres;
  }

  const trunkH = $derived(2.5 + hash(seed * 1.3) * 1.2);
  const trunkLean = $derived((hash(seed * 8.7) - 0.5) * 0.08);
  const branchStartY = $derived(
    trunkH * (0.5 + hash(seed * 2.7) * 0.15),
  );

  interface Branch {
    yRot: number;
    tilt: number;
    len: number;
    rad: number;
    cloudR: number;
    cloudSeed: number;
    hasSub: boolean;
    subYRot: number;
    subTilt: number;
    subLen: number;
    subRad: number;
    subCloudR: number;
    subCloudSeed: number;
  }

  const branches = $derived.by(() => {
    const count = 3 + Math.floor(hash(seed * 3.7) * 3);
    const result: Branch[] = [];
    for (let i = 0; i < count; i++) {
      const baseAngle =
        (i / count) * Math.PI * 2 + hash(seed + i) * 0.5;
      const tilt = 0.3 + hash(seed * 5 + i * 3.1) * 0.4;
      const len = 1.0 + hash(seed * 6 + i * 2.3) * 0.9;
      const hasSub = hash(seed * 9 + i) > 0.5;

      result.push({
        yRot: baseAngle,
        tilt,
        len,
        rad: 0.03 + hash(seed * 7 + i) * 0.025,
        cloudR: 0.5 + hash(seed * 10 + i) * 0.35,
        cloudSeed: seed * 100 + i * 25,
        hasSub,
        subYRot: hash(seed * 14 + i) * Math.PI - Math.PI * 0.5,
        subTilt: 0.25 + hash(seed * 15 + i) * 0.35,
        subLen: 0.5 + hash(seed * 16 + i) * 0.4,
        subRad: 0.018 + hash(seed * 17 + i) * 0.012,
        subCloudR: 0.35 + hash(seed * 18 + i) * 0.2,
        subCloudSeed: seed * 100 + i * 25 + 60,
      });
    }
    return result;
  });

  const topCloud = $derived(
    foliageCloud(seed * 200, 0.7 + hash(seed * 4.1) * 0.3),
  );

  // Gentle sway animation — slightly slower than cherry blossom
  let rootRef = $state<Group | undefined>();
  const swaySpeed = $derived(0.2 + hash(seed * 30) * 0.2);
  const swayPhase = $derived(hash(seed * 31) * Math.PI * 2);
  const swayAmplitude = $derived(0.012 + hash(seed * 32) * 0.012);
  let swayTime = 0;

  useTask((delta) => {
    swayTime += delta;
    if (rootRef) {
      rootRef.rotation.z =
        trunkLean +
        Math.sin(swayTime * swaySpeed + swayPhase) * swayAmplitude;
    }
  });
</script>

<T.Group bind:ref={rootRef}>
  <!-- Trunk — thicker oak/maple bark -->
  <T.Mesh position.y={trunkH / 2}>
    <T.CylinderGeometry args={[0.08, 0.16, trunkH, 7]} />
    <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
  </T.Mesh>

  <!-- Top canopy crown — large, wide, oblate -->
  <T.Group position.y={trunkH + 0.2} scale.y={0.5}>
    {#each topCloud as s}
      <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
        <T.SphereGeometry args={[s.r, 8, 6]} />
        <T.MeshStandardMaterial
          color={s.color}
          roughness={0.85}
        />
      </T.Mesh>
    {/each}
  </T.Group>

  <!-- Branches with foliage clusters -->
  {#each branches as branch, bi}
    <T.Group
      position.y={branchStartY + bi * 0.15}
      rotation.y={branch.yRot}
    >
      <T.Group rotation.z={branch.tilt}>
        <!-- Branch arm -->
        <T.Mesh position.y={branch.len / 2}>
          <T.CylinderGeometry
            args={[branch.rad * 0.5, branch.rad, branch.len, 5]}
          />
          <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
        </T.Mesh>

        <!-- Foliage cluster at branch tip — oblate spheroid -->
        <T.Group position.y={branch.len} scale.y={0.5}>
          {#each foliageCloud(branch.cloudSeed, branch.cloudR) as s}
            <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
              <T.SphereGeometry args={[s.r, 8, 6]} />
              <T.MeshStandardMaterial
                color={s.color}
                roughness={0.85}
              />
            </T.Mesh>
          {/each}
        </T.Group>

        <!-- Sub-branch -->
        {#if branch.hasSub}
          <T.Group
            position.y={branch.len * 0.6}
            rotation.y={branch.subYRot}
          >
            <T.Group rotation.z={branch.subTilt}>
              <T.Mesh position.y={branch.subLen / 2}>
                <T.CylinderGeometry
                  args={[branch.subRad * 0.5, branch.subRad, branch.subLen, 4]}
                />
                <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
              </T.Mesh>

              <!-- Sub-branch foliage cluster — oblate -->
              <T.Group position.y={branch.subLen} scale.y={0.5}>
                {#each foliageCloud(branch.subCloudSeed, branch.subCloudR) as s}
                  <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
                    <T.SphereGeometry args={[s.r, 7, 5]} />
                    <T.MeshStandardMaterial
                      color={s.color}
                      roughness={0.85}
                    />
                  </T.Mesh>
                {/each}
              </T.Group>
            </T.Group>
          </T.Group>
        {/if}
      </T.Group>
    </T.Group>
  {/each}
</T.Group>
