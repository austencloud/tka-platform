<script lang="ts">
  import { T, useTask, useLoader } from "@threlte/core";
  import {
    ShaderMaterial,
    TextureLoader,
    RepeatWrapping,
    SRGBColorSpace,
    Color,
    DoubleSide,
    type Texture,
  } from "three";
  import type {
    GroundConfig,
    LunarGroundConfig,
  } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    groundConfig: GroundConfig;
    veins: LunarGroundConfig;
  }

  let { groundConfig, veins }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const textureLoader = useLoader(TextureLoader);

  const diffuseTex = $derived(
    groundConfig.diffuseMap ? textureLoader.load(groundConfig.diffuseMap) : null
  );

  $effect(() => {
    const raw = diffuseTex ? $diffuseTex : undefined;
    const tex: Texture | null = raw ?? null;
    if (!tex || !material) return;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    const repeat = groundConfig.textureRepeat ?? 30;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    material.uniforms.uDiffuse!.value = tex;
    material.uniforms.uHasDiffuse!.value = true;
    material.needsUpdate = true;
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3  uVeinColor;
    uniform float uVeinIntensity;
    uniform float uVeinDensity;
    uniform sampler2D uDiffuse;
    uniform bool  uHasDiffuse;
    uniform float uGroundRadius;
    uniform vec3  uBioColor;
    uniform float uBioIntensity;
    uniform vec3  uFrostColor;
    uniform float uFrostIntensity;

    varying vec2  vUv;
    varying vec3  vWorldPos;
    varying vec3  vWorldNormal;
    varying vec3  vViewDir;

    // ── Noise helpers ──────────────────────────────────────────────────────────
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise2(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x  = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // FBM for organic patches
    float fbm(vec2 p, int octaves) {
      float val = 0.0;
      float amp = 0.5;
      float freq = 1.0;
      for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        val += amp * snoise2(p * freq);
        amp *= 0.5;
        freq *= 2.1;
      }
      return val;
    }

    // Voronoi for frost pattern
    vec2 hash22(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    float voronoiFrost(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float md = 1.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 n = vec2(float(x), float(y));
          vec2 o = hash22(i + n);
          vec2 r = n + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
      float edge = 1.0 - smoothstep(0.0, 0.08, sqrt(md));
      return edge;
    }

    // ── Layer: Vein network ────────────────────────────────────────────────────
    float veinPattern(vec2 p) {
      float n1 = snoise2(p);
      float n2 = snoise2(p * 2.1 + vec2(17.3, 83.7));
      float r1 = 1.0 - abs(n1);
      float r2 = 1.0 - abs(n2);
      r1 = pow(max(r1, 0.0), 14.0);
      r2 = pow(max(r2, 0.0), 10.0);
      return r1 + r2 * 0.45;
    }

    // ── Layer: Craters ─────────────────────────────────────────────────────────
    vec2 craterHash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453);
    }

    vec2 craterField(vec2 p) {
      float interior = 0.0;
      float rim = 0.0;
      for (int i = 0; i < 12; i++) {
        vec2 seed = craterHash(vec2(float(i) * 73.17, float(i) * 41.31));
        float angle = seed.x * 6.2831;
        float dist = 6.0 + seed.y * 18.0;
        vec2 center = vec2(cos(angle), sin(angle)) * dist;
        float radius = 0.8 + seed.x * seed.y * 2.5;
        float d = length(p - center);
        float nd = d / radius;
        float bowl = 1.0 - smoothstep(0.0, 0.85, nd);
        interior = max(interior, bowl * 0.35);
        float rimRing = smoothstep(0.75, 0.92, nd) * (1.0 - smoothstep(0.92, 1.15, nd));
        rim = max(rim, rimRing);
      }
      return vec2(interior, rim);
    }

    void main() {
      // ── L1: Base regolith (world-space sampled) ──────────────────────────────
      vec2 worldUV = vWorldPos.xz * 0.05;
      vec4 baseColor;
      if (uHasDiffuse) {
        baseColor = texture2D(uDiffuse, worldUV);
        baseColor.rgb *= 0.7;
      } else {
        baseColor = vec4(0.12, 0.10, 0.16, 1.0);
      }

      float r = length(vWorldPos.xz);

      // ── L7: Craters (integrated with base) ──────────────────────────────────
      vec2 crater = craterField(vWorldPos.xz);
      baseColor.rgb *= (1.0 - crater.x);
      baseColor.rgb += vec3(0.08, 0.08, 0.12) * crater.y;

      // ── Zone mask for veins and bioluminescence ──────────────────────────────
      float centerFade = smoothstep(2.5, 6.0, r);
      float edgeFade   = 1.0 - smoothstep(22.0, uGroundRadius, r);
      float zoneMask   = centerFade * edgeFade;

      // ── L2: Crystal vein network ─────────────────────────────────────────────
      vec2 noiseCoord = vWorldPos.xz * uVeinDensity * 0.08 + vec2(uTime * 0.04, uTime * 0.03);
      float vein = veinPattern(noiseCoord) * zoneMask;
      vein += crater.y * 0.4 * zoneMask;

      const float PI = 3.14159265358979;
      float pulse = 1.0 + sin(uTime * PI) * 0.3;
      vec3 veinEmissive = uVeinColor * vein * uVeinIntensity * pulse;

      // ── L3: Bioluminescent patches ───────────────────────────────────────────
      float bioNoise = fbm(vWorldPos.xz * 0.15 + vec2(uTime * 0.01, 0.0), 4);
      float bioPatch = smoothstep(0.25, 0.55, bioNoise) * (1.0 - smoothstep(0.55, 0.8, bioNoise));
      float bioMask = smoothstep(5.0, 10.0, r) * (1.0 - smoothstep(22.0, 28.0, r));
      float bioPulse = 0.6 + 0.4 * sin(uTime * 0.8 + r * 0.3);
      vec3 bioEmissive = uBioColor * bioPatch * bioMask * uBioIntensity * bioPulse;

      // ── L4: Frost/sublimation near crystal bases ─────────────────────────────
      float frostVoronoi = voronoiFrost(vWorldPos.xz * 3.0);
      float frostMask = smoothstep(5.0, 8.0, r) * (1.0 - smoothstep(16.0, 22.0, r));
      float frostNoise = smoothstep(0.2, 0.6, fbm(vWorldPos.xz * 0.5, 3));
      vec3 frostColor = uFrostColor * frostVoronoi * frostMask * frostNoise * uFrostIntensity;
      baseColor.rgb = mix(baseColor.rgb, baseColor.rgb + frostColor, 0.5);

      // ── L5: Dust variation ───────────────────────────────────────────────────
      float dustNoise = snoise2(vWorldPos.xz * 0.03 + vec2(7.7, 13.3));
      baseColor.rgb *= 0.85 + 0.15 * dustNoise;

      // ── L6: Micro-sparkle ────────────────────────────────────────────────────
      float sparkleNoise = snoise2(vWorldPos.xz * 40.0);
      float sparkleMask = pow(max(sparkleNoise, 0.0), 20.0);
      float viewAngle = max(dot(vWorldNormal, vViewDir), 0.0);
      vec3 sparkle = vec3(0.4, 0.5, 0.7) * sparkleMask * viewAngle * 0.6;

      // ── Composite ────────────────────────────────────────────────────────────
      vec3 finalColor = baseColor.rgb + veinEmissive + bioEmissive + sparkle;

      gl_FragColor = vec4(finalColor, baseColor.a);
    }
  `;

  let material = $state<ShaderMaterial | null>(null);

  $effect(() => {
    if (!veins.enabled) {
      material = null;
      return;
    }

    const mat = new ShaderMaterial({
      transparent: groundConfig.opacity !== undefined && groundConfig.opacity < 1,
      depthWrite: true,
      side: DoubleSide,
      uniforms: {
        uTime:           { value: 0 },
        uVeinColor:      { value: new Color(veins.veinColor) },
        uVeinIntensity:  { value: veins.veinIntensity },
        uVeinDensity:    { value: veins.veinDensity },
        uDiffuse:        { value: null },
        uHasDiffuse:     { value: false },
        uGroundRadius:   { value: groundConfig.size },
        uBioColor:       { value: new Color(veins.bioColor ?? veins.veinColor) },
        uBioIntensity:   { value: veins.bioIntensity ?? 0.3 },
        uFrostColor:     { value: new Color(veins.frostColor ?? '#aaccff') },
        uFrostIntensity: { value: veins.frostIntensity ?? 0.4 },
      },
      vertexShader,
      fragmentShader,
    });

    material = mat;
    return () => { mat.dispose(); };
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uVeinColor!.value      = new Color(veins.veinColor);
    material.uniforms.uVeinIntensity!.value   = veins.veinIntensity;
    material.uniforms.uVeinDensity!.value     = veins.veinDensity;
    material.uniforms.uGroundRadius!.value    = groundConfig.size;
    material.uniforms.uBioColor!.value        = new Color(veins.bioColor ?? veins.veinColor);
    material.uniforms.uBioIntensity!.value    = veins.bioIntensity ?? 0.3;
    material.uniforms.uFrostColor!.value      = new Color(veins.frostColor ?? '#aaccff');
    material.uniforms.uFrostIntensity!.value  = veins.frostIntensity ?? 0.4;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta * veins.veinPulseSpeed;
  });
</script>

{#if veins.enabled && material}
  <T.Group position={[0, groundY, 0]}>
    <T.Mesh rotation.x={-Math.PI / 2} {material}>
      <T.CircleGeometry args={[groundConfig.size, 64]} />
    </T.Mesh>
  </T.Group>
{/if}
