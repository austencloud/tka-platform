<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Vector3,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";

  interface Props {
    count?: number;
    areaWidth?: number;
    areaHeight?: number;
    areaDepth?: number;
    currentDirection?: [number, number, number];
  }

  let {
    count = 4000,
    areaWidth = 30,
    areaHeight = 10,
    areaDepth = 30,
    currentDirection = [0.02, -0.003, 0.01],
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * areaWidth;
    positions[i * 3 + 1] = Math.pow(Math.random(), 2.5) * areaHeight;
    positions[i * 3 + 2] = (Math.random() - 0.5) * areaDepth;
    phases[i] = Math.random() * 6.2832;
    sizes[i] = 0.015 + Math.random() * 0.045;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));

  const vertexShader = /* glsl */ `
    attribute float aPhase;
    attribute float aSize;
    uniform float uTime;
    uniform vec3 uCurrentDir;
    uniform float uAreaWidth;
    uniform float uAreaHeight;
    uniform float uAreaDepth;
    varying float vAlpha;
    varying float vScatter;

    void main() {
      float t = uTime * 0.12 + aPhase;

      // Layered sine/cosine for smooth, continuous turbulence
      vec3 turb;
      turb.x = sin(position.y * 1.3 + t * 0.7) * 0.5
             + sin(position.z * 0.8 + t * 0.3) * 0.25;
      turb.y = sin(position.x * 0.9 + t * 0.5) * 0.15
             + cos(position.z * 1.1 + t * 0.2) * 0.1;
      turb.z = cos(position.x * 1.2 + t * 0.6) * 0.5
             + sin(position.y * 0.7 + t * 0.4) * 0.25;

      vec3 drift = uCurrentDir * uTime;

      vec3 pos = position + turb + drift;

      pos.x = mod(pos.x + uAreaWidth * 0.5, uAreaWidth) - uAreaWidth * 0.5;
      pos.y = mod(pos.y, uAreaHeight);
      pos.z = mod(pos.z + uAreaDepth * 0.5, uAreaDepth) - uAreaDepth * 0.5;

      float hFrac = pos.y / uAreaHeight;
      vAlpha = (1.0 - smoothstep(0.7, 1.0, hFrac))
             * (0.3 + 0.7 * (1.0 - hFrac));

      vScatter = smoothstep(0.3, 0.9, hFrac);

      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * (800.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying float vAlpha;
    varying float vScatter;

    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = (1.0 - smoothstep(0.2, 0.5, d)) * vAlpha;
      if (a < 0.01) discard;

      vec3 cool = vec3(0.65, 0.78, 0.85);
      vec3 warm = vec3(1.0, 0.9, 0.6);
      vec3 color = mix(cool, warm, vScatter * 0.4);

      gl_FragColor = vec4(color, a * 0.35);
    }
  `;

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCurrentDir: { value: new Vector3(...currentDirection) },
      uAreaWidth: { value: areaWidth },
      uAreaHeight: { value: areaHeight },
      uAreaDepth: { value: areaDepth },
    },
    vertexShader,
    fragmentShader,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Points {geometry} {material} position.y={groundY} frustumCulled={false} />
