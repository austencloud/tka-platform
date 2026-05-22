<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    MeshStandardMaterial,
    DoubleSide,
    Color,
    TextureLoader,
    RepeatWrapping,
    PlaneGeometry,
    Float32BufferAttribute,
    type Texture,
    type WebGLProgramParametersWithUniforms,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { terrainHeightWithMounds, type MoundSource } from "./terrain-height";

  interface Props {
    color?: string;
    size?: number;
    rippleColor?: string;
    rippleIntensity?: number;
    stageRadius?: number;
    clearingRadius?: number;
    moundSources?: MoundSource[];
  }

  let {
    color = "#2a4a50",
    size = 50,
    rippleColor = "#3a5a58",
    rippleIntensity = 0.3,
    stageRadius = 3,
    clearingRadius = 7,
    moundSources = [],
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const loader = new TextureLoader();
  const TEX_REPEAT = 14;
  const SEGMENTS = 128;

  function loadTex(path: string): Texture {
    const tex = loader.load(path);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(TEX_REPEAT, TEX_REPEAT);
    return tex;
  }

  const sandDiffuse = loadTex("/textures/terrain/sand/diffuse.jpg");
  const sandNormal = loadTex("/textures/terrain/sand/normal.jpg");
  const sandRoughness = loadTex("/textures/terrain/sand/roughness.jpg");
  const sandAo = loadTex("/textures/terrain/sand/ao.jpg");

  const geometry = $derived.by(() => {
    const geo = new PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    const pos = geo.attributes.position!;
    const proximityData = new Float32Array(pos.count);
    const mounds = moundSources;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const wx = lx;
      const wz = -ly;
      const h = terrainHeightWithMounds(wx, wz, stageRadius, clearingRadius);
      pos.setZ(i, h);

      let prox = 0;
      for (let m = 0; m < mounds.length; m++) {
        const src = mounds[m]!;
        const dx = wx - src.x;
        const dz = wz - src.z;
        const distSq = dx * dx + dz * dz;
        const rSq = src.radius * src.radius;
        if (distSq >= rSq) continue;
        const t = Math.sqrt(distSq) / src.radius;
        const w = 0.5 * (1.0 + Math.cos(Math.PI * t));
        if (w > prox) prox = w;
      }
      proximityData[i] = prox;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute("aProximity", new Float32BufferAttribute(proximityData, 1));
    return geo;
  });

  // ── Noise GLSL (shared by fragment shader injection) ──────────────────
  const noiseGlsl = /* glsl */ `
    float seaHash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec2 seaHash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453);
    }
    float seaNoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), f.x),
        mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    float seaFbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * seaNoise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
    float voronoiCaustic(vec2 p, float t) {
      vec2 ci = floor(p); vec2 cf = fract(p); float cd = 1.0;
      for (int cx = -1; cx <= 1; cx++) {
        for (int cy = -1; cy <= 1; cy++) {
          vec2 nb = vec2(float(cx), float(cy));
          vec2 pt = seaHash2(ci + nb);
          pt = 0.5 + 0.5 * sin(t * 0.8 + 6.2831 * pt);
          cd = min(cd, length(nb + pt - cf));
        }
      }
      return cd;
    }
  `;

  // ── PBR Material with shader injection ────────────────────────────────
  let shaderRef: WebGLProgramParametersWithUniforms | null = null;

  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.72,
    metalness: 0.0,
    side: DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shaderRef = shader;

    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uBaseColor = { value: new Color(color) };
    shader.uniforms.uRippleColor = { value: new Color(rippleColor) };
    shader.uniforms.uSandDiffuse = { value: sandDiffuse };
    shader.uniforms.uSandNormal = { value: sandNormal };
    shader.uniforms.uSandRoughness = { value: sandRoughness };
    shader.uniforms.uSandAo = { value: sandAo };
    shader.uniforms.uTexRepeat = { value: TEX_REPEAT };

    // ── Vertex: pass world position to fragment ─────────────────────
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute float aProximity;
      varying vec3 vWorldPos;
      varying float vProximity;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vProximity = aProximity;
      `,
    );

    // ── Fragment: declare uniforms, varyings, noise ─────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uRippleColor;
      uniform sampler2D uSandDiffuse;
      uniform sampler2D uSandNormal;
      uniform sampler2D uSandRoughness;
      uniform sampler2D uSandAo;
      uniform float uTexRepeat;
      varying vec3 vWorldPos;
      varying float vProximity;
      ${noiseGlsl}
      `,
    );

    // ── Override diffuse color with FBM-blended sand ────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      // World-space UVs (no tiling artifacts from geometry UVs)
      vec2 wp = vWorldPos.xz;
      vec2 texUv = wp * uTexRepeat / 50.0;

      vec3 sandColor = texture2D(uSandDiffuse, texUv).rgb;
      float sandLum = dot(sandColor, vec3(0.299, 0.587, 0.114));
      vec3 tintedSand = mix(uBaseColor * 0.85, uRippleColor, sandLum * 0.6);
      tintedSand += (sandColor - 0.5) * 0.15;

      // Large slow patches: dark rocky substrate
      float rockMask = smoothstep(0.42, 0.58, seaFbm(wp * 0.08 + 3.7));
      tintedSand = mix(tintedSand, uBaseColor * 0.55, rockMask * 0.45);

      // Medium patches: greenish algae/biofilm
      float algaeMask = smoothstep(0.48, 0.62, seaFbm(wp * 0.18 + 11.3));
      tintedSand = mix(tintedSand, vec3(0.14, 0.25, 0.13), algaeMask * 0.25);

      // Fine grain: lighter sand trails
      float trailNoise = seaFbm(wp * 0.35 + 7.1);
      float trailMask = smoothstep(0.35, 0.55, trailNoise) * (1.0 - smoothstep(0.55, 0.7, trailNoise));
      tintedSand = mix(tintedSand, uRippleColor * 1.2, trailMask * 0.35);

      // Temperature shift
      float tempShift = seaNoise(wp * 0.06) * 2.0 - 1.0;
      tintedSand += vec3(0.03, -0.01, -0.03) * tempShift;

      // Procedural ripple overlay (color)
      float warp = seaNoise(wp * 0.4) * 2.5;
      float ridges = sin(wp.x * 5.0 + warp) * 0.5 + 0.5;
      ridges *= smoothstep(0.2, 0.8, sin(wp.y * 3.0 + seaNoise(wp * 0.3) * 4.0) * 0.5 + 0.5);
      tintedSand += uRippleColor * ridges * 0.06;

      // Bioturbation: organism-disturbed sediment patches
      float bioMask = smoothstep(0.55, 0.7, seaNoise(wp * 0.5 + 23.0));
      tintedSand = mix(tintedSand, tintedSand * 0.82 + vec3(0.02, 0.01, 0.0), bioMask * 0.4);

      // Contact darkening near objects (sediment shadow + organic tint)
      vec3 sedimentDark = tintedSand * 0.45 + vec3(0.02, 0.03, 0.01);
      tintedSand = mix(tintedSand, sedimentDark, vProximity);

      diffuseColor = vec4(clamp(tintedSand, 0.0, 1.0), 1.0);
      `,
    );

    // ── Override normal map with world-space sampling ────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      // World-space sampled normal map
      vec2 nTexUv = vWorldPos.xz * uTexRepeat / 50.0;
      vec3 texNorm = texture2D(uSandNormal, nTexUv).rgb * 2.0 - 1.0;

      // Build TBN from geometry derivatives
      vec3 dpdx = dFdx(vWorldPos);
      vec3 dpdy = dFdy(vWorldPos);
      vec3 surfN = normalize(cross(dpdx, dpdy));
      vec3 T = normalize(dpdx);
      vec3 B = cross(surfN, T);
      mat3 TBN = mat3(T, B, surfN);

      normal = normalize(TBN * texNorm);

      // Grain normal micro-perturbation (Journey sand technique)
      vec2 grainUv = wp * 8.0;
      float gx = seaNoise(grainUv + vec2(0.13, 0.0)) - seaNoise(grainUv - vec2(0.13, 0.0));
      float gz = seaNoise(grainUv + vec2(0.0, 0.13)) - seaNoise(grainUv - vec2(0.0, 0.13));
      normal = normalize(normal + vec3(gx, 0.0, gz) * 0.12);

      // Slope-aware sand ripples (flat areas only, perpendicular to current)
      float slopeFlat = dot(surfN, vec3(0.0, 1.0, 0.0));
      float rippleStrength = smoothstep(0.7, 0.95, slopeFlat);
      vec2 rippleDir = vec2(0.766, 0.643);
      float ripplePhase = dot(wp, rippleDir) * 14.0 + seaNoise(wp * 0.25) * 4.0;
      float rippleVal = cos(ripplePhase) * rippleStrength * 0.06;
      normal = normalize(normal + vec3(rippleDir.x * rippleVal, 0.0, rippleDir.y * rippleVal));

      // Fine detail normals (distance-faded — visible only near camera)
      float detailFade = 1.0 - smoothstep(5.0, 12.0, length(wp));
      vec2 detailUv = wp * 3.0;
      float ddx = seaNoise(detailUv + vec2(0.05, 0.0)) - seaNoise(detailUv - vec2(0.05, 0.0));
      float ddz = seaNoise(detailUv + vec2(0.0, 0.05)) - seaNoise(detailUv - vec2(0.0, 0.05));
      normal = normalize(normal + vec3(ddx, 0.0, ddz) * 0.08 * detailFade);
      `,
    );

    // ── Override roughness with texture ──────────────────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      float roughnessFactor = roughness;
      vec2 rTexUv = vWorldPos.xz * uTexRepeat / 50.0;
      float texRough = texture2D(uSandRoughness, rTexUv).r;
      roughnessFactor = mix(0.6, 0.85, texRough);
      roughnessFactor = mix(roughnessFactor, 0.35, vProximity * 0.6);
      `,
    );

    // ── Override AO with texture ────────────────────────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <aomap_fragment>",
      `
      vec2 aoTexUv = vWorldPos.xz * uTexRepeat / 50.0;
      float texAo = texture2D(uSandAo, aoTexUv).r;
      float ambientOcclusion = texAo;
      reflectedLight.indirectDiffuse *= ambientOcclusion;
      `,
    );

    // ── Add caustics + distance fog after all lighting ──────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      // Caustic UV offset by terrain normal (follows surface contour on slopes)
      vec2 cwp = vWorldPos.xz + surfN.xz * 0.5;
      float causticTime = uTime * 6.0;
      float c1 = voronoiCaustic(cwp * 0.6, causticTime);
      float c2 = voronoiCaustic(cwp * 0.78 + 3.7, causticTime * 1.1);
      float caustic = pow(min(c1, c2), 4.0) * 2.0;
      caustic = clamp(caustic, 0.0, 1.0);
      outgoingLight += vec3(0.55, 0.85, 0.75) * caustic * 0.35;

      // Wet sand sparkle (Journey grain specular technique)
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec2 sparkleUv = wp * 30.0;
      vec3 sparkleNorm = normalize(normal + vec3(
        seaNoise(sparkleUv) * 2.0 - 1.0,
        0.5,
        seaNoise(sparkleUv + 77.7) * 2.0 - 1.0
      ) * 0.4);
      float sparkleDot = max(dot(reflect(-viewDir, sparkleNorm), normalize(vec3(0.3, 1.0, 0.2))), 0.0);
      float sparkle = pow(sparkleDot, 80.0);
      float sparkleMask = step(0.92, seaNoise(wp * 20.0));
      outgoingLight += vec3(0.5, 0.7, 0.6) * sparkle * sparkleMask * 0.4;

      // Per-channel depth absorption (Quilez technique: red dies first)
      float fogDist = length(vWorldPos.xz);
      vec3 absorption = exp(-vec3(0.08, 0.04, 0.02) * fogDist);
      outgoingLight *= absorption;

      // Fade to deep water color at distance
      float distFade = smoothstep(20.0, 35.0, fogDist);
      outgoingLight = mix(outgoingLight, uBaseColor * 0.15, distFade);

      gl_FragColor = vec4(outgoingLight, diffuseColor.a);
      `,
    );
  };

  $effect(() => {
    if (!shaderRef) return;
    shaderRef.uniforms.uBaseColor!.value = new Color(color);
    shaderRef.uniforms.uRippleColor!.value = new Color(rippleColor);
  });

  useTask((delta) => {
    if (!shaderRef) return;
    shaderRef.uniforms.uTime!.value += delta * 0.05;
  });
</script>

<T.Mesh
  position.y={groundY}
  rotation.x={-Math.PI / 2}
  {material}
  {geometry}
/>
