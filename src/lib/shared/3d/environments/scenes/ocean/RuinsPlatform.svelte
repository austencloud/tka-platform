<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    BoxGeometry,
    PlaneGeometry,
    CylinderGeometry,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { RuinsPlatformConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: RuinsPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const elevation = $derived(config.elevation ?? 0);

  const bodyGeometry = $derived.by(
    () => new BoxGeometry(config.width, config.height, config.depth),
  );
  const topGeometry = $derived.by(
    () => new PlaneGeometry(config.width, config.depth),
  );
  const columnGeometry = $derived.by(
    () => new CylinderGeometry(0.12, 0.15, 0.6, 8),
  );
  const supportPillarGeometry = $derived.by(() => {
    if (elevation <= 0) return null;
    return new CylinderGeometry(0.2, 0.35, elevation, 8);
  });

  const columns = $derived.by(() => {
    const count = config.columnCount;
    if (count === 0) return [];
    const hw = config.width * 0.46;
    const hd = config.depth * 0.46;
    const corners: [number, number][] = [
      [-hw, -hd], [-hw, hd], [hw, -hd], [hw, hd],
    ];
    const result: { x: number; z: number; scaleY: number }[] = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      const [cx, cz] = corners[i]!;
      result.push({ x: cx, z: cz, scaleY: (0.3 + ((i * 0.17) % 0.4)) / 0.6 });
    }
    if (count > 4) {
      const midpoints: [number, number][] = [
        [0, -hd], [0, hd], [-hw, 0], [hw, 0],
        [-hw * 0.5, -hd], [hw * 0.5, -hd], [-hw * 0.5, hd], [hw * 0.5, hd],
      ];
      for (let i = 0; i < count - 4 && i < midpoints.length; i++) {
        const [mx, mz] = midpoints[i]!;
        result.push({ x: mx, z: mz, scaleY: (0.25 + ((i * 0.13) % 0.35)) / 0.6 });
      }
    }
    return result;
  });

  const supportPillars = $derived.by(() => {
    if (elevation <= 0) return [];
    const hw = config.width * 0.4;
    const hd = config.depth * 0.4;
    return [
      { x: -hw, z: -hd },
      { x: -hw, z: hd },
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: 0, z: -hd },
      { x: 0, z: hd },
    ];
  });

  const noiseGlsl = /* glsl */ `
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    vec2 hash2(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
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
    vec2 voronoi2(vec2 p) {
      vec2 ci = floor(p); vec2 cf = fract(p);
      float f1 = 8.0, f2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(ci + g);
        o = 0.5 + 0.4 * sin(6.2831 * o + 2.0);
        vec2 r = g + o - cf;
        float dd = dot(r, r);
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
      }
      return vec2(sqrt(f1), sqrt(f2));
    }
  `;

  // Body: smooth weathered stone with soft moss gradient
  const bodyVertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const bodyFragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uStoneColor;
    uniform float uMossIntensity;
    varying vec2 vUv;
    varying vec3 vPos;

    ${noiseGlsl}

    void main() {
      vec2 p = vec2(vUv.x * 8.0, vPos.y * 6.0);

      // Smooth stone with gentle color variation
      float stoneN = fbm(p * 1.5 + 5.0);
      vec3 lightStone = uStoneColor + vec3(0.06, 0.07, 0.08);
      vec3 stoneColor = mix(uStoneColor, lightStone, stoneN);

      // Soft moss — gradient from bottom up, not patchy blobs
      float mossGrad = smoothstep(-0.2, 0.3, vPos.y / 0.5);
      float mossNoise = fbm(p * 1.0 + vec2(uTime * 0.003, 0.0));
      float mossMask = mossGrad * smoothstep(0.35, 0.6, mossNoise);
      vec3 mossColor = vec3(0.08, 0.16, 0.10);
      stoneColor = mix(stoneColor, mossColor, mossMask * 0.5 * uMossIntensity);

      // Subtle weathering cracks — thin, not dominant
      vec2 v = voronoi2(p * 2.0);
      float crackEdge = v.y - v.x;
      float crackLine = 1.0 - smoothstep(0.0, 0.05, crackEdge);
      stoneColor = mix(stoneColor, uStoneColor * 0.6, crackLine * 0.3);

      gl_FragColor = vec4(stoneColor, 1.0);
    }
  `;

  // Top: weathered stone with bioluminescent crack network as hero element
  const topVertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const topFragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uStoneColor;
    uniform vec3 uBioGlowColor;
    uniform float uGlowIntensity;
    uniform float uMossIntensity;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    ${noiseGlsl}

    void main() {
      vec2 c = vUv - 0.5;
      float dist = length(c) * 2.0;

      // Clean weathered stone
      float stoneN = fbm(c * 8.0 + 3.0);
      vec3 lightStone = uStoneColor + vec3(0.06, 0.07, 0.08);
      vec3 stone = mix(uStoneColor, lightStone, stoneN);

      // Soft moss at edges — gradient, not blotchy
      float edgeDist = max(abs(c.x), abs(c.y));
      float edgeMoss = smoothstep(0.25, 0.45, edgeDist);
      float mossNoise = fbm(c * 5.0 + vec2(uTime * 0.003, 0.0));
      float mossMask = edgeMoss * smoothstep(0.38, 0.58, mossNoise);
      vec3 mossColor = vec3(0.07, 0.14, 0.09);
      stone = mix(stone, mossColor, mossMask * 0.45 * uMossIntensity);

      // Bioluminescent crack network — the hero
      vec2 v = voronoi2(c * 5.0);
      float crackEdge = v.y - v.x;
      float crackLine = 1.0 - smoothstep(0.0, 0.05, crackEdge);
      float crackGlow = 1.0 - smoothstep(0.0, 0.2, crackEdge);

      // Organic breathing — slow, spatially varied
      float breathe = 0.45 + 0.25 * sin(uTime * 0.25 + fbm(c * 2.0) * 5.0);
      breathe += 0.1 * sin(uTime * 0.4 + dist * 3.0);

      // Not every crack glows — organic patchiness
      float glowPatch = smoothstep(0.35, 0.6, fbm(c * 1.8 + 19.0));
      float bioIntensity = breathe * glowPatch * uGlowIntensity;

      stone += uBioGlowColor * crackLine * 0.9 * bioIntensity;
      stone += uBioGlowColor * crackGlow * 0.1 * bioIntensity;

      // Non-glowing cracks just slightly darker
      float darkCrack = crackLine * (1.0 - glowPatch);
      stone = mix(stone, uStoneColor * 0.65, darkCrack * 0.3);

      gl_FragColor = vec4(stone, 1.0);
    }
  `;

  const bodyMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStoneColor: { value: new Color(config.stoneColor) },
        uMossIntensity: { value: config.mossIntensity },
      },
      vertexShader: bodyVertexShader,
      fragmentShader: bodyFragmentShader,
    });
  });

  const topMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStoneColor: { value: new Color(config.stoneColor) },
        uBioGlowColor: { value: new Color(config.runeGlowColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uMossIntensity: { value: config.mossIntensity },
      },
      vertexShader: topVertexShader,
      fragmentShader: topFragmentShader,
      side: DoubleSide,
    });
  });

  const columnMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStoneColor: { value: new Color(config.stoneColor) },
        uMossIntensity: { value: config.mossIntensity },
      },
      vertexShader: bodyVertexShader,
      fragmentShader: bodyFragmentShader,
    });
  });

  $effect(() => {
    if (!bodyMaterial || !topMaterial) return;
    const stoneCol = new Color(config.stoneColor);
    const glowCol = new Color(config.runeGlowColor);

    bodyMaterial.uniforms.uStoneColor!.value = stoneCol;
    bodyMaterial.uniforms.uMossIntensity!.value = config.mossIntensity;

    topMaterial.uniforms.uStoneColor!.value = stoneCol;
    topMaterial.uniforms.uBioGlowColor!.value = glowCol;
    topMaterial.uniforms.uGlowIntensity!.value = config.glowIntensity;
    topMaterial.uniforms.uMossIntensity!.value = config.mossIntensity;

    columnMaterial.uniforms.uStoneColor!.value = stoneCol;
    columnMaterial.uniforms.uMossIntensity!.value = config.mossIntensity;
  });

  useTask((delta) => {
    if (!bodyMaterial || !topMaterial) return;
    const dt = delta * 0.8;
    bodyMaterial.uniforms.uTime!.value += dt;
    topMaterial.uniforms.uTime!.value += dt;
    columnMaterial.uniforms.uTime!.value += dt;
  });
</script>

{#if config.enabled}
  <T.Group position.z={config.zOffset ?? 0}>
    <!-- Weathered stone body (elevated above terrain) -->
    <T.Mesh
      geometry={bodyGeometry}
      material={bodyMaterial}
      position.y={groundY + elevation + config.height / 2}
    />

    <!-- Bioluminescent top surface -->
    <T.Mesh
      geometry={topGeometry}
      material={topMaterial}
      rotation.x={-Math.PI / 2}
      position.y={groundY + elevation + config.height + 0.001}
    />

    <!-- Overgrown column stumps on top -->
    {#each columns as col}
      {@const colHeight = col.scaleY * 0.6}
      <T.Mesh
        geometry={columnGeometry}
        material={columnMaterial}
        position.x={col.x}
        position.y={groundY + elevation + config.height + colHeight * 0.5}
        position.z={col.z}
        scale.y={col.scaleY}
      />
    {/each}

    <!-- Support pillars from seabed to platform -->
    {#if supportPillarGeometry}
      {#each supportPillars as pillar}
        <T.Mesh
          geometry={supportPillarGeometry}
          material={bodyMaterial}
          position.x={pillar.x}
          position.y={groundY + elevation / 2}
          position.z={pillar.z}
        />
      {/each}
    {/if}
  </T.Group>
{/if}
