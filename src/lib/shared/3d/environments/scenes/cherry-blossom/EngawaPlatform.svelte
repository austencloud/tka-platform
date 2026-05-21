<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { CircleGeometry, ShaderMaterial, Color, DoubleSide } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { EngawaPlatformConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: EngawaPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const geometry = $derived.by(() => {
    return new CircleGeometry(config.radius, 128);
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
    uniform vec3 uPrimaryColor;
    uniform float uGlowIntensity;
    varying vec2 vUv;

    // --- Noise utilities ---
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered) * 2.0;

      // Discard outside the disc (anti-aliased edge)
      if (dist > 1.0) discard;

      // --- Wood grain ---
      // Stretch noise along one axis for directional grain lines
      vec2 grainUv = centered * 8.0;
      grainUv.x *= 0.4; // compress across-grain for tighter lines
      float grain = fbm(grainUv + vec2(0.0, uTime * 0.008));

      // Secondary finer grain layer
      float fineGrain = fbm(grainUv * 3.0 + vec2(50.0, uTime * 0.005));

      // Combine grain layers
      float woodPattern = grain * 0.7 + fineGrain * 0.3;

      // --- Base wood color ---
      vec3 baseColor = uPrimaryColor;
      // Darken in grain valleys, lighten on ridges
      vec3 darkWood = baseColor * 0.75;
      vec3 lightWood = baseColor * 1.15;
      vec3 woodColor = mix(darkWood, lightWood, woodPattern);

      // --- Polished specular highlight (fake view-approximation) ---
      // Center-biased bright spot simulating overhead light reflection
      float specDist = length(centered - vec2(0.05, 0.08));
      float specular = exp(-specDist * specDist * 12.0) * 0.15;
      woodColor += vec3(1.0, 0.95, 0.85) * specular;

      // --- Decorative border ring at ~90% radius ---
      float borderInner = smoothstep(0.86, 0.88, dist);
      float borderOuter = 1.0 - smoothstep(0.92, 0.94, dist);
      float borderMask = borderInner * borderOuter;
      vec3 borderColor = baseColor * 0.6; // darker inlaid wood
      woodColor = mix(woodColor, borderColor, borderMask * 0.8);

      // --- Subtle warm glow at outer rim ---
      float rimZone = smoothstep(0.85, 1.0, dist);
      vec3 rimGlow = vec3(0.95, 0.7, 0.3) * rimZone * uGlowIntensity * 0.4;
      woodColor += rimGlow;

      // --- Downstage indicator: warm amber dot at +Z edge ---
      // In UV space, +Z maps to bottom center (0.5, 0.0) after rotation
      vec2 lanternPos = vec2(0.0, -0.42);
      float lanternDist = length(centered - lanternPos);
      float lanternGlow = exp(-lanternDist * lanternDist * 200.0) * uGlowIntensity;
      vec3 lanternColor = vec3(1.0, 0.75, 0.3);
      woodColor += lanternColor * lanternGlow;

      // --- Soft edge fade for clean disc boundary ---
      float edgeSoftness = 1.0 - smoothstep(0.96, 1.0, dist);
      woodColor *= edgeSoftness;

      gl_FragColor = vec4(woodColor, 1.0);
    }
  `;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPrimaryColor: { value: new Color(config.primaryColor) },
        uGlowIntensity: { value: config.glowIntensity },
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
  });

  // Very slow grain shimmer — subtle life without visible motion
  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta * 0.3;
  });
</script>

{#if config.enabled}
  <!-- Cylindrical body — polished dark wood -->
  <T.Mesh position.y={groundY + config.height / 2}>
    <T.CylinderGeometry args={[config.radius, config.radius, config.height, 64]} />
    <T.MeshStandardMaterial
      color={config.primaryColor}
      roughness={0.6}
      metalness={0.1}
    />
  </T.Mesh>

  <!-- Top surface — shader wood grain disc -->
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />

  <!-- Border ring — darker frame at top edge -->
  <T.Mesh
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height + 0.005}
  >
    <T.TorusGeometry args={[config.radius * 0.95, 0.015, 12, 64]} />
    <T.MeshStandardMaterial
      color="#2a1a0e"
      roughness={0.4}
      metalness={0.15}
    />
  </T.Mesh>
{/if}
