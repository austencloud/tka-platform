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
      float centerFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
      centerFade = pow(centerFade, 2.5);

      float verticalFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);

      float shimmer = 0.7 + 0.3 * sin(vWorldY * 3.0 + uTime * 1.5);
      shimmer *= 0.8 + 0.2 * sin(vWorldY * 7.0 - uTime * 0.8);

      float alpha = centerFade * verticalFade * shimmer * uIntensity;
      gl_FragColor = vec4(uColor * alpha, alpha * 0.6);
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
      const radius = 6 + Math.sin(i * 2.3) * 3;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotY: angle + Math.PI * 0.5,
        tilt: 0.15 + Math.sin(i * 1.7) * 0.1,
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
    <T.PlaneGeometry args={[config.width, config.height]} />
  </T.Mesh>
{/each}
