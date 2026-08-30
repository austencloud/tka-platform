<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    DoubleSide,
    Color,
    UniformsLib,
    UniformsUtils,
    type BufferGeometry,
  } from "three";
  import type { LavaRiversConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    createLavaRiverStripGeometry,
    LAVA_RIVER_BANK_MARGIN_FRACTION,
  } from "./lava-river-geometry";

  interface Props {
    config: LavaRiversConfig;
    poolPosition: { x: number; z: number };
  }

  let { config, poolPosition }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const DEFAULT_BANK_LIGHT = {
    count: 3,
    intensity: 58,
    distance: 30,
    heightOffset: 2.6,
  } as const;

  const vertexShader = /* glsl */ `
    uniform float uTime;
    attribute float aCross;
    attribute float aFlow;
    varying float vCross;
    varying float vFlow;
    varying vec3 vWorldPosition;
    #include <fog_pars_vertex>

    void main() {
      vCross = aCross;
      vFlow = aFlow;
      vec3 pos = position;
      // Metres, not curve parameter: the control points are spaced 8 to 31
      // apart, so a parameter-space wave stretched four-fold along the reach.
      float bankWeight = clamp(1.0 - aCross * aCross, 0.0, 1.0);
      float travellingFold = sin(
        aFlow * 0.51
        + sin(aCross * 3.14159265) * 0.8
        - uTime * 1.45
      ) * 0.034;
      float convectionRoll = sin(
        aFlow * 0.197
        - aCross * 2.5
        - uTime * 0.52
      ) * 0.018;
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
    uniform vec3 uLeveeColor;
    uniform float uWarpIntensity;
    uniform float uCrustCoverage;
    uniform float uEdgeCooling;
    uniform float uBankRadiance;
    uniform float uMarginFraction;
    varying float vCross;
    varying float vFlow;
    varying vec3 vWorldPosition;
    #include <fog_pars_fragment>

    // sin() based hashes lose their gradient once the advected domain grows past
    // a few thousand, which on a long session turned the crust into banding, and
    // low-precision sin on mobile GPUs made it worse. This one stays stable.
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
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
      // Derivatives are taken before any discard so the surviving fragments in a
      // quad never read a killed neighbour.
      vec3 surfaceNormal = normalize(cross(
        dFdx(vWorldPosition),
        dFdy(vWorldPosition)
      ));
      if (surfaceNormal.y < 0.0) surfaceNormal *= -1.0;
      float footprint = fwidth(vFlow);
      float lod = smoothstep(0.14, 1.3, footprint);

      float bank = abs(vCross);
      float side = vCross < 0.0 ? -1.0 : 1.0;

      // Where the chilled margin meets the molten channel, wandering on two
      // incommensurate world wavelengths: eleven-metre lobes and two-metre
      // scallops. The term this replaced ran on a lattice whose lateral period
      // matched the strip's column count, so its cells read as rectangular
      // bites out of the shore.
      float shoreLobe = fbm(vec2(vFlow * 0.091, side * 5.31 + 2.7));
      float shoreScallop = fbm(vec2(vFlow * 0.384, side * 11.13 + 41.0));
      float shoreContour = shoreLobe * 0.62 + shoreScallop * 0.38;

      // Distance narrows the incandescent thread rather than letting the crust
      // pattern average out into one saturated band.
      float coolingReach = uEdgeCooling * mix(1.0, 1.34, lod);
      float shoreLine = 1.0 - coolingReach + (shoreContour - 0.5) * 0.46;
      float chill = smoothstep(shoreLine - 0.2, shoreLine + 0.3, bank);

      // The surface always terminates inside the margin the geometry reserved,
      // so its straight polygon edge is never the silhouette.
      float cut = 1.0 + uMarginFraction
        * (0.06 + 0.92 * (shoreScallop * 0.6 + shoreLobe * 0.4));
      if (bank > cut) discard;

      vec2 flowUv = vec2(vFlow * 0.199 - uTime * 0.22, vCross * 1.8);
      vec2 warp = vec2(
        fbm(flowUv * 0.78 + vec2(3.1, 7.7)),
        fbm(flowUv * 0.9 + vec2(11.2, 1.4))
      ) - 0.5;
      vec2 warpedUv = flowUv + warp * uWarpIntensity;

      // A reach is tens of metres long. Real channels skin over for a stretch
      // and tear open again at a bend; without that the ribbon reads as one
      // uniform band at every viewing distance.
      float reach = fbm(vec2(vFlow * 0.0281, 3.3));

      float broadFlow = fbm(warpedUv * vec2(0.24, 0.92));
      float plateField = fbm(warpedUv * vec2(0.72, 1.18) + vec2(uTime * 0.018, 0.0));
      float crustThreshold = 0.705
        - uCrustCoverage * 0.09
        + (reach - 0.5) * 0.13
        - chill * 0.1;
      float crustEdge = mix(0.045, 0.15, lod);
      float crust = smoothstep(
        crustThreshold - crustEdge,
        crustThreshold + crustEdge * 0.8,
        plateField
      );
      float fracture = (1.0 - smoothstep(0.018, 0.058, abs(plateField - crustThreshold)))
        * (1.0 - lod * 0.75);

      float center = 1.0 - smoothstep(0.0, 1.0, bank);
      float heat = clamp(broadFlow * 0.82 + fbm(warpedUv * 0.46 + 8.3) * 0.18, 0.0, 1.0);
      float convectionCell = smoothstep(
        0.68,
        0.92,
        fbm(warpedUv * vec2(0.3, 0.74) + vec2(uTime * 0.035, 19.0))
      );

      // A skin forms and tears continuously over open lava. It carries the
      // internal value range that keeps the molten field from resolving to a
      // single saturated colour once the plates are too small to see.
      float skin = smoothstep(
        0.4,
        0.8,
        fbm(warpedUv * vec2(1.35, 2.1) + vec2(-uTime * 0.05, 63.0))
      );
      float skinDepth = skin * (0.42 + chill * 0.34) * (1.0 - lod * 0.45);

      vec3 molten = mix(
        uBaseColor,
        uHotColor,
        pow(heat, 1.85) * (0.22 + center * 0.38)
          + convectionCell * (0.06 + center * 0.06)
      );
      molten *= mix(1.0, 0.34, skinDepth);
      // Emission falls off across the channel: an axial thread with cooling
      // shoulders, not a slab held at one temperature edge to edge.
      molten *= mix(1.0, 0.2, chill) * (0.78 + reach * 0.4);

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
      vec3 color = mix(molten, cooledCrust, crust * 0.91);

      float open = 1.0 - chill;
      color += uHotColor * fracture * (0.28 + center * 0.22) * open;
      float medialLead = smoothstep(0.72, 0.92, fbm(warpedUv * vec2(0.38, 0.76) + 13.4));
      float travellingLead = smoothstep(
        0.68,
        0.9,
        fbm(warpedUv * vec2(0.46, 0.82) + vec2(-uTime * 0.09, 27.0))
      );
      color += uHotColor * medialLead * pow(center, 2.4) * (1.0 - crust) * 0.18 * open;
      color += uHotColor * travellingLead * fracture * (0.08 + center * 0.1) * open;
      color += uHotColor
        * convectionCell
        * (1.0 - crust)
        * (0.028 + center * 0.035)
        * open;

      // Static levee: solid rock the channel is running between, not a painted
      // border. It carries the radiance the channel throws onto it, falling off
      // outward, which is what makes the shore read as a lit surface rather than
      // a cut edge.
      float leveeGrain = fbm(vec2(vFlow * 0.62, side * 7.7 + 19.0));
      vec3 levee = mix(uLeveeColor, vec3(0.032, 0.028, 0.026), 0.42)
        * (0.72 + leveeGrain * 0.5)
        * coolSky;
      // Radiance integrates over a stretch of channel, so it follows the
      // reach-scale openness rather than whichever plate happens to sit under
      // this fragment — and the levee is heavily crusted by definition.
      float openness = clamp(0.25 + reach * 0.75 + (broadFlow - 0.5) * 0.4, 0.0, 1.0);
      float outward = clamp(
        (bank - shoreLine) / max(uMarginFraction + coolingReach, 0.001),
        0.0,
        1.0
      );
      float spill = uBankRadiance * openness * pow(1.0 - outward, 2.2);
      levee += uBaseColor * spill * 0.9 + uHotColor * spill * spill * 0.35;
      color = mix(color, levee, chill);

      // The contact itself is the brightest thing on the bank.
      float contactOffset = (bank - shoreLine) * 7.0;
      float contact = exp(-contactOffset * contactOffset);
      color += uHotColor
        * contact
        * openness
        * (0.1 + uBankRadiance * 0.16)
        * (1.0 - lod * 0.4);

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
  const bankLight = $derived({ ...DEFAULT_BANK_LIGHT, ...config.bankLight });

  $effect(() => {
    if (!config.enabled) {
      rivers = [];
      return;
    }

    const marginFraction =
      config.bankMarginFraction ?? LAVA_RIVER_BANK_MARGIN_FRACTION;
    const created = config.channels.map((channel) => {
      const { geometry, lightPositions } = createLavaRiverStripGeometry({
        channel,
        poolPosition,
        groundY,
        width: config.width,
        bankMarginFraction: marginFraction,
        bankPlunge: config.bankPlunge,
        lightCount: bankLight.count,
      });
      const material = new ShaderMaterial({
        side: DoubleSide,
        depthWrite: true,
        fog: true,
        extensions: { derivatives: true },
        // The strip lies in a carved bed that is close to coplanar with it, so
        // single terrain triangles could win the depth test and punch blocky
        // holes in the surface.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
        uniforms: {
          // fog: true makes the renderer refresh fogColor/fogDensity on this
          // material, so the fog uniform set must exist or the render crashes.
          ...UniformsUtils.clone(UniformsLib.fog),
          uTime: { value: 0 },
          uBaseColor: { value: new Color(config.baseColor) },
          uHotColor: { value: new Color(config.hotColor) },
          uCrustColor: { value: new Color(config.crustColor) },
          uLeveeColor: {
            value: new Color(config.leveeColor ?? config.crustColor),
          },
          uWarpIntensity: { value: config.warpIntensity },
          uCrustCoverage: { value: config.crustCoverage },
          uEdgeCooling: { value: config.edgeCooling ?? 0.34 },
          uBankRadiance: { value: config.bankRadiance ?? 0.5 },
          uMarginFraction: { value: marginFraction },
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
      <!-- These sit well above the channel on purpose. Close to the surface a
           point light lays a hard disc on the flat bank, which reads as a
           flashlight rather than as radiance off the lava. -->
      <T.PointLight
        position={[light.x, light.y + bankLight.heightOffset, light.z]}
        color={index % 2 === 0 ? config.hotColor : config.baseColor}
        intensity={bankLight.intensity}
        distance={bankLight.distance}
        decay={2}
      />
    {/each}
  {/each}
{/if}
