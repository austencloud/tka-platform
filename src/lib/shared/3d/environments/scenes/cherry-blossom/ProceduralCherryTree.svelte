<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import type { Group } from "three";

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
    return canopyColors[
      Math.floor(hash(seed * 13 + i * 7.3) * canopyColors.length)
    ] ?? canopyColors[0]!;
  }

  interface BlossomSphere {
    x: number;
    y: number;
    z: number;
    r: number;
    color: string;
  }

  function blossomCloud(cloudSeed: number, baseR: number): BlossomSphere[] {
    return [
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
    ];
  }

  const trunkH = $derived(2.0 + hash(seed * 1.3) * 0.8);
  const trunkLean = $derived((hash(seed * 8.7) - 0.5) * 0.08);
  const branchStartY = $derived(trunkH * (0.55 + hash(seed * 2.7) * 0.15));

  interface Branch {
    yRot: number;
    tilt: number;
    len: number;
    rad: number;
    droopAngle: number;
    droopLen: number;
    cloudR: number;
    cloudSeed: number;
    hasSub: boolean;
    subYRot: number;
    subTilt: number;
    subLen: number;
    subRad: number;
    subDroopAngle: number;
    subCloudR: number;
    subCloudSeed: number;
  }

  const branches = $derived.by(() => {
    const count = 2 + Math.floor(hash(seed * 3.7) * 3);
    const result: Branch[] = [];
    for (let i = 0; i < count; i++) {
      const baseAngle =
        (i / count) * Math.PI * 2 + hash(seed + i) * 0.5;
      const tilt = 0.45 + hash(seed * 5 + i * 3.1) * 0.35;
      const len = 0.9 + hash(seed * 6 + i * 2.3) * 0.7;
      const hasSub = hash(seed * 9 + i) > 0.55;

      result.push({
        yRot: baseAngle,
        tilt,
        len,
        rad: 0.025 + hash(seed * 7 + i) * 0.02,
        droopAngle: -(tilt + 0.15 + hash(seed * 12 + i) * 0.2),
        droopLen: 0.3 + hash(seed * 13 + i) * 0.25,
        cloudR: 0.4 + hash(seed * 10 + i) * 0.25,
        cloudSeed: seed * 100 + i * 20,
        hasSub,
        subYRot: hash(seed * 14 + i) * Math.PI - Math.PI * 0.5,
        subTilt: 0.3 + hash(seed * 15 + i) * 0.3,
        subLen: 0.4 + hash(seed * 16 + i) * 0.35,
        subRad: 0.015 + hash(seed * 17 + i) * 0.01,
        subDroopAngle: -(0.3 + hash(seed * 15 + i) * 0.3 + 0.2),
        subCloudR: 0.3 + hash(seed * 18 + i) * 0.15,
        subCloudSeed: seed * 100 + i * 20 + 50,
      });
    }
    return result;
  });

  const topCloud = $derived(blossomCloud(seed * 200, 0.6 + hash(seed * 4.1) * 0.25));

  // Gentle sway animation
  let rootRef = $state<Group | undefined>();
  const swaySpeed = 0.3 + hash(seed * 30) * 0.25;
  const swayPhase = hash(seed * 31) * Math.PI * 2;
  const swayAmplitude = 0.015 + hash(seed * 32) * 0.015;
  let swayTime = 0;

  useTask((delta) => {
    swayTime += delta;
    if (rootRef) {
      rootRef.rotation.z =
        trunkLean + Math.sin(swayTime * swaySpeed + swayPhase) * swayAmplitude;
    }
  });
</script>

<T.Group bind:ref={rootRef}>
  <!-- Trunk -->
  <T.Mesh position.y={trunkH / 2}>
    <T.CylinderGeometry args={[0.05, 0.11, trunkH, 6]} />
    <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
  </T.Mesh>

  <!-- Top blossom cloud — crowning mass, oblate -->
  <T.Group position.y={trunkH + 0.15} scale.y={0.6}>
    {#each topCloud as s}
      <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
        <T.SphereGeometry args={[s.r, 7, 5]} />
        <T.MeshStandardMaterial
          color={s.color}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.75}
        />
      </T.Mesh>
    {/each}
  </T.Group>

  <!-- Branches with droop and blossom clouds -->
  {#each branches as branch, bi}
    <T.Group
      position.y={branchStartY + bi * 0.12}
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

        <!-- Droop at tip — curves back down under blossom weight -->
        <T.Group position.y={branch.len} rotation.z={branch.droopAngle}>
          <T.Mesh position.y={branch.droopLen / 2}>
            <T.CylinderGeometry
              args={[branch.rad * 0.3, branch.rad * 0.5, branch.droopLen, 4]}
            />
            <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
          </T.Mesh>

          <!-- Blossom cloud at drooped tip -->
          <T.Group position.y={branch.droopLen} scale.y={0.6}>
            {#each blossomCloud(branch.cloudSeed, branch.cloudR) as s}
              <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
                <T.SphereGeometry args={[s.r, 7, 5]} />
                <T.MeshStandardMaterial
                  color={s.color}
                  emissive={emissiveColor}
                  emissiveIntensity={emissiveIntensity * (0.85 + hash(seed * 20 + bi) * 0.3)}
                  roughness={0.75}
                />
              </T.Mesh>
            {/each}
          </T.Group>
        </T.Group>

        <!-- Sub-branch -->
        {#if branch.hasSub}
          <T.Group
            position.y={branch.len * 0.65}
            rotation.y={branch.subYRot}
          >
            <T.Group rotation.z={branch.subTilt}>
              <T.Mesh position.y={branch.subLen / 2}>
                <T.CylinderGeometry
                  args={[branch.subRad * 0.5, branch.subRad, branch.subLen, 4]}
                />
                <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
              </T.Mesh>

              <!-- Sub-branch droop -->
              <T.Group position.y={branch.subLen} rotation.z={branch.subDroopAngle}>
                <T.Mesh position.y={0.15}>
                  <T.CylinderGeometry args={[branch.subRad * 0.2, branch.subRad * 0.4, 0.3, 4]} />
                  <T.MeshStandardMaterial color={trunkColor} roughness={0.9} />
                </T.Mesh>

                <T.Group position.y={0.25} scale.y={0.55}>
                  {#each blossomCloud(branch.subCloudSeed, branch.subCloudR) as s}
                    <T.Mesh position.x={s.x} position.y={s.y} position.z={s.z}>
                      <T.SphereGeometry args={[s.r, 6, 4]} />
                      <T.MeshStandardMaterial
                        color={s.color}
                        emissive={emissiveColor}
                        emissiveIntensity={emissiveIntensity}
                        roughness={0.75}
                      />
                    </T.Mesh>
                  {/each}
                </T.Group>
              </T.Group>
            </T.Group>
          </T.Group>
        {/if}
      </T.Group>
    </T.Group>
  {/each}
</T.Group>
