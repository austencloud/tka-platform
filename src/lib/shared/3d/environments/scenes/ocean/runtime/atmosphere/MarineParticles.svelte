<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Vector3,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";
  import vertexShader from "../../shaders/atmosphere/particle.vert?raw";
  import fragmentShader from "../../shaders/atmosphere/particle.frag?raw";

  const AREA_WIDTH = 30;
  const AREA_HEIGHT = 10;
  const AREA_DEPTH = 30;
  const CURRENT_DIRECTION: [number, number, number] = [0.02, -0.003, 0.01];

  interface Props {
    count?: number;
  }

  let { count = 4000 }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * AREA_WIDTH;
    positions[i * 3 + 1] = Math.pow(Math.random(), 2.5) * AREA_HEIGHT;
    positions[i * 3 + 2] = (Math.random() - 0.5) * AREA_DEPTH;
    phases[i] = Math.random() * 6.2832;
    sizes[i] = 0.015 + Math.random() * 0.045;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCurrentDir: { value: new Vector3(...CURRENT_DIRECTION) },
      uAreaWidth: { value: AREA_WIDTH },
      uAreaHeight: { value: AREA_HEIGHT },
      uAreaDepth: { value: AREA_DEPTH },
    },
    vertexShader,
    fragmentShader,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Points {geometry} {material} position.y={groundY} frustumCulled={false} />
