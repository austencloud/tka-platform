<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { ShaderMaterial, DoubleSide, Color } from "three";
  import type { OceanWaterSurfaceConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: OceanWaterSurfaceConfig;
    size?: number;
  }

  let { config, size = 50 }: Props = $props();

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uWaveScale;
    uniform float uWaveSpeed;
    uniform float uWaveAmplitude;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      vUv = uv;
      vec3 pos = position;

      float wave1 = sin(pos.x * uWaveScale + uTime * uWaveSpeed) * uWaveAmplitude;
      float wave2 = sin(pos.z * uWaveScale * 0.7 + uTime * uWaveSpeed * 1.3) * uWaveAmplitude * 0.6;
      float wave3 = sin((pos.x + pos.z) * uWaveScale * 0.5 + uTime * uWaveSpeed * 0.8) * uWaveAmplitude * 0.4;

      pos.y += wave1 + wave2 + wave3;
      vDisplacement = wave1 + wave2 + wave3;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      float edgeFade = 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));

      float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.3;

      float ripple = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 35.0 - uTime * 1.5) * 0.1;

      float alpha = (uOpacity + highlight + ripple) * edgeFade;
      vec3 color = uColor + vec3(highlight * 0.5);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uWaveScale: { value: 0 },
      uWaveSpeed: { value: 0 },
      uWaveAmplitude: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uColor!.value = new Color(config.color);
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uWaveScale!.value = config.waveScale;
    material.uniforms.uWaveSpeed!.value = config.waveSpeed;
    material.uniforms.uWaveAmplitude!.value = config.waveAmplitude;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
  });
</script>

<T.Mesh
  position.y={config.height}
  rotation.x={-Math.PI / 2}
  {material}
>
  <T.PlaneGeometry args={[size, size, 32, 32]} />
</T.Mesh>
