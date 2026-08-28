<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    AdditiveBlending,
    Color,
    type Mesh,
  } from "three";
  import type { VolcanicHazeConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: VolcanicHazeConfig;
  }

  let { config }: Props = $props();
  const { camera } = useThrelte();
  let hazeMesh = $state<Mesh>();

  let geometry = $state<SphereGeometry | undefined>(undefined);

  $effect(() => {
    const nextGeometry = new SphereGeometry(config.radius, 32, 24);
    geometry = nextGeometry;
    return () => nextGeometry.dispose();
  });

  const vertexShader = /* glsl */ `
    varying vec3 vHazeDirection;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vHazeDirection = position;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    uniform float uScale;
    uniform float uTime;
    uniform float uLightningInterval;
    uniform float uLightningIntensity;
    uniform vec3 uInnerGlowColor;
    varying vec3 vHazeDirection;

    // 3D Simplex noise implementation
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
      vec3 dir = normalize(vHazeDirection);

      // === Multi-layer parallax ===
      // Layer 1: slow-moving deep clouds
      vec3 samplePos1 = dir * uScale + vec3(uTime * 0.06, 0.0, uTime * 0.03);
      float n1 = snoise(samplePos1 * 1.0) * 0.5 + 0.5;

      // Layer 2: faster mid-level detail
      vec3 samplePos2 = dir * uScale * 1.8 + vec3(uTime * 0.12, uTime * 0.02, uTime * 0.08);
      float n2 = snoise(samplePos2 * 1.5) * 0.5 + 0.5;

      // Layer 3: fine turbulence overlay
      vec3 samplePos3 = dir * uScale * 3.0 + vec3(-uTime * 0.04, uTime * 0.06, -uTime * 0.03);
      float n3 = snoise(samplePos3 * 2.5) * 0.5 + 0.5;

      // Combine with depth-weighted blending
      float combined = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
      combined = pow(combined, 1.25);

      vec3 color = mix(uColor1, uColor2, n2);

      // === Volcanic hemisphere glow ===
      // Lit from below — bottom hemisphere glows warmly
      float bottomGlow = smoothstep(0.1, -0.6, dir.y);
      float topFade = smoothstep(0.3, -0.15, dir.y);
      // Cut visible cloud bodies out of the noise instead of tinting the whole
      // dome evenly. The old low-contrast wash was the flat graybox ceiling.
      float cloudBody = smoothstep(0.18, 0.62, combined);
      float alpha = cloudBody * uOpacity * topFade;

      // Horizon boost — volcanic glow at eye level
      float horizonBoost = exp(-abs(dir.y) * 3.5) * 0.5;
      alpha += horizonBoost * uOpacity;

      // Warm underglow
      color = mix(color, vec3(0.5, 0.12, 0.0), bottomGlow * 0.6);

      // === Lightning flashes ===
      float flashCycle = mod(uTime / uLightningInterval, 1.0);
      float flash = 0.0;
      if (flashCycle < 0.03) {
        // Sharp flash — quick bright pulse
        flash = pow(1.0 - flashCycle / 0.03, 4.0) * uLightningIntensity;
        // Localize to a random-ish area using noise seeded by flash index
        float flashSeed = floor(uTime / uLightningInterval);
        float flashNoise = snoise(dir * 2.0 + vec3(flashSeed * 73.7, flashSeed * 41.3, flashSeed * 97.1));
        flash *= smoothstep(-0.2, 0.3, flashNoise);
      } else if (flashCycle < 0.08) {
        // Secondary afterglow — dimmer, broader
        float afterglow = pow(1.0 - (flashCycle - 0.03) / 0.05, 2.0) * uLightningIntensity * 0.3;
        float flashSeed = floor(uTime / uLightningInterval);
        float flashNoise = snoise(dir * 1.5 + vec3(flashSeed * 73.7, flashSeed * 41.3, flashSeed * 97.1));
        flash = afterglow * smoothstep(-0.3, 0.2, flashNoise);
      }

      color += uInnerGlowColor * flash;
      alpha = clamp(alpha + flash * 0.3, 0.0, 1.0);

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
        uLightningInterval: { value: config.lightningInterval },
        uLightningIntensity: { value: config.lightningIntensity },
        uInnerGlowColor: { value: new Color(config.innerGlowColor) },
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

  useTask((delta) => {
    if (!material) return;
    time += delta * config.animationSpeed;
    material.uniforms.uTime!.value = time;
    if (hazeMesh && camera.current) {
      hazeMesh.position.copy(camera.current.position);
    }
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uColor1!.value = new Color(config.color1);
    material.uniforms.uColor2!.value = new Color(config.color2);
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uScale!.value = config.scale;
    material.uniforms.uLightningInterval!.value = config.lightningInterval;
    material.uniforms.uLightningIntensity!.value = config.lightningIntensity;
    material.uniforms.uInnerGlowColor!.value = new Color(config.innerGlowColor);
  });
</script>

{#if config.enabled && geometry}
  <T.Mesh
    bind:ref={hazeMesh}
    {geometry}
    {material}
    renderOrder={-0.5}
    frustumCulled={false}
  />
{/if}
