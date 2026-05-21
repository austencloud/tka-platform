<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    BoxGeometry,
    PlaneGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
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

  const SEGMENTS = 48;

  // --- Reactive geometries ---
  const bodyGeometry = $derived.by(
    () => new BoxGeometry(config.width, config.height, config.depth),
  );
  const topGeometry = $derived.by(
    () => new PlaneGeometry(config.width, config.depth),
  );
  const columnGeometry = $derived.by(
    () => new CylinderGeometry(0.12, 0.15, 0.6, 8),
  );

  // --- Column placements along rectangular perimeter ---
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

  // --- Body material (stone with moss and cracks) ---
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
    float voronoi(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); float md = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 n = vec2(float(x), float(y));
        vec2 o = hash2(i + n);
        o = 0.5 + 0.5 * sin(o * 6.2831 + 3.0);
        vec2 r = n + o - f;
        md = min(md, dot(r, r));
      }
      return sqrt(md);
    }

    void main() {
      vec2 p = vec2(vUv.x * 10.0, vPos.y * 8.0);
      float stone = fbm(p * 2.0 + 5.0);
      vec3 lightStone = uStoneColor + vec3(0.10, 0.09, 0.08);
      vec3 stoneColor = mix(uStoneColor, lightStone, stone);

      float moss = fbm(p * 1.5 + vec2(uTime * 0.01, 0.0));
      float mossThresh = smoothstep(0.45, 0.6, moss);
      stoneColor = mix(stoneColor, vec3(0.08, 0.20, 0.10), mossThresh * 0.5 * uMossIntensity);

      float crack = voronoi(p * 2.0);
      float crackLine = 1.0 - smoothstep(0.0, 0.08, crack);
      stoneColor -= vec3(0.06) * crackLine;

      gl_FragColor = vec4(stoneColor, 1.0);
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

  // --- Top surface material (carved stone with glowing runes) ---
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
    uniform vec3 uRuneGlowColor;
    uniform float uGlowIntensity;
    uniform float uMossIntensity;
    varying vec2 vUv;
    varying vec3 vWorldPos;

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
      vec2 i = floor(p); vec2 f = fract(p);
      float f1 = 8.0, f2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        o = 0.5 + 0.4 * sin(6.2831 * o + uTime * 0.1);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
      return vec2(sqrt(f1), sqrt(f2));
    }

    void main() {
      vec2 c = vUv - 0.5;
      float dist = length(c) * 2.0;

      // Stone base texture
      float stoneN = fbm(c * 10.0 + 3.0);
      vec3 lightStone = uStoneColor + vec3(0.10, 0.09, 0.08);
      vec3 stone = mix(uStoneColor, lightStone, stoneN);

      // Moss/algae patches
      float moss = fbm(c * 8.0 + vec2(uTime * 0.008, 0.0));
      stone = mix(stone, vec3(0.10, 0.22, 0.12), smoothstep(0.48, 0.65, moss) * 0.4 * uMossIntensity);

      // Carved rune channels — voronoi edges
      vec2 v = voronoi2(c * 4.5);
      float runeEdge = v.y - v.x;
      float rune = 1.0 - smoothstep(0.0, 0.08, runeEdge);
      float runeGlow = 1.0 - smoothstep(0.0, 0.2, runeEdge);

      // Rune glow with pulse
      float pulse = 0.5 + 0.5 * sin(uTime * 0.8 + dist * 4.0);
      stone += uRuneGlowColor * rune * 1.5 * pulse * uGlowIntensity;
      stone += uRuneGlowColor * runeGlow * 0.2 * pulse * uGlowIntensity;

      // Border carved line near edges
      vec2 d = abs(c);
      float borderDist = max(d.x, d.y);
      float border = 1.0 - smoothstep(0.0, 0.02, abs(borderDist - 0.42));
      stone += uRuneGlowColor * border * 0.8 * pulse * uGlowIntensity;

      // Downstage glow accent
      float ds = smoothstep(-0.1, 0.3, c.y) * smoothstep(0.5, 0.9, dist);
      stone += uRuneGlowColor * ds * 0.25 * pulse * uGlowIntensity;

      gl_FragColor = vec4(stone, 1.0);
    }
  `;

  const topMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStoneColor: { value: new Color(config.stoneColor) },
        uRuneGlowColor: { value: new Color(config.runeGlowColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uMossIntensity: { value: config.mossIntensity },
      },
      vertexShader: topVertexShader,
      fragmentShader: topFragmentShader,
      side: DoubleSide,
    });
  });

  // --- Column material ---
  const columnMaterial = $derived.by(() => {
    const col = new Color(config.stoneColor);
    col.offsetHSL(0, -0.05, 0.05);
    return new MeshStandardMaterial({
      color: col,
      roughness: 0.9,
      metalness: 0.0,
    });
  });

  // --- Sync uniforms on config change ---
  $effect(() => {
    if (!bodyMaterial || !topMaterial) return;
    const stoneCol = new Color(config.stoneColor);
    const glowCol = new Color(config.runeGlowColor);

    bodyMaterial.uniforms.uStoneColor!.value = stoneCol;
    bodyMaterial.uniforms.uMossIntensity!.value = config.mossIntensity;

    topMaterial.uniforms.uStoneColor!.value = stoneCol;
    topMaterial.uniforms.uRuneGlowColor!.value = glowCol;
    topMaterial.uniforms.uGlowIntensity!.value = config.glowIntensity;
    topMaterial.uniforms.uMossIntensity!.value = config.mossIntensity;
  });

  // --- Animate time uniform ---
  useTask((delta) => {
    if (!bodyMaterial || !topMaterial) return;
    const dt = delta * 0.8;
    bodyMaterial.uniforms.uTime!.value += dt;
    topMaterial.uniforms.uTime!.value += dt;
  });
</script>

{#if config.enabled}
  <!-- Stone body -->
  <T.Mesh
    geometry={bodyGeometry}
    material={bodyMaterial}
    position.y={groundY + config.height / 2}
  />

  <!-- Shader top surface with glowing runes -->
  <T.Mesh
    geometry={topGeometry}
    material={topMaterial}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height + 0.001}
  />

  <!-- Broken column stumps around perimeter -->
  {#each columns as col}
    {@const colHeight = col.scaleY * 0.6}
    <T.Mesh
      geometry={columnGeometry}
      material={columnMaterial}
      position.x={col.x}
      position.y={groundY + config.height + colHeight * 0.5}
      position.z={col.z}
      scale.y={col.scaleY}
    />
  {/each}
{/if}
