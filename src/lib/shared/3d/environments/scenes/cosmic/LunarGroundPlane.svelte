<script lang="ts">
  /**
   * LunarGroundPlane
   *
   * Custom ground plane for the Cosmic scene. Layers a PBR rock texture
   * underneath a ShaderMaterial that renders an animated energy vein network
   * using 2D simplex noise ridge detection. Veins fade near the platform
   * center (r < 5 m) and at the ground edge (r > 25 m), and pulse gently
   * over time.
   */

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

  // ── Texture loading ──────────────────────────────────────────────────────────

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

  // ── Shaders ──────────────────────────────────────────────────────────────────

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  // 2D Simplex noise — Stefan Gustavson's implementation (public domain)
  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3  uVeinColor;
    uniform float uVeinIntensity;
    uniform float uVeinDensity;
    uniform sampler2D uDiffuse;
    uniform bool  uHasDiffuse;
    uniform float uGroundRadius;

    varying vec2  vUv;
    varying vec3  vWorldPos;

    // ── Permutation helpers ──────────────────────────────────────────────────
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    // ── 2D Simplex noise ─────────────────────────────────────────────────────
    float snoise2(vec2 v) {
      const vec4 C = vec4(
        0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
        0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
       -0.577350269189626,   // -1.0 + 2.0 * C.x
        0.024390243902439    // 1.0 / 41.0
      );

      // Skew input space to determine which simplex cell we're in
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v   - i + dot(i, C.xx);

      // Determine which simplex triangle we're in
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);

      // Offsets for second and third corners
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;

      i = mod289(i);
      vec3 p = permute(
        permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
      );

      // Gradients — 41 points uniformly over a circle
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;

      vec3 x  = 2.0 * fract(p * C.www) - 1.0;
      vec3 h  = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;

      // Normalise gradients implicitly by scaling m
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

      // Compute the final noise value
      vec3 g;
      g.x  = a0.x  * x0.x   + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;

      return 130.0 * dot(m, g);
    }

    // ── Ridge / vein detection ───────────────────────────────────────────────
    // Returns a thin bright ridge wherever |noise| is near 0, raised to a high
    // power so only the narrowest crests survive. Layering two octaves produces
    // a branching organic network without hard repetition.
    float veinPattern(vec2 p) {
      float n1 = snoise2(p);
      float n2 = snoise2(p * 2.1 + vec2(17.3, 83.7));

      // Ridge = 1 - |noise|. High power = thin bright line.
      float r1 = 1.0 - abs(n1);
      float r2 = 1.0 - abs(n2);
      r1 = pow(max(r1, 0.0), 14.0);
      r2 = pow(max(r2, 0.0), 10.0);

      return r1 + r2 * 0.45;
    }

    void main() {
      // ── Sample base texture or solid color ──────────────────────────────────
      vec4 baseColor;
      if (uHasDiffuse) {
        baseColor = texture2D(uDiffuse, vUv);
      } else {
        baseColor = vec4(0.12, 0.10, 0.16, 1.0);
      }

      // ── Radial distance from the world origin (platform center) ─────────────
      float r = length(vWorldPos.xz);

      // Veins are suppressed within 5 m of the platform center (r < 5)
      // and beyond 25 m toward the edge (r > 25)
      float centerFade = smoothstep(2.5, 6.0, r);
      float edgeFade   = 1.0 - smoothstep(22.0, uGroundRadius, r);
      float zoneMask   = centerFade * edgeFade;

      // ── Animated vein network ───────────────────────────────────────────────
      // Scale world-space XZ by veinDensity. Slow drift on time axis.
      vec2 noiseCoord = vWorldPos.xz * uVeinDensity * 0.08 + vec2(uTime * 0.04, uTime * 0.03);
      float vein = veinPattern(noiseCoord) * zoneMask;

      // Gentle sinusoidal pulse (never goes dark, just breathes 30 %)
      const float PI = 3.14159265358979;
      float pulse = 1.0 + sin(uTime * PI) * 0.3;

      // ── Composite ───────────────────────────────────────────────────────────
      vec3 emissiveAdd = uVeinColor * vein * uVeinIntensity * pulse;
      vec3 finalColor  = baseColor.rgb + emissiveAdd;

      gl_FragColor = vec4(finalColor, baseColor.a);
    }
  `;

  // ── Material lifecycle ───────────────────────────────────────────────────────

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
        uTime:         { value: 0 },
        uVeinColor:    { value: new Color(veins.veinColor) },
        uVeinIntensity:{ value: veins.veinIntensity },
        uVeinDensity:  { value: veins.veinDensity },
        uDiffuse:      { value: null },
        uHasDiffuse:   { value: false },
        uGroundRadius: { value: groundConfig.size },
      },
      vertexShader,
      fragmentShader,
    });

    material = mat;

    return () => {
      mat.dispose();
    };
  });

  // Sync config-driven uniforms reactively (no re-allocation needed)
  $effect(() => {
    if (!material) return;
    material.uniforms.uVeinColor!.value    = new Color(veins.veinColor);
    material.uniforms.uVeinIntensity!.value = veins.veinIntensity;
    material.uniforms.uVeinDensity!.value   = veins.veinDensity;
    material.uniforms.uGroundRadius!.value  = groundConfig.size;
  });

  // ── Animation loop ───────────────────────────────────────────────────────────

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
