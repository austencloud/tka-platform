<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    DoubleSide,
    Color,
    type BufferGeometry,
  } from "three";
  import type { LavaRiversConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { createLavaRiverStripGeometry } from "./lava-river-geometry";

  interface Props {
    config: LavaRiversConfig;
    poolPosition: { x: number; z: number };
  }

  let { config, poolPosition }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    #include <fog_pars_vertex>

    void main() {
      vUv = uv;
      vec3 pos = position;
      float bankWeight = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
      float travellingFold = sin(
        vUv.x * 22.0
        + sin(vUv.y * 6.28318) * 0.8
        - uTime * 1.45
      ) * 0.021;
      float convectionRoll = sin(
        vUv.x * 8.5
        - vUv.y * 5.0
        - uTime * 0.52
      ) * 0.013;
      pos.y += (travellingFold + convectionRoll) * bankWeight;
      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uHotColor;
    uniform vec3 uCrustColor;
    uniform float uWarpIntensity;
    uniform float uCrustCoverage;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    #include <fog_pars_fragment>

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
      float value = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = rotation * p * 2.03 + vec2(17.0, 31.0);
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      // U follows the authored downhill spline. Advecting the field toward +U
      // makes every crust plate travel from the distant vent toward the shelf.
      // The river is roughly sixty times longer than it is wide. Sampling the
      // old field at nearly square UV frequencies stretched every feature into
      // a neon stripe. This aspect-corrected domain produces rafted plates and
      // short molten seams at world scale.
      vec2 flowUv = vec2(vUv.x * 54.0 - uTime * 0.22, (vUv.y - 0.5) * 3.6);
      vec2 warp = vec2(
        fbm(flowUv * 0.78 + vec2(3.1, 7.7)),
        fbm(flowUv * 0.9 + vec2(11.2, 1.4))
      ) - 0.5;
      vec2 warpedUv = flowUv + warp * uWarpIntensity;

      float broadFlow = fbm(warpedUv * vec2(0.24, 0.92));
      float plateField = fbm(warpedUv * vec2(0.72, 1.18) + vec2(uTime * 0.018, 0.0));
      float bankDistance = abs(vUv.y - 0.5) * 2.0;
      float bankCooling = smoothstep(0.48, 0.98, bankDistance);
      float contactBreakup = noise(
        vec2(vUv.x * 84.0 - uTime * 0.026, vUv.y * 9.0)
      );
      float crustThreshold = 0.69
        - uCrustCoverage * 0.11
        - bankCooling * (0.085 + contactBreakup * 0.025);
      float crust = smoothstep(crustThreshold - 0.045, crustThreshold + 0.035, plateField);
      float fracture = 1.0 - smoothstep(0.018, 0.058, abs(plateField - crustThreshold));

      float center = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y - 0.5) * 2.0);
      float heat = clamp(broadFlow * 0.82 + fbm(warpedUv * 0.46 + 8.3) * 0.18, 0.0, 1.0);
      float convectionCell = smoothstep(
        0.68,
        0.92,
        fbm(warpedUv * vec2(0.3, 0.74) + vec2(uTime * 0.035, 19.0))
      );
      vec3 molten = mix(
        uBaseColor,
        uHotColor,
        pow(heat, 2.4) * (0.2 + center * 0.25)
          + convectionCell * (0.045 + center * 0.035)
      );

      vec3 surfaceNormal = normalize(cross(
        dFdx(vWorldPosition),
        dFdy(vWorldPosition)
      ));
      if (surfaceNormal.y < 0.0) surfaceNormal *= -1.0;
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      vec3 skyDirection = normalize(vec3(-0.42, 0.82, 0.38));
      float coolSky = 0.68 + max(dot(surfaceNormal, skyDirection), 0.0) * 0.34;
      float crustFresnel = pow(
        1.0 - max(dot(surfaceNormal, viewDirection), 0.0),
        4.0
      );

      // Open channels raft dark crust downstream. Brightness survives in the
      // seams between plates. Their cooled faces still catch the cold sky, so
      // they read as moving slabs instead of holes punched into an orange map.
      vec3 cooledCrust = mix(
        uCrustColor,
        vec3(0.062, 0.068, 0.07),
        0.72
      ) * (0.76 + broadFlow * 0.22) * coolSky;
      cooledCrust += vec3(0.055, 0.072, 0.078)
        * crustFresnel
        * (0.12 + broadFlow * 0.08);
      vec3 color = mix(molten, cooledCrust, crust * 0.985);
      color += uHotColor * fracture * (0.11 + center * 0.09);
      float medialLead = smoothstep(0.72, 0.92, fbm(warpedUv * vec2(0.38, 0.76) + 13.4));
      color += uHotColor * medialLead * pow(center, 3.0) * (1.0 - crust) * 0.1;
      color += uHotColor
        * convectionCell
        * (1.0 - crust)
        * (0.018 + center * 0.022);

      float bank = smoothstep(0.0, 0.13, vUv.y)
        * (1.0 - smoothstep(0.87, 1.0, vUv.y));
      vec3 bankShelf = mix(
        uCrustColor,
        vec3(0.05, 0.047, 0.044),
        0.76
      ) * (0.74 + contactBreakup * 0.14) * coolSky;
      color = mix(bankShelf, color, bank);
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `;

  interface RiverInstance {
    geometry: BufferGeometry;
    material: ShaderMaterial;
    lightPositions: { x: number; y: number; z: number }[];
  }

  let rivers = $state<RiverInstance[]>([]);

  $effect(() => {
    if (!config.enabled) {
      rivers = [];
      return;
    }

    const created = config.channels.map((channel) => {
      const { geometry, lightPositions } = createLavaRiverStripGeometry({
        channel,
        poolPosition,
        groundY,
        width: config.width,
      });
      const material = new ShaderMaterial({
        side: DoubleSide,
        depthWrite: true,
        fog: true,
        extensions: { derivatives: true },
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: new Color(config.baseColor) },
          uHotColor: { value: new Color(config.hotColor) },
          uCrustColor: { value: new Color(config.crustColor) },
          uWarpIntensity: { value: config.warpIntensity },
          uCrustCoverage: { value: config.crustCoverage },
        },
        vertexShader,
        fragmentShader,
      });
      return { geometry, material, lightPositions };
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
      river.material.uniforms.uTime!.value += delta * config.flowSpeed * 10;
    }
  });
</script>

{#if config.enabled}
  {#each rivers as river}
    <T.Mesh geometry={river.geometry} material={river.material} />
    {#each river.lightPositions as light, index}
      <T.PointLight
        position={[light.x, light.y + 0.7, light.z]}
        color={index % 2 === 0 ? config.hotColor : config.baseColor}
        intensity={index === river.lightPositions.length - 1 ? 92 : 64}
        distance={index === river.lightPositions.length - 1 ? 23 : 19}
        decay={2}
      />
    {/each}
  {/each}
{/if}
