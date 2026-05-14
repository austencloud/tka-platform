<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    CylinderGeometry,
    ShaderMaterial,
    AdditiveBlending,
    FrontSide,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    position: { x: number; z: number };
    radius?: number;
    height?: number;
    intensity?: number;
  }

  let {
    position,
    radius = 3.5,
    height = 6,
    intensity = 0.06,
  }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  let geometry = $state<CylinderGeometry | null>(null);

  $effect(() => {
    const geo = new CylinderGeometry(
      radius * 0.8,
      radius * 0.25,
      height,
      32,
      24,
      true,
    );
    geometry = geo;
    return () => geo.dispose();
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);

      vec3 pos = position;
      float wave = sin(pos.y * 3.0 + uTime * 2.0 + pos.x * 1.5) * 0.15
                 + sin(pos.y * 5.0 + uTime * 3.5 - pos.z * 2.0) * 0.08
                 + sin(pos.y * 8.0 + uTime * 1.8 + pos.x * 3.0) * 0.04;
      pos.x += wave * normal.x;
      pos.z += wave * normal.z;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform float uIntensity;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // Softer fresnel — visible at grazing angles but not a hard ring
      float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
      fresnel = pow(fresnel, 2.0);

      // Rising shimmer — turbulent, not streaky
      float n1 = noise(vec2(vUv.x * 8.0 + uTime * 0.3, vUv.y * 12.0 - uTime * 1.5));
      float n2 = noise(vec2(vUv.x * 4.0 + 7.0, vUv.y * 20.0 - uTime * 2.0));
      float n3 = noise(vec2(vUv.x * 12.0 - uTime * 0.5, vUv.y * 6.0 - uTime * 0.7));
      float shimmer = n1 * n2 + n3 * 0.15;
      shimmer = pow(clamp(shimmer, 0.0, 1.0), 2.0);

      // Aggressive bottom fade — no ground bleed; gentle top fade
      float vertFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);

      // Warm color — hotter at base, pale at top
      vec3 color = mix(vec3(1.0, 0.35, 0.08), vec3(0.9, 0.7, 0.5), vUv.y);

      float alpha = fresnel * shimmer * vertFade * uIntensity;

      gl_FragColor = vec4(color * alpha, alpha);
    }
  `;

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.06 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
  });

  $effect(() => {
    material.uniforms.uIntensity!.value = intensity;
  });

  onDestroy(() => {
    material.dispose();
  });
</script>

{#if geometry}
  <T.Mesh
    {geometry}
    {material}
    position.x={position.x}
    position.y={groundY + height / 2 + 1.0}
    position.z={position.z}
  />
{/if}
