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

  // ── Hardcoded config (abyss variant) ──────────────────────────────────
  const COUNT = 14;
  const RAY_COLOR = "#b8d8e8";
  const INTENSITY = 0.4;
  const WIDTH = 3.5;
  const HEIGHT = 18;
  const SPEED = 0.3;

  interface Props {
    halfRes?: boolean;
  }

  let { halfRes = false }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

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
      uColorTop: { value: new Color("#d4e8f0") },
      uColorBottom: { value: new Color(RAY_COLOR) },
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
    const s = new Vector3(1, 1, 1);
    const pos = new Vector3();
    const euler = new Euler();

    for (let i = 0; i < COUNT; i++) {
      const x = (rng() - 0.5) * 22;
      const z = (rng() - 0.5) * 22;
      const rotY = rng() * Math.PI * 2;
      const tilt = 0.04 + rng() * 0.12;
      const widthScale = 0.5 + rng() * 0.8;
      opacities[i] = 0.4 + rng() * 0.6;

      euler.set(0, rotY, tilt);
      q.setFromEuler(euler);
      s.set(widthScale, 1, 1);
      pos.set(x, groundY + HEIGHT * 0.5, z);
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
    material.uniforms.uGroundY!.value = groundY;
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
