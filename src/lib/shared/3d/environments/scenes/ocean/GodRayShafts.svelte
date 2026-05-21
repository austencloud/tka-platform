<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from "three";
  import type { OceanGodRayShaftConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: OceanGodRayShaftConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying float vWorldY;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldY = worldPos.y;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    varying vec2 vUv;
    varying float vWorldY;

    void main() {
      // Soft gaussian-ish center fade — broad and gentle
      float cx = (vUv.x - 0.5) * 2.0;
      float centerFade = exp(-cx * cx * 2.0);

      // Gentle vertical fade — strongest in middle, fades at both ends
      float verticalFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.7, vUv.y);

      // Slow, layered shimmer for organic caustic-like variation
      float shimmer = 0.75 + 0.25 * sin(vWorldY * 1.5 + uTime * 0.8);
      shimmer *= 0.85 + 0.15 * sin(vWorldY * 3.5 - uTime * 0.5);

      float alpha = centerFade * verticalFade * shimmer * uIntensity;
      gl_FragColor = vec4(uColor * alpha, alpha * 0.4);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color() },
      uIntensity: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uColor!.value = new Color(config.color);
    material.uniforms.uIntensity!.value = config.intensity;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * config.speed * 5;
  });

  const shafts = $derived(
    Array.from({ length: config.count }, (_, i) => {
      const angle = (i / config.count) * Math.PI * 2 + 0.7;
      const radius = 5 + Math.sin(i * 2.3) * 4;
      const widthVariation = 0.7 + Math.sin(i * 3.1) * 0.3;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotY: angle + Math.PI * 0.5 + Math.sin(i * 1.3) * 0.3,
        tilt: 0.08 + Math.sin(i * 1.7) * 0.06,
        widthScale: widthVariation,
      };
    }),
  );
</script>

{#each shafts as shaft}
  <T.Mesh
    position.x={shaft.x}
    position.y={groundY + config.height * 0.5}
    position.z={shaft.z}
    rotation.y={shaft.rotY}
    rotation.z={shaft.tilt}
    {material}
  >
    <T.PlaneGeometry args={[config.width * shaft.widthScale, config.height]} />
  </T.Mesh>
{/each}
