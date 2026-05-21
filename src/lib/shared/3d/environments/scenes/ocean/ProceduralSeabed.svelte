<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    DoubleSide,
    Color,
    Vector3,
    TextureLoader,
    RepeatWrapping,
    PlaneGeometry,
    type Texture,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { terrainHeight } from "./terrain-height";

  interface Props {
    color?: string;
    size?: number;
    rippleColor?: string;
    rippleIntensity?: number;
    stageRadius?: number;
    clearingRadius?: number;
  }

  let {
    color = "#2a4a50",
    size = 50,
    rippleColor = "#3a5a58",
    rippleIntensity = 0.3,
    stageRadius = 3,
    clearingRadius = 7,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const loader = new TextureLoader();
  const REPEAT = 14;
  const SEGMENTS = 128;

  function loadTex(path: string): Texture {
    const tex = loader.load(path);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(REPEAT, REPEAT);
    return tex;
  }

  const sandDiffuse = loadTex("/textures/terrain/sand/diffuse.jpg");
  const sandNormal = loadTex("/textures/terrain/sand/normal.jpg");
  const sandRoughness = loadTex("/textures/terrain/sand/roughness.jpg");
  const sandAo = loadTex("/textures/terrain/sand/ao.jpg");

  // CPU-displaced geometry — same terrainHeight function used for object placement
  const geometry = $derived.by(() => {
    const geo = new PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    const pos = geo.attributes.position!;
    const half = size / 2;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      // PlaneGeometry XY maps to world XZ after -PI/2 rotation
      const wx = lx;
      const wz = -ly;
      const h = terrainHeight(wx, wz, stageRadius, clearingRadius);
      pos.setZ(i, h);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  });

  // Fragment shader still uses GLSL noise for fine-detail normals + color variation
  const noiseGlsl = /* glsl */ `
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
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

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }
  `;

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uRippleColor;
    uniform float uRippleIntensity;
    uniform float uTime;
    uniform vec3 uLightDir;
    uniform float uAmbient;
    uniform sampler2D uDiffuse;
    uniform sampler2D uNormalMap;
    uniform sampler2D uRoughnessMap;
    uniform sampler2D uAoMap;
    uniform float uTexRepeat;

    varying vec2 vUv;
    varying vec3 vWorldPos;

    ${noiseGlsl}

    void main() {
      vec2 wp = vWorldPos.xz;
      vec2 texUv = wp * uTexRepeat / 50.0;

      vec3 sandColor = texture2D(uDiffuse, texUv).rgb;
      vec3 texNormal = texture2D(uNormalMap, texUv).rgb * 2.0 - 1.0;
      float ao = texture2D(uAoMap, texUv).r;

      float sandLum = dot(sandColor, vec3(0.299, 0.587, 0.114));
      vec3 tintedSand = mix(uBaseColor * 0.85, uRippleColor, sandLum * 0.6);
      tintedSand += (sandColor - 0.5) * 0.15;

      // Large slow patches: dark rocky substrate
      float rockMask = smoothstep(0.42, 0.58, fbm(wp * 0.08 + 3.7));
      vec3 darkRock = uBaseColor * 0.55;
      tintedSand = mix(tintedSand, darkRock, rockMask * 0.45);

      // Medium patches: greenish algae/biofilm
      float algaeMask = smoothstep(0.48, 0.62, fbm(wp * 0.18 + 11.3));
      vec3 algaeColor = vec3(0.14, 0.25, 0.13);
      tintedSand = mix(tintedSand, algaeColor, algaeMask * 0.25);

      // Fine grain: lighter sand trails
      float trailNoise = fbm(wp * 0.35 + 7.1);
      float trailMask = smoothstep(0.35, 0.55, trailNoise) * (1.0 - smoothstep(0.55, 0.7, trailNoise));
      vec3 lightSand = uRippleColor * 1.2;
      tintedSand = mix(tintedSand, lightSand, trailMask * 0.35);

      // Low-frequency warm/cool temperature shift
      float tempShift = noise(wp * 0.06) * 2.0 - 1.0;
      tintedSand += vec3(0.03, -0.01, -0.03) * tempShift;

      // Procedural sand ripple overlay
      float warp = noise(wp * 0.4) * 2.5;
      float ridges = sin(wp.x * 5.0 + warp) * 0.5 + 0.5;
      ridges *= smoothstep(0.2, 0.8, sin(wp.y * 3.0 + noise(wp * 0.3) * 4.0) * 0.5 + 0.5);
      tintedSand += uRippleColor * ridges * 0.06;
      tintedSand = clamp(tintedSand, 0.0, 1.0);

      // Use vertex normals (from CPU geometry) + blend with texture normal map
      vec3 geoNormal = normalize(vWorldPos);
      // Actually use the interpolated geometry normal via dFdx/dFdy
      vec3 dpdx = dFdx(vWorldPos);
      vec3 dpdy = dFdy(vWorldPos);
      vec3 surfNormal = normalize(cross(dpdx, dpdy));

      vec3 T = normalize(dpdx);
      vec3 B = cross(surfNormal, T);
      mat3 TBN = mat3(T, B, surfNormal);
      vec3 finalNormal = normalize(TBN * texNormal);

      float NdotL = max(dot(finalNormal, uLightDir), 0.0);
      vec3 lit = tintedSand * (uAmbient * ao + NdotL * 0.6);

      // Distance fade into fog color
      float dist = length(wp);
      float fade = smoothstep(20.0, 30.0, dist);
      lit = mix(lit, uBaseColor * uAmbient * 0.5, fade);

      gl_FragColor = vec4(lit, 1.0);
    }
  `;

  const material = new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new Color(color) },
      uRippleColor: { value: new Color(rippleColor) },
      uRippleIntensity: { value: rippleIntensity },
      uLightDir: { value: new Vector3(0.3, 1.0, 0.2).normalize() },
      uAmbient: { value: 0.55 },
      uDiffuse: { value: sandDiffuse },
      uNormalMap: { value: sandNormal },
      uRoughnessMap: { value: sandRoughness },
      uAoMap: { value: sandAo },
      uTexRepeat: { value: REPEAT },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uBaseColor!.value = new Color(color);
    material.uniforms.uRippleColor!.value = new Color(rippleColor);
    material.uniforms.uRippleIntensity!.value = rippleIntensity;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * 0.05;
  });
</script>

<T.Mesh
  position.y={groundY}
  rotation.x={-Math.PI / 2}
  {material}
  {geometry}
/>
