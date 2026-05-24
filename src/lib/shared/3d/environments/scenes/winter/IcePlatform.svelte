<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { CircleGeometry, ShaderMaterial, Color, DoubleSide } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { IcePlatformConfig } from "../../domain/models/scene-configs";

  const RIM_THICKNESS = 0.025;

  interface Props {
    config: IcePlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  let geometry = $state<CircleGeometry | undefined>(undefined);

  $effect(() => {
    const geo = new CircleGeometry(config.radius, 128);
    geometry = geo;
    return () => geo.dispose();
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uPrimaryColor;
    uniform float uGlowIntensity;
    uniform float uFrostDensity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    // -- Noise primitives --
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p, int octaves) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    // Voronoi for crystalline crack/vein patterns
    vec2 voronoi(vec2 p) {
      vec2 n = floor(p);
      vec2 f = fract(p);
      float minDist = 8.0;
      float secondMin = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(43.12, 17.35)));
          o = 0.5 + 0.5 * sin(uTime * 0.08 + 6.2831 * o);
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < minDist) {
            secondMin = minDist;
            minDist = d;
          } else if (d < secondMin) {
            secondMin = d;
          }
        }
      }
      return vec2(sqrt(minDist), sqrt(secondMin));
    }

    void main() {
      // Centered UV: distance from center of disc
      vec2 centeredUv = (vUv - 0.5) * 2.0;
      float dist = length(centeredUv);

      // Discard fragments outside the disc radius (anti-aliased)
      if (dist > 1.0) discard;

      // -- Frost vein pattern via Voronoi edges --
      vec2 frostUv = centeredUv * uFrostDensity * 3.0;
      vec2 vor = voronoi(frostUv + uTime * 0.02);
      float veins = 1.0 - smoothstep(0.0, 0.12, vor.y - vor.x);

      // -- Large-scale frost swirls via FBM --
      vec2 driftUv = centeredUv * uFrostDensity * 2.0;
      float drift = fbm(driftUv + vec2(uTime * 0.015, uTime * 0.01), 5);
      float driftDetail = fbm(driftUv * 2.5 - vec2(uTime * 0.008, uTime * 0.012), 4);
      float frostSwirl = smoothstep(0.35, 0.65, drift) * 0.6 + smoothstep(0.4, 0.7, driftDetail) * 0.4;

      // -- Micro-crystal sparkle --
      float sparkleNoise = noise(centeredUv * uFrostDensity * 20.0 + uTime * 0.05);
      float sparkle = pow(sparkleNoise, 12.0) * 2.0;

      // -- Compose base color --
      vec3 deepIce = uPrimaryColor * 0.7;
      vec3 surfaceFrost = vec3(0.92, 0.95, 1.0);
      vec3 veinColor = mix(uPrimaryColor, vec3(0.8, 0.92, 1.0), 0.6);

      // Base: gradient from deep ice at center to frosted surface toward edges
      float depthGrad = smoothstep(0.0, 0.85, dist);
      vec3 baseColor = mix(deepIce, surfaceFrost, depthGrad * 0.5 + frostSwirl * 0.3);

      // Add frost veins (crystalline cracks)
      baseColor = mix(baseColor, veinColor, veins * 0.5);

      // Add frost swirl highlights
      baseColor += surfaceFrost * frostSwirl * 0.15;

      // Micro-sparkle highlights
      baseColor += vec3(1.0) * sparkle * 0.3;

      // -- Edge rim glow --
      float rimStart = 0.55;
      float rimFull = 0.95;
      float rim = smoothstep(rimStart, rimFull, dist);
      vec3 rimColor = uPrimaryColor * 1.4 + vec3(0.1, 0.15, 0.25);
      baseColor += rimColor * rim * uGlowIntensity * 0.8;

      // -- Downstage indicator: brighter triangular zone near +Z edge --
      // In UV space after rotation, +Z maps to the bottom of the disc (vUv.y ≈ 0)
      // The triangle points inward from the +Z edge
      float downstageAngle = atan(centeredUv.x, centeredUv.y);
      float downstageWedge = 1.0 - smoothstep(0.0, 0.5, abs(downstageAngle));
      float downstageDist = smoothstep(0.5, 0.95, centeredUv.y);
      float downstageGlow = downstageWedge * downstageDist;
      vec3 indicatorColor = mix(uPrimaryColor * 1.3, vec3(0.7, 0.85, 1.0), 0.5);
      baseColor += indicatorColor * downstageGlow * uGlowIntensity * 0.6;

      // -- Alpha: translucent center, more transparent at edges --
      float alpha = mix(0.85, 0.4, smoothstep(0.3, 1.0, dist));
      // Boost alpha slightly where frost veins are strong
      alpha += veins * 0.1;
      alpha = clamp(alpha, 0.0, 1.0);

      gl_FragColor = vec4(baseColor, alpha);
    }
  `;

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPrimaryColor: { value: new Color(config.primaryColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uFrostDensity: { value: config.frostDensity },
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
    material.uniforms.uPrimaryColor!.value = new Color(config.primaryColor);
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
    material.uniforms.uFrostDensity!.value = config.frostDensity;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta;
  });
</script>

{#if config.enabled}
  <!-- Translucent ice cylinder body -->
  <T.Mesh position.y={groundY + config.height / 2}>
    <T.CylinderGeometry args={[config.radius, config.radius, config.height, 64]} />
    <T.MeshPhysicalMaterial
      color={config.primaryColor}
      transmission={0.5}
      roughness={0.1}
      metalness={0.05}
      transparent
      opacity={0.7}
      emissive={config.primaryColor}
      emissiveIntensity={0.2}
    />
  </T.Mesh>

  <!-- Rim ring at top edge -->
  <T.Mesh rotation.x={-Math.PI / 2} position.y={groundY + config.height + 0.001}>
    <T.RingGeometry
      args={[config.radius - RIM_THICKNESS, config.radius + RIM_THICKNESS, 128]}
    />
    <T.MeshPhysicalMaterial
      color={config.primaryColor}
      emissive={config.primaryColor}
      emissiveIntensity={0.5}
      transparent
      opacity={0.85}
      roughness={0.05}
      metalness={0.1}
    />
  </T.Mesh>

  <!-- Frost shader top surface -->
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />
{/if}
