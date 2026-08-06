<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
    PlaneGeometry,
    InstancedMesh,
    InstancedBufferAttribute,
    Matrix4,
    Vector3,
    Quaternion,
    Euler,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";
  import vertexShader from "../../shaders/atmosphere/god-ray.vert?raw";
  import fragmentShader from "../../shaders/atmosphere/god-ray.frag?raw";
  import { oceanDebugToggles } from "../../quality/ocean-debug-toggles.svelte";

  // ── Config ─────────────────────────────────────────────────────────────
  const COUNT = 14;
  const INTENSITY = 0.3; // gentle (moody mid-depth target)
  const WIDTH = 3.5;
  const HEIGHT = 18;
  const SPEED = 0.3;

  // One coherent sun: shafts lean toward the directional light at [10,30,-20]
  // (same vector OceanRuntimeSystems uses), tinted to the sun color, with tops
  // anchored to the water plane. World-space geometry — discrete light columns
  // that physically cannot become a screen-space haze.
  const SUN_POS = new Vector3(10, 30, -20);
  const WATER_Y = 12; // matches WaterSurface (groundY + 12)
  const LEAN = 0.26; // base column lean toward the sun, radians
  // Lean axis = horizontal axis perpendicular to the sun's ground azimuth, so
  // every column tips the same way (toward the sun) regardless of its Y spin.
  const SUN_AZ = Math.atan2(SUN_POS.x, SUN_POS.z);
  const LEAN_AXIS = new Vector3(Math.cos(SUN_AZ), 0, -Math.sin(SUN_AZ)).normalize();

  interface Props {
    halfRes?: boolean;
    worldYOffset?: number;
  }

  let { halfRes = false, worldYOffset = 0 }: Props = $props();

  const localGroundY = $derived(userProportionsState.groundY);
  const worldGroundY = $derived(localGroundY + worldYOffset);

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new Color("#ffffdd") }, // sun color at the surface
      uColorBottom: { value: new Color("#bcd6e6") }, // cooler where the shaft fades into depth
      uIntensity: { value: INTENSITY },
      uHeight: { value: HEIGHT },
      uGroundY: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  let instancedMesh = $state<InstancedMesh | null>(null);

  $effect(() => {
    const geo = new PlaneGeometry(WIDTH, HEIGHT);
    const rng = seededRandom(777);

    const opacities = new Float32Array(COUNT);
    const inst = new InstancedMesh(geo, material, COUNT);
    inst.frustumCulled = false;

    const mat = new Matrix4();
    const q = new Quaternion();
    const spinQ = new Quaternion();
    const leanQ = new Quaternion();
    const s = new Vector3(1, 1, 1);
    const pos = new Vector3();
    const euler = new Euler();

    for (let i = 0; i < COUNT; i++) {
      const x = (rng() - 0.5) * 22;
      const z = (rng() - 0.5) * 22;
      const rotY = rng() * Math.PI * 2;
      const widthScale = 0.5 + rng() * 0.8;
      opacities[i] = 0.4 + rng() * 0.6;

      // Each column keeps its own Y spin (so the planes face many ways and read
      // as a volume), then all tip toward the one sun by LEAN (+ small jitter).
      euler.set(0, rotY, 0);
      spinQ.setFromEuler(euler);
      leanQ.setFromAxisAngle(LEAN_AXIS, LEAN + (rng() - 0.5) * 0.08);
      q.copy(leanQ).multiply(spinQ);

      s.set(widthScale, 1, 1);
      // Anchor the shaft TOP to the water plane (groundY + WATER_Y): center sits
      // half a height below it, so the column descends from the surface.
      pos.set(x, localGroundY + WATER_Y - HEIGHT * 0.5, z);
      mat.compose(pos, q, s);
      inst.setMatrixAt(i, mat);
    }

    inst.instanceMatrix.needsUpdate = true;
    geo.setAttribute(
      "aOpacityMult",
      new InstancedBufferAttribute(opacities, 1),
    );

    instancedMesh = inst;

    return () => {
      geo.dispose();
      inst.dispose();
    };
  });

  $effect(() => {
    material.uniforms.uGroundY!.value = worldGroundY;
  });

  // Dev A/B toggle — zero intensity when shafts are off (no rebuild).
  $effect(() => {
    material.uniforms.uIntensity!.value = oceanDebugToggles.godRayShafts ? INTENSITY : 0;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * SPEED * 5;
  });

  onDestroy(() => {
    material.dispose();
  });
</script>

{#if instancedMesh}
  <T is={instancedMesh} />
{/if}
