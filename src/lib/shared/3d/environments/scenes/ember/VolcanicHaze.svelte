<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    AdditiveBlending,
    Color,
    Vector2,
    Vector3,
    type Mesh,
  } from "three";
  import type { VolcanicHazeConfig } from "../../domain/models/scene-configs";
  import {
    sampleVolcanicLightning,
    volcanicLightningCell,
  } from "./volcanic-lightning";

  interface Props {
    config: VolcanicHazeConfig;
  }

  let { config }: Props = $props();
  const { camera } = useThrelte();
  let hazeMesh = $state<Mesh>();

  /** Horizontal bearing of the vent the low haze is lit by. */
  function underglowBearing(source: VolcanicHazeConfig): Vector2 {
    const [x, , z] = source.underglowDirection ?? [0, 0, 1];
    const bearing = new Vector2(x, z);
    return bearing.lengthSq() > 0 ? bearing.normalize() : new Vector2(0, 1);
  }

  let geometry = $state<SphereGeometry | undefined>(undefined);

  // The dome is depth-tested, so its radius is a hard boundary: terrain nearer
  // than the radius hides it, terrain further away is painted over additively.
  // At 260 that boundary fell inside the world and cut a visible shell across
  // the ridgelines — near hills went to fog, the ones just past the shell went
  // to sky. The radius has to clear the furthest terrain from any camera so the
  // dome is only ever sky and scene fog owns every metre of distance.
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
    uniform float uFlashEnergy;
    uniform vec3 uFlashCell;
    uniform float uLightningIntensity;
    uniform vec3 uInnerGlowColor;
    uniform vec3 uUnderglowColor;
    uniform vec2 uUnderglowBearing;
    uniform float uUnderglowStrength;
    uniform float uUnderglowFocus;
    uniform float uUnderglowWrap;
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

      // One eye-level profile shared by the wash, the cloud dissolve and the
      // underglow. Two lobes: a broad one that fills the low sky and a tighter
      // one that keeps the horizon itself the brightest part of the band. A
      // single lobe either smears the glow up the dome or draws a hard line
      // across it.
      float band = exp(-pow(abs(dir.y) * 3.1, 1.5)) * 0.62
        + exp(-pow(abs(dir.y) * 9.0, 1.6)) * 0.38;

      float lowAtmosphere = smoothstep(0.34, -0.32, dir.y);
      vec3 color = mix(uColor2, uColor1, lowAtmosphere * (0.5 + n2 * 0.32));

      // === Volcanic hemisphere glow ===
      // Lit from below — bottom hemisphere glows warmly
      float bottomGlow = smoothstep(0.1, -0.6, dir.y);
      // The dome has to carry the upper half of the frame, so cloud bodies
      // reach well past eye level before they fade out.
      float topFade = smoothstep(0.72, -0.28, dir.y);
      // Cut visible cloud bodies out of the noise instead of tinting the whole
      // dome evenly. Three averaged noise layers land near 0.42 with a spread
      // of roughly 0.1, so the band has to sit across that distribution or the
      // dome resolves to nothing at all. Across the horizon band the cut
      // dissolves back into the field: a hard-edged blob sitting on a ridgeline
      // is what made the glow read as pooled paint rather than lit air.
      float cloudBody = smoothstep(0.24, 0.64, combined);
      cloudBody = mix(cloudBody, 0.28 + combined * 0.36, band);
      float strata = 0.84 + snoise(
        vec3(dir.x * 7.0, dir.y * 1.4, dir.z * 7.0)
          + vec3(uTime * 0.018)
      ) * 0.16;
      float alpha = cloudBody * strata * uOpacity * topFade;

      // Horizon boost — volcanic glow at eye level
      float horizonBoost = band * 0.44;
      alpha += horizonBoost * uOpacity * (0.84 + combined * 0.16);

      // Warm underglow
      color = mix(color, vec3(0.46, 0.11, 0.015), bottomGlow * 0.42);

      // === Caldera underglow ===
      // A distant vent lights the low haze from one bearing. Without this the
      // dome is an even ring at eye level and the sky carries no direction.
      if (uUnderglowStrength > 0.0) {
        vec2 flatDir = vec2(dir.x, dir.z);
        float flatLength = length(flatDir);
        float bearing = flatLength > 0.0001
          ? dot(flatDir / flatLength, uUnderglowBearing) * 0.5 + 0.5
          : 0.5;
        // pow() is undefined for a negative base; rounding can push the dot
        // product a hair past -1.
        float lobe = pow(clamp(bearing, 0.0, 1.0), uUnderglowFocus);
        // The caldera lobe rides on a floor that reaches every bearing. With no
        // floor the half of the sky facing away from the vent received nothing
        // at all, which is what left the sky above the terminus a void.
        float lateral = mix(uUnderglowWrap, 1.0, lobe);
        float vertical = exp(-pow(max(dir.y, 0.0) * 3.2, 1.3)) * (0.62 + band * 0.38);
        // Light caught in layered haze still varies, but only enough to break
        // the gradient. Heavier noise here is what pooled the glow into blobs.
        float underglow = lateral * vertical * uUnderglowStrength
          * (0.82 + combined * 0.36);
        color += uUnderglowColor * underglow;
        alpha = clamp(alpha + underglow * 0.5, 0.0, 1.0);
      }

      // === Lightning flashes ===
      // The envelope is sampled on the CPU in real seconds; the dome only
      // decides where the flash sits.
      float flash = uFlashEnergy * uLightningIntensity;
      if (flash > 0.0) {
        float flashNoise = snoise(dir * 1.9 + uFlashCell);
        flash *= smoothstep(-0.25, 0.35, flashNoise);
      }

      color += uInnerGlowColor * flash;
      alpha = clamp(alpha + flash * 0.3, 0.0, 1.0);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  // Two clocks. `driftTime` is scaled so the cloud field crawls; `flashTime`
  // stays in real seconds so `lightningInterval` means seconds between strikes.
  let driftTime = 0;
  let flashTime = 0;
  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uColor1: { value: new Color(config.color1) },
        uColor2: { value: new Color(config.color2) },
        uOpacity: { value: config.opacity },
        uScale: { value: config.scale },
        uTime: { value: 0 },
        uFlashEnergy: { value: 0 },
        uFlashCell: { value: new Vector3() },
        uLightningIntensity: { value: config.lightningIntensity },
        uInnerGlowColor: { value: new Color(config.innerGlowColor) },
        uUnderglowColor: {
          value: new Color(config.underglowColor ?? config.innerGlowColor),
        },
        uUnderglowBearing: { value: underglowBearing(config) },
        uUnderglowStrength: { value: config.underglowStrength ?? 0 },
        uUnderglowFocus: { value: config.underglowFocus ?? 3.4 },
        uUnderglowWrap: { value: config.underglowWrap ?? 0 },
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
    driftTime += delta * config.animationSpeed;
    flashTime += delta;
    material.uniforms.uTime!.value = driftTime;

    const flash = sampleVolcanicLightning(flashTime, config.lightningInterval);
    material.uniforms.uFlashEnergy!.value = flash.energy;
    if (flash.energy > 0) {
      material.uniforms.uFlashCell!.value.set(
        ...volcanicLightningCell(flash.cycle)
      );
    }

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
    material.uniforms.uLightningIntensity!.value = config.lightningIntensity;
    material.uniforms.uInnerGlowColor!.value = new Color(config.innerGlowColor);
    material.uniforms.uUnderglowColor!.value = new Color(
      config.underglowColor ?? config.innerGlowColor
    );
    material.uniforms.uUnderglowBearing!.value = underglowBearing(config);
    material.uniforms.uUnderglowStrength!.value = config.underglowStrength ?? 0;
    material.uniforms.uUnderglowFocus!.value = config.underglowFocus ?? 3.4;
    material.uniforms.uUnderglowWrap!.value = config.underglowWrap ?? 0;
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
