<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { SphereGeometry, ShaderMaterial, BackSide, Color, Vector3 } from "three";
  import type { CloudDomeConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: CloudDomeConfig;
  }

  let { config }: Props = $props();

  const geometry = new SphereGeometry(50, 48, 48);

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uDensity;
    uniform float uCoverage;
    uniform float uOpacity;
    uniform vec3 uSunDirection;
    uniform vec3 uLitColor;
    uniform vec3 uShadowColor;
    varying vec3 vWorldPosition;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                     mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                     mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      vec3 shift = vec3(100.0);
      for (int i = 0; i < 6; i++) {
        v += a * noise3D(p);
        p = p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 pos = vWorldPosition * 0.06;
      vec3 samplePos = pos + vec3(uTime * 0.5, 0.0, uTime * 0.3);

      float n = fbm(samplePos);
      float cloudShape = smoothstep(uCoverage, uCoverage + 0.25, n);

      float h = normalize(vWorldPosition).y;
      float heightMask = smoothstep(0.0, 0.3, h) * smoothstep(0.95, 0.6, h);
      cloudShape *= heightMask;

      vec3 normal = normalize(vWorldPosition);
      float sunDot = dot(normal, normalize(uSunDirection));
      float lighting = sunDot * 0.5 + 0.5;
      lighting = pow(lighting, 1.5);

      vec3 color = mix(uShadowColor, uLitColor, lighting);

      float rim = pow(1.0 - abs(dot(normal, normalize(cameraPosition - vWorldPosition))), 3.0);
      color += vec3(1.0, 0.95, 0.85) * rim * 0.4;

      float alpha = cloudShape * uDensity * uOpacity;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  let time = 0;

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const sunDir = new Vector3(
      config.sunDirection[0],
      config.sunDirection[1],
      config.sunDirection[2],
    );
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDensity: { value: config.density },
        uCoverage: { value: config.coverage },
        uOpacity: { value: config.opacity },
        uSunDirection: { value: sunDir },
        uLitColor: { value: new Color(config.litColor) },
        uShadowColor: { value: new Color(config.shadowColor) },
      },
      vertexShader,
      fragmentShader,
      side: BackSide,
      transparent: true,
      depthWrite: false,
    });
    material = mat;
    return () => mat.dispose();
  });

  onDestroy(() => geometry.dispose());

  useTask((delta) => {
    if (!material) return;
    time += delta * config.driftSpeed;
    material.uniforms.uTime!.value = time;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uDensity!.value = config.density;
    material.uniforms.uCoverage!.value = config.coverage;
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uSunDirection!.value = new Vector3(
      config.sunDirection[0],
      config.sunDirection[1],
      config.sunDirection[2],
    );
    material.uniforms.uLitColor!.value = new Color(config.litColor);
    material.uniforms.uShadowColor!.value = new Color(config.shadowColor);
  });
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    position.y={-2}
    renderOrder={0}
    frustumCulled={false}
  />
{/if}
