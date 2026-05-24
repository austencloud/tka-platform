<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { ShaderMaterial, DoubleSide, Color, Vector3 } from "three";
  import type { OceanWaterSurfaceConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: OceanWaterSurfaceConfig;
    size?: number;
    segments?: number;
  }

  let { config, size = 50, segments = 128 }: Props = $props();

  const { camera } = useThrelte();

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uWaveScale;
    uniform float uWaveSpeed;
    uniform float uWaveAmplitude;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vDisplacement;
    varying vec3 vNormal;

    // Gerstner wave: returns (displacement.xyz, partial derivatives for normal)
    // D = direction, w = frequency, A = amplitude, Q = steepness, phi = phase speed
    vec3 gerstnerWave(vec2 D, float w, float A, float Q, float phi,
                      vec2 p, float t, inout vec3 tangent, inout vec3 binormal) {
      float phase = w * dot(D, p) + phi * t;
      float S = sin(phase);
      float C = cos(phase);
      float WA = w * A;

      // Accumulate tangent/binormal partials for normal computation
      tangent += vec3(-Q * D.x * D.x * WA * S,
                       D.x * WA * C,
                      -Q * D.x * D.y * WA * S);
      binormal += vec3(-Q * D.x * D.y * WA * S,
                        D.y * WA * C,
                       -Q * D.y * D.y * WA * S);

      return vec3(Q * A * D.x * C,
                   A * S,
                   Q * A * D.y * C);
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      vec2 p = pos.xz;

      // 4 Gerstner wave layers with varied directions and harmonics
      // Config-driven: uWaveScale controls frequency, uWaveAmplitude controls height
      vec3 tangent = vec3(1.0, 0.0, 0.0);
      vec3 binormal = vec3(0.0, 0.0, 1.0);

      vec3 disp = vec3(0.0);
      float baseW = uWaveScale;
      float baseA = uWaveAmplitude;
      float speed = uWaveSpeed;

      // Primary swell
      disp += gerstnerWave(normalize(vec2(1.0, 0.6)), baseW, baseA,
                           0.6, speed, p, uTime, tangent, binormal);
      // Cross swell
      disp += gerstnerWave(normalize(vec2(-0.4, 1.0)), baseW * 1.3, baseA * 0.6,
                           0.5, speed * 1.2, p, uTime, tangent, binormal);
      // Short chop
      disp += gerstnerWave(normalize(vec2(0.8, -0.3)), baseW * 2.1, baseA * 0.3,
                           0.4, speed * 1.6, p, uTime, tangent, binormal);
      // Detail ripple
      disp += gerstnerWave(normalize(vec2(-0.6, -0.8)), baseW * 3.2, baseA * 0.15,
                           0.3, speed * 2.0, p, uTime, tangent, binormal);

      pos += disp;
      vDisplacement = disp.y;

      // Analytical normal from accumulated Gerstner partials
      vNormal = normalize(cross(binormal, tangent));

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;
    uniform vec3 uCameraPosition;

    // Snell's window uniforms
    uniform bool uSnellEnabled;
    uniform vec3 uSkyColor;
    uniform vec3 uSunColor;
    uniform float uSunSize;
    uniform float uTirDarkness;
    uniform float uEdgeSoftness;
    uniform float uNoiseScale;
    uniform float uNoiseSpeed;
    uniform float uNoiseAmplitude;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vDisplacement;
    varying vec3 vNormal;

    // Simple 2D hash noise
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
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
      v += noise(p) * 0.5;
      v += noise(p * 2.1 + 0.3) * 0.25;
      v += noise(p * 4.3 + 0.7) * 0.125;
      return v;
    }

    void main() {
      float edgeFade = 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));

      if (!uSnellEnabled) {
        float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.3;
        float ripple = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 35.0 - uTime * 1.5) * 0.1;
        float alpha = (uOpacity + highlight + ripple) * edgeFade;
        vec3 color = uColor + vec3(highlight * 0.5);
        gl_FragColor = vec4(color, alpha);
        return;
      }

      // Snell's window calculation using Gerstner-derived normal
      vec3 viewDir = normalize(vWorldPosition - uCameraPosition);
      vec3 surfaceNormal = normalize(-vNormal); // flip for viewing from below

      float cosTheta = abs(dot(viewDir, surfaceNormal));
      float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

      const float IOR_WATER = 1.333;
      const float CRITICAL_SIN = 1.0 / IOR_WATER; // ~0.7502

      // Animate boundary with noise
      vec2 noiseUv = vWorldPosition.xz * uNoiseScale + uTime * uNoiseSpeed;
      float waveNoise = (fbm(noiseUv) - 0.5) * 2.0 * uNoiseAmplitude;
      float perturbedSin = clamp(sinTheta + waveNoise, 0.0, 1.0);

      // Window mask: 1 = inside window (bright sky), 0 = outside (TIR dark)
      float windowMask = 1.0 - smoothstep(
        CRITICAL_SIN - uEdgeSoftness,
        CRITICAL_SIN + uEdgeSoftness,
        perturbedSin
      );

      // Sky color inside window — brighter toward center
      float centerBrightness = pow(cosTheta, 0.5);
      vec3 skyResult = uSkyColor * (0.6 + 0.4 * centerBrightness);

      // Sun disc — approximate overhead sun position
      vec2 sunOffset = viewDir.xz / max(abs(viewDir.y), 0.001);
      float sunDist = length(sunOffset);
      float sunGlow = smoothstep(uSunSize * 4.0, uSunSize, sunDist);
      skyResult += uSunColor * sunGlow * 0.8;

      // TIR region — dark reflective tint
      vec3 tirResult = uColor * uTirDarkness;

      // Fresnel-like edge brightening near boundary
      float edgeFresnel = smoothstep(0.0, 0.15, abs(perturbedSin - CRITICAL_SIN));
      float edgeBright = (1.0 - edgeFresnel) * 0.3;

      vec3 finalColor = mix(tirResult, skyResult, windowMask);
      finalColor += vec3(edgeBright) * uSkyColor * 0.3;

      // Wave highlight overlay
      float highlight = smoothstep(0.0, 0.1, vDisplacement) * 0.15;
      finalColor += vec3(highlight);

      float alpha = mix(0.85, 0.4, windowMask) * edgeFade;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const material = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uWaveScale: { value: 0 },
      uWaveSpeed: { value: 0 },
      uWaveAmplitude: { value: 0 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: false },
      uSkyColor: { value: new Color() },
      uSunColor: { value: new Color() },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: 0.15 },
      uEdgeSoftness: { value: 0.06 },
      uNoiseScale: { value: 3.0 },
      uNoiseSpeed: { value: 0.4 },
      uNoiseAmplitude: { value: 0.04 },
    },
    vertexShader,
    fragmentShader,
  });

  $effect(() => {
    material.uniforms.uColor!.value = new Color(config.color);
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uWaveScale!.value = config.waveScale;
    material.uniforms.uWaveSpeed!.value = config.waveSpeed;
    material.uniforms.uWaveAmplitude!.value = config.waveAmplitude;

    const snell = config.snellWindow;
    if (snell?.enabled) {
      material.uniforms.uSnellEnabled!.value = true;
      material.uniforms.uSkyColor!.value = new Color(snell.skyColor);
      material.uniforms.uSunColor!.value = new Color(snell.sunColor);
      material.uniforms.uSunSize!.value = snell.sunSize;
      material.uniforms.uTirDarkness!.value = snell.tirDarkness;
      material.uniforms.uEdgeSoftness!.value = snell.edgeSoftness;
      material.uniforms.uNoiseScale!.value = snell.noiseScale;
      material.uniforms.uNoiseSpeed!.value = snell.noiseSpeed;
      material.uniforms.uNoiseAmplitude!.value = snell.noiseAmplitude;
    } else {
      material.uniforms.uSnellEnabled!.value = false;
    }
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
    const cam = camera.current;
    if (cam) {
      material.uniforms.uCameraPosition!.value.copy(cam.position);
    }
  });

  onDestroy(() => material.dispose());
</script>

<T.Mesh
  position.y={config.height}
  rotation.x={-Math.PI / 2}
  {material}
>
  <T.PlaneGeometry args={[size, size, segments, segments]} />
</T.Mesh>
