<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { CircleGeometry, ShaderMaterial, Color, DoubleSide } from "three";
  import type { CloudPlatformConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: CloudPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  let geometry = $state<CircleGeometry | undefined>(undefined);

  $effect(() => {
    const geo = new CircleGeometry(config.radius, 64);
    geometry = geo;
    return () => geo.dispose();
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uGlowColor;
    uniform float uGlowIntensity;
    uniform float uNoiseScale;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p); p = p * 2.0 + vec2(100.0); a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = (vUv - 0.5) * uNoiseScale * 4.0;

      float n1 = fbm(uv + vec2(uTime * 0.3, uTime * 0.2));
      float n2 = fbm(uv * 0.7 - vec2(uTime * 0.2, -uTime * 0.15));
      float cloud = (n1 + n2) * 0.5;
      cloud = smoothstep(0.3, 0.7, cloud);

      vec3 color = vec3(0.95, 0.93, 0.88);
      color += uGlowColor * uGlowIntensity * cloud * 0.3;

      float highlight = smoothstep(0.6, 0.9, cloud);
      color += vec3(1.0, 0.98, 0.92) * highlight * 0.2;

      float dist = length(vUv - 0.5) * 2.0;
      float edgeFade = 1.0 - smoothstep(0.5, 1.0, dist);

      float rimZone = smoothstep(0.4, 0.8, dist) * (1.0 - smoothstep(0.8, 1.0, dist));
      color += uGlowColor * rimZone * uGlowIntensity * 0.5;

      float alpha = (0.6 + cloud * 0.4) * edgeFade;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGlowColor: { value: new Color(config.glowColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uNoiseScale: { value: config.noiseScale },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    material = mat;
    return () => mat.dispose();
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uGlowColor!.value = new Color(config.glowColor);
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
    material.uniforms.uNoiseScale!.value = config.noiseScale;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta * config.driftSpeed;
  });
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + 0.01}
  />
{/if}
