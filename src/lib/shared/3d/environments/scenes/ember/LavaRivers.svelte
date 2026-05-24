<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    PlaneGeometry,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
  } from "three";
  import type { LavaRiversConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: LavaRiversConfig;
    poolPosition: { x: number; z: number };
  }

  let { config, poolPosition }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Domain-warped directional flow shader with alpha-faded banks
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

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // Stretch UV along flow direction (U = length, V = width)
      vec2 uv = vec2(vUv.x * 6.0, vUv.y * 2.0 - 1.0);

      // Flow moves along U axis
      vec2 flowUv = uv + vec2(uTime * 0.3, 0.0);

      // Domain warping
      vec2 q = vec2(
        fbm(flowUv + vec2(0.0, 0.0)),
        fbm(flowUv + vec2(5.2, 1.3))
      );
      vec2 r = vec2(
        fbm(flowUv + uWarpIntensity * q + vec2(1.7, 9.2)),
        fbm(flowUv + uWarpIntensity * q + vec2(8.3, 2.8))
      );
      float f = fbm(flowUv + uWarpIntensity * r * 0.8);

      // Color
      float veinHeat = pow(length(r), 1.5);
      veinHeat = clamp(veinHeat * 0.8, 0.0, 1.0);

      vec3 color = mix(uCrustColor, uBaseColor, clamp(f * f * 4.0, 0.0, 1.0));
      color = mix(color, uHotColor, veinHeat * 0.6);

      float hotspot = pow(max(dot(normalize(q + 0.001), normalize(r + 0.001)), 0.0), 3.0);
      color += uHotColor * hotspot * 1.8;

      color *= 1.2;

      // Alpha: fade at width edges (banks) and length tip
      float bankFade = 1.0 - smoothstep(0.5, 1.0, abs(vUv.y - 0.5) * 2.0);
      bankFade = pow(bankFade, 0.7);
      float tipFade = smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));

      float alpha = bankFade * tipFade;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  interface RiverInstance {
    geometry: PlaneGeometry;
    material: ShaderMaterial;
    x: number;
    z: number;
    rotY: number;
    length: number;
  }

  let rivers = $state<RiverInstance[]>([]);

  $effect(() => {
    if (!config.enabled) {
      rivers = [];
      return;
    }

    const created = config.channels.map((ch) => {
      const w = config.width * ch.widthScale;
      const geometry = new PlaneGeometry(ch.length, w, 32, 4);
      const material = new ShaderMaterial({
        transparent: true,
        blending: AdditiveBlending,
        side: DoubleSide,
        depthWrite: false,
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

      const halfLen = ch.length / 2;
      const x = poolPosition.x + Math.cos(ch.angle) * halfLen;
      const z = poolPosition.z + Math.sin(ch.angle) * halfLen;
      const rotY = -ch.angle + Math.PI / 2;

      return { geometry, material, x, z, rotY, length: ch.length } as RiverInstance;
    });
    rivers = created;
    return () => {
      for (const river of created) {
        river.geometry.dispose();
        river.material.dispose();
      }
    };
  });

  useTask((delta) => {
    for (const river of rivers) {
      river.material.uniforms.uTime!.value += delta * config.flowSpeed * 8;
    }
  });
</script>

{#if config.enabled}
  {#each rivers as river}
    <T.Mesh
      geometry={river.geometry}
      material={river.material}
      position.x={river.x}
      position.y={groundY + 0.025}
      position.z={river.z}
      rotation.x={-Math.PI / 2}
      rotation.z={river.rotY}
    />
  {/each}
{/if}
