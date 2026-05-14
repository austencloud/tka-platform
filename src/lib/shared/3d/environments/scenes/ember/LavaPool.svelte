<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    Shape,
    ShapeGeometry,
    ShaderMaterial,
    DoubleSide,
    Color,
  } from "three";
  import type { LavaPoolConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: LavaPoolConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  function createPoolShape(radius: number, seed: number): Shape {
    const shape = new Shape();
    const pointCount = 20;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const jagged =
        Math.sin(i * 3.7 + seed) * 0.25 +
        Math.cos(i * 5.3 + seed * 1.5) * 0.15 +
        Math.sin(i * 7.1 + seed * 0.7) * 0.08 +
        Math.cos(i * 11.3 + seed * 2.1) * 0.05;
      const r = radius * (1 + jagged);
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    shape.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 0; i < pointCount; i++) {
      const p = pts[i]!;
      const pNext = pts[(i + 1) % pointCount]!;
      const pPrev = pts[(i - 1 + pointCount) % pointCount]!;
      const pPlus = pts[(i + 2) % pointCount]!;
      const c1 = {
        x: p.x + (pNext.x - pPrev.x) / 8,
        y: p.y + (pNext.y - pPrev.y) / 8,
      };
      const c2 = {
        x: pNext.x - (pPlus.x - p.x) / 8,
        y: pNext.y - (pPlus.y - p.y) / 8,
      };
      shape.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, pNext.x, pNext.y);
    }
    return shape;
  }

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Multi-wave surface undulation — sells molten liquid at oblique angles
      float wave = sin(pos.x * 2.3 + uTime * 0.8) * sin(pos.y * 1.7 + uTime * 0.6) * 0.5
                 + sin(pos.x * 3.1 - pos.y * 2.9 + uTime * 1.2) * 0.25
                 + sin(pos.x * 5.7 + pos.y * 4.3 + uTime * 0.9) * 0.125;
      pos.z += wave * 0.18;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Domain-warped FBM lava shader (Inigo Quilez technique)
  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uHotColor;
    uniform vec3 uCrustColor;
    uniform float uWarpIntensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // Rotated FBM — rotating each octave prevents axis-aligned artifacts
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = (vUv - 0.5) * 4.0;

      // === Domain warping (two layers) ===
      // First warp: sample FBM at two offset positions to create a warp vector
      vec2 q = vec2(
        fbm(uv + vec2(0.0, 0.0) + uTime * 0.12),
        fbm(uv + vec2(5.2, 1.3) + uTime * 0.1)
      );

      // Second warp: warp the warp — creates incredibly organic turbulence
      vec2 r = vec2(
        fbm(uv + uWarpIntensity * q + vec2(1.7, 9.2) + uTime * 0.07),
        fbm(uv + uWarpIntensity * q + vec2(8.3, 2.8) + uTime * 0.065)
      );

      // Final pattern: FBM at double-warped coordinates
      float f = fbm(uv + uWarpIntensity * r);

      // === Color mapping ===
      // Crust darkening based on primary warped field strength
      float crustMask = pow(length(q), 1.5);
      crustMask = clamp(crustMask, 0.0, 1.0);

      // Hot veins where secondary warp creates high displacement
      float veinHeat = pow(length(r), 1.8);
      veinHeat = clamp(veinHeat * 0.8, 0.0, 1.0);

      // Base lava color from warped noise
      vec3 color = mix(uCrustColor, uBaseColor, clamp(f * f * 4.0, 0.0, 1.0));

      // Bright magma veins
      color = mix(color, uHotColor, veinHeat * 0.7);

      // HDR-like hotspots where both warp fields align
      float hotspot = max(dot(normalize(q + 0.001), normalize(r + 0.001)), 0.0);
      hotspot = pow(hotspot, 4.0) * length(r);
      color += uHotColor * hotspot * 2.5;

      // Subtle crust chunks — darker areas that drift
      float crustChunks = smoothstep(0.4, 0.6, fbm(uv * 3.0 + uTime * 0.03));
      color = mix(color, uCrustColor, crustChunks * (1.0 - veinHeat) * 0.35);

      // Edge glow — lava brightest where it meets cooled rock
      float dist = length(vUv - 0.5) * 2.0;
      float rimGlow = smoothstep(0.6, 0.95, dist) * (1.0 - smoothstep(0.95, 1.0, dist));
      color += uHotColor * rimGlow * 0.4;

      // Very thin cooled-rock fringe at outer edge only
      float outerFringe = smoothstep(0.92, 1.0, dist);
      color = mix(color, uCrustColor, outerFringe * 0.5);

      // Emissive boost
      color *= 1.4;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  let geometry = $state<ShapeGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  $effect(() => {
    if (!config.enabled) {
      geometry = null;
      material = null;
      return;
    }

    const seed = config.position.x * 0.7 + config.position.z * 1.3;
    const shape = createPoolShape(config.radius, seed);
    const nextGeom = new ShapeGeometry(shape, 64);
    const nextMat = new ShaderMaterial({
      transparent: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(config.baseColor) },
        uHotColor: { value: new Color(config.hotColor) },
        uCrustColor: { value: new Color(config.crustColor) },
        uWarpIntensity: { value: config.warpIntensity },
      },
      vertexShader,
      fragmentShader,
    });

    geometry = nextGeom;
    material = nextMat;

    return () => {
      nextGeom.dispose();
      nextMat.dispose();
    };
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor!.value = new Color(config.baseColor);
    material.uniforms.uHotColor!.value = new Color(config.hotColor);
    material.uniforms.uCrustColor!.value = new Color(config.crustColor);
    material.uniforms.uWarpIntensity!.value = config.warpIntensity;
  });

  let lavaLightIntensity = $state(0);

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta * config.flowSpeed * 10;

    const t = performance.now() * 0.001 * config.pulseSpeed;
    const pulse = 0.85 + 0.15 * Math.sin(t * Math.PI * 2);
    lavaLightIntensity = config.lightIntensity * pulse;
  });
</script>

{#if config.enabled && geometry && material}
  <T.Mesh
    position.x={config.position.x}
    position.y={groundY - (config.craterDepth ?? 0) + 0.03}
    position.z={config.position.z}
    rotation.x={-Math.PI / 2}
    {geometry}
    {material}
  />
  <T.PointLight
    position.x={config.position.x}
    position.y={groundY + 0.5}
    position.z={config.position.z}
    color={config.hotColor}
    intensity={lavaLightIntensity}
    distance={config.lightDistance}
    decay={1.5}
  />
  <T.PointLight
    position.x={config.position.x + 2}
    position.y={groundY + 0.3}
    position.z={config.position.z - 1}
    color={config.baseColor}
    intensity={lavaLightIntensity * 0.4}
    distance={config.lightDistance * 0.6}
    decay={2}
  />
{/if}
