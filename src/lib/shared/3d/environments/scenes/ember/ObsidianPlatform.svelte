<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { CircleGeometry, ShaderMaterial, Color, DoubleSide } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { ObsidianPlatformConfig } from "../../domain/models/scene-configs";

  const RIM_THICKNESS = 0.025;

  interface Props {
    config: ObsidianPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const geometry = $derived.by(() => {
    return new CircleGeometry(config.radius, 6);
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec2 vWorldXZ;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldXZ = worldPos.xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uPrimaryColor;
    uniform float uGlowIntensity;
    uniform float uCrackIntensity;
    uniform float uLavaSpeed;
    varying vec2 vUv;
    varying vec2 vWorldXZ;

    // --- Hash for voronoi cell jitter ---
    vec2 hash2(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    // --- Voronoi: returns (F1, F2) distances for crack extraction ---
    vec2 voronoi(vec2 p) {
      vec2 n = floor(p);
      vec2 f = fract(p);
      float f1 = 8.0;
      float f2 = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          // Slight time-driven drift so cracks feel alive
          o = 0.5 + 0.4 * sin(uTime * 0.08 + 6.2831 * o);
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
      return vec2(sqrt(f1), sqrt(f2));
    }

    // --- Simple value noise for surface detail ---
    float hash1(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash1(i), hash1(i + vec2(1.0, 0.0)), f.x),
        mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.0 + vec2(17.0, 31.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // Centered UV for radial calculations
      vec2 centeredUv = (vUv - 0.5) * 2.0;
      float dist = length(centeredUv);

      // Scale UV for voronoi pattern
      vec2 voronoiUv = centeredUv * 4.5;

      // Primary crack network
      vec2 v1 = voronoi(voronoiUv);
      float crackEdge1 = v1.y - v1.x;

      // Secondary finer crack network at different scale
      vec2 v2 = voronoi(voronoiUv * 2.1 + vec2(73.0, 41.0));
      float crackEdge2 = v2.y - v2.x;

      // Tertiary micro-cracks for detail
      vec2 v3 = voronoi(voronoiUv * 4.7 + vec2(150.0, 200.0));
      float crackEdge3 = v3.y - v3.x;

      // Crack lines — thresholded from cell boundary distance
      float crack1 = 1.0 - smoothstep(0.0, 0.07, crackEdge1);
      float crack2 = 1.0 - smoothstep(0.0, 0.05, crackEdge2);
      float crack3 = 1.0 - smoothstep(0.0, 0.03, crackEdge3);

      // Wider glow halo around primary cracks
      float crackGlow1 = 1.0 - smoothstep(0.0, 0.22, crackEdge1);
      float crackGlow2 = 1.0 - smoothstep(0.0, 0.15, crackEdge2);

      // Combine crack layers — primary dominates, finer adds texture
      float combinedCrack = crack1 + crack2 * 0.5 + crack3 * 0.2;
      combinedCrack = clamp(combinedCrack, 0.0, 1.0);

      float combinedGlow = crackGlow1 + crackGlow2 * 0.4;
      combinedGlow = clamp(combinedGlow, 0.0, 1.0);

      // --- Lava pulse animation ---
      float slowPulse = sin(uTime * uLavaSpeed * 1.5) * 0.5 + 0.5;
      slowPulse = mix(0.6, 1.0, slowPulse);

      // Traveling wave that radiates outward
      float wave = sin(dist * 6.0 - uTime * uLavaSpeed * 2.5) * 0.5 + 0.5;
      wave = pow(wave, 2.0);

      float lavaIntensity = slowPulse * (1.0 + wave * 0.4) * uCrackIntensity;

      // --- Downstage brightness boost ---
      // +Z is downstage in the scene; vUv.y maps to this after rotation
      // centeredUv.y > 0 corresponds to +Z (downstage)
      float downstageFactor = 1.0 + smoothstep(-0.2, 0.8, centeredUv.y) * 0.5;

      // --- Lava color ---
      vec3 lavaColorCore = vec3(1.0, 0.35, 0.05);  // bright orange
      vec3 lavaColorHot  = vec3(1.0, 0.7, 0.2);    // yellow-hot
      vec3 lavaColorDim  = vec3(0.8, 0.15, 0.02);   // deep red ember

      // Mix lava color based on crack intensity — hottest at crack center
      vec3 lavaColor = mix(lavaColorDim, lavaColorCore, combinedCrack);
      lavaColor = mix(lavaColor, lavaColorHot, combinedCrack * combinedCrack);

      // --- Obsidian base surface ---
      // Subtle surface variation via fbm
      float surfaceNoise = fbm(voronoiUv * 1.5 + vec2(50.0)) * 0.15;
      vec3 obsidianBase = uPrimaryColor * (0.85 + surfaceNoise);

      // Glassy highlight bands — obsidian has a vitreous luster
      float glassHighlight = fbm(voronoiUv * 3.0 + vec2(uTime * 0.02, 0.0));
      glassHighlight = smoothstep(0.55, 0.7, glassHighlight) * 0.08;
      obsidianBase += vec3(glassHighlight);

      // --- Composite: obsidian base + lava in cracks ---
      // Crack contribution with pulse, downstage boost, and glow intensity
      float crackEmission = (combinedCrack * 1.2 + combinedGlow * 0.3)
                            * lavaIntensity
                            * downstageFactor
                            * uGlowIntensity;

      vec3 finalColor = obsidianBase;
      finalColor += lavaColor * crackEmission;

      // Subsurface glow: faint lava light bleeds through obsidian near cracks
      float subsurface = combinedGlow * 0.15 * lavaIntensity * uGlowIntensity;
      finalColor += lavaColorDim * subsurface;

      // --- Edge heat shimmer ---
      float rimZone = smoothstep(0.5, 0.9, dist);
      vec3 rimColor = vec3(1.0, 0.4, 0.1) * rimZone * uGlowIntensity * 0.25;
      // Rim flickers with noise
      float rimFlicker = vnoise(centeredUv * 8.0 + uTime * 0.5) * 0.5 + 0.5;
      rimColor *= rimFlicker;
      finalColor += rimColor;

      // --- Hard edge clip for hex shape ---
      // CircleGeometry handles shape, but soften the very edge slightly
      float edgeSoften = 1.0 - smoothstep(0.88, 1.0, dist);
      finalColor *= edgeSoften;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPrimaryColor: { value: new Color(config.primaryColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uCrackIntensity: { value: config.crackIntensity },
        uLavaSpeed: { value: config.lavaSpeed },
      },
      vertexShader,
      fragmentShader,
      transparent: false,
      side: DoubleSide,
    });
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uPrimaryColor!.value = new Color(config.primaryColor);
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
    material.uniforms.uCrackIntensity!.value = config.crackIntensity;
    material.uniforms.uLavaSpeed!.value = config.lavaSpeed;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta;
  });
</script>

{#if config.enabled}
  <!-- Dark obsidian hexagonal body -->
  <T.Mesh position.y={groundY + config.height / 2}>
    <T.CylinderGeometry args={[config.radius, config.radius, config.height, 6]} />
    <T.MeshStandardMaterial
      color="#0a0a0a"
      roughness={0.3}
      metalness={0.7}
      emissive="#ff3300"
      emissiveIntensity={0.05}
    />
  </T.Mesh>

  <!-- Emissive lava-orange rim ring at top edge -->
  <T.Mesh rotation.x={-Math.PI / 2} position.y={groundY + config.height + 0.001}>
    <T.RingGeometry args={[config.radius - RIM_THICKNESS, config.radius + RIM_THICKNESS, 6]} />
    <T.MeshStandardMaterial
      color="#ff4400"
      emissive="#ff3300"
      emissiveIntensity={1.2}
      roughness={0.2}
      metalness={0.5}
    />
  </T.Mesh>

  <!-- Lava-crack shader top surface -->
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />
{/if}
