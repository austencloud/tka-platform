<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from "three";
  import type { PrismaticCausticsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: PrismaticCausticsConfig;
    groundSize: number;
  }

  let { config, groundSize }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uScale;
    uniform vec3  uBaseColor;
    uniform float uSpectrumShift;

    varying vec2 vUv;
    varying vec3 vWorldPos;

    // Hash for Voronoi cell centres
    vec2 hash22(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    // HSL to RGB conversion
    vec3 hsl2rgb(float h, float s, float l) {
      vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
    }

    // Voronoi with cell ID for spectral coloring
    vec3 prismaticVoronoi(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float md = 8.0;
      float md2 = 8.0;
      vec2 cellId = vec2(0.0);

      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 n = vec2(float(x), float(y));
          vec2 o = hash22(i + n);
          o = 0.5 + 0.5 * sin(uTime * 0.6 + 6.2831 * o);
          vec2 r = n + o - f;
          float d = dot(r, r);
          if (d < md) {
            md2 = md;
            md = d;
            cellId = i + n;
          } else if (d < md2) {
            md2 = d;
          }
        }
      }

      float edge = md2 - md;
      float hue = fract(dot(cellId, vec2(0.1731, 0.3257)) + uTime * uSpectrumShift);
      vec3 spectrumColor = hsl2rgb(hue, 0.7, 0.55);

      return vec3(sqrt(md), edge, 0.0) + spectrumColor * 0.001;
    }

    void main() {
      vec2 worldUV = vWorldPos.xz * 0.1 * uScale;

      // Three overlapping Voronoi layers at different scales
      vec2 p1 = worldUV + vec2(uTime * 0.08, uTime * 0.04);
      vec2 p2 = worldUV * 1.5 + vec2(-uTime * 0.06, uTime * 0.1) + 3.7;
      vec2 p3 = worldUV * 0.6 + vec2(uTime * 0.05, -uTime * 0.07) + 7.3;

      vec3 v1 = prismaticVoronoi(p1);
      vec3 v2 = prismaticVoronoi(p2);
      vec3 v3 = prismaticVoronoi(p3);

      // Caustic pattern from distances
      float pattern = v1.x * v2.x + v3.x * 0.3;
      pattern = pow(1.0 - pattern, 3.5);

      // Spectral color from cell hues
      float hue1 = fract(dot(floor(worldUV + vec2(uTime * 0.08, uTime * 0.04)), vec2(0.1731, 0.3257)) + uTime * uSpectrumShift);
      float hue2 = fract(hue1 + 0.33);
      float hue3 = fract(hue1 + 0.67);
      vec3 specColor = hsl2rgb(hue1, 0.6, 0.5) * v1.y +
                        hsl2rgb(hue2, 0.5, 0.45) * v2.y * 0.6 +
                        hsl2rgb(hue3, 0.4, 0.4) * v3.y * 0.3;

      // Blend base color with spectral
      vec3 color = mix(uBaseColor, specColor, 0.7) * pattern;

      // Radial fade — stronger near centre (where crystals are), fades at edges
      float dist = length(vWorldPos.xz);
      float innerFade = smoothstep(3.0, 8.0, dist);
      float outerFade = 1.0 - smoothstep(20.0, 30.0, dist);
      float radialMask = innerFade * outerFade;

      float alpha = clamp(pattern * uIntensity * radialMask, 0.0, 1.0);

      gl_FragColor = vec4(color * alpha, alpha * 0.6);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uScale: { value: 0 },
      uBaseColor: { value: new Color() },
      uSpectrumShift: { value: 0.02 },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uBaseColor!.value = new Color(config.baseColor);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uScale!.value = config.scale;
    material.uniforms.uSpectrumShift!.value = config.spectrumShift;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * config.speed;
  });
</script>

{#if config.enabled}
  <T.Mesh
    position.y={groundY + 0.03}
    rotation.x={-Math.PI / 2}
    {material}
  >
    <T.PlaneGeometry args={[groundSize * 0.75, groundSize * 0.75]} />
  </T.Mesh>
{/if}
