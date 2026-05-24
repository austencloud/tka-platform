<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    AdditiveBlending,
    Color,
  } from "three";
  import type { NebulaConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: NebulaConfig;
  }

  let { config }: Props = $props();

  const geometry = new SphereGeometry(70, 32, 32);

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    uniform float uScale;
    uniform float uTime;
    varying vec3 vWorldPosition;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      vec3 samplePos = dir * uScale + vec3(uTime * 0.1, 0.0, uTime * 0.05);

      float n1 = snoise(samplePos * 1.5) * 0.5 + 0.5;
      float n2 = snoise(samplePos * 3.0 + 100.0) * 0.5 + 0.5;
      float combined = n1 * 0.7 + n2 * 0.3;
      combined = pow(combined, 1.5);

      vec3 color = mix(uColor1, uColor2, n2);
      float alpha = combined * uOpacity;

      float horizonFade = smoothstep(-0.1, 0.3, dir.y);
      alpha *= horizonFade;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  let time = 0;
  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uColor1: { value: new Color(config.color1) },
        uColor2: { value: new Color(config.color2) },
        uOpacity: { value: config.opacity },
        uScale: { value: config.scale },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    material = mat;
    return () => mat.dispose();
  });

  onDestroy(() => geometry.dispose());

  useTask((delta) => {
    if (!material) return;
    time += delta * config.animationSpeed;
    material.uniforms.uTime!.value = time;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uColor1!.value = new Color(config.color1);
    material.uniforms.uColor2!.value = new Color(config.color2);
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uScale!.value = config.scale;
  });
</script>

{#if config.enabled}
  <T.Mesh {geometry} {material} renderOrder={-0.5} frustumCulled={false} />
{/if}
