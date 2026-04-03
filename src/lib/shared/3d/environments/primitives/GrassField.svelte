<script lang="ts">
  /**
   * GrassField Primitive
   *
   * Shader-based instanced grass blades scattered across a circular area.
   * Each blade sways in the wind via a vertex shader. Uses InstancedBufferGeometry
   * for GPU-efficient rendering of thousands of blades in a single draw call.
   */

  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    InstancedBufferGeometry,
    InstancedBufferAttribute,
    Float32BufferAttribute,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";

  interface Props {
    /** Number of grass blades */
    count?: number;
    /** Radius of the circular grass area (meters) */
    radius?: number;
    /** Minimum distance from center to keep clear (meters) */
    innerRadius?: number;
    /** Blade height range [min, max] in meters */
    heightRange?: [number, number];
    /** Blade width in meters */
    bladeWidth?: number;
    /** Base color (root of blade) */
    baseColor?: string;
    /** Tip color (top of blade) */
    tipColor?: string;
    /** Wind speed multiplier */
    windSpeed?: number;
    /** Wind intensity (how far blades bend) */
    windStrength?: number;
  }

  let {
    count = 8000,
    radius = 9,
    innerRadius = 2.5,
    heightRange = [0.15, 0.45],
    bladeWidth = 0.04,
    baseColor = "#1a3a0a",
    tipColor = "#4a8a2a",
    windSpeed = 1.0,
    windStrength = 0.3,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // -- Shaders --

  const vertexShader = `
    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;

    // Per-instance attributes
    attribute vec3 aOffset;
    attribute float aScale;
    attribute float aPhase;
    attribute float aRotation;

    varying float vHeight;
    varying vec3 vWorldPos;

    void main() {
      vHeight = uv.y;

      // Start with the template blade vertex
      vec3 pos = position;

      // Scale blade height by instance scale
      pos.y *= aScale;

      // Rotate blade around Y axis so they face random directions
      float cosR = cos(aRotation);
      float sinR = sin(aRotation);
      float rx = pos.x * cosR - pos.z * sinR;
      float rz = pos.x * sinR + pos.z * cosR;
      pos.x = rx;
      pos.z = rz;

      // Wind: quadratic bend toward the tip
      float heightFactor = uv.y * uv.y;
      float windAngle = uTime * uWindSpeed + aPhase;

      // Two sine waves at different frequencies for organic motion
      float windX = sin(windAngle * 1.1 + aOffset.x * 0.5) * 0.6
                  + sin(windAngle * 2.3 + aOffset.z * 0.8) * 0.4;
      float windZ = cos(windAngle * 0.9 + aOffset.z * 0.3) * 0.5
                  + cos(windAngle * 1.7 + aOffset.x * 0.6) * 0.3;

      pos.x += windX * heightFactor * uWindStrength * aScale;
      pos.z += windZ * heightFactor * uWindStrength * aScale * 0.5;

      // Place blade at its world offset
      pos += aOffset;
      vWorldPos = pos;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uBaseColor;
    uniform vec3 uTipColor;

    varying float vHeight;
    varying vec3 vWorldPos;

    void main() {
      // Gradient from root to tip
      vec3 color = mix(uBaseColor, uTipColor, vHeight);

      // Darken the base for a ground-shadow effect
      float baseShadow = smoothstep(0.0, 0.15, vHeight);
      color *= 0.6 + 0.4 * baseShadow;

      // Per-blade color variation based on world position
      float variation = sin(vWorldPos.x * 3.7 + vWorldPos.z * 2.9) * 0.06;
      color += variation;

      // Soften the tip
      float alpha = 1.0 - smoothstep(0.85, 1.0, vHeight) * 0.3;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  // -- Material --

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWindSpeed: { value: windSpeed },
      uWindStrength: { value: windStrength },
      uBaseColor: { value: new Color(baseColor) },
      uTipColor: { value: new Color(tipColor) },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
  });

  // -- Geometry --

  // Template blade: a tapered quad with 4 vertical segments for smooth bending.
  // UVs go from (0.5, 0) at base to (0.5, 1) at tip.
  function createBladeGeometry(): InstancedBufferGeometry {
    const segments = 4;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfW = bladeWidth / 2;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 = base, 1 = tip
      // Blade tapers toward the tip
      const w = halfW * (1 - t * 0.85);

      vertices.push(-w, t, 0); // left vertex
      vertices.push(w, t, 0); // right vertex

      uvs.push(0, t);
      uvs.push(1, t);
    }

    // Triangle strip as indexed triangles
    for (let i = 0; i < segments; i++) {
      const bl = i * 2;
      const br = bl + 1;
      const tl = bl + 2;
      const tr = bl + 3;
      indices.push(bl, br, tl);
      indices.push(br, tr, tl);
    }

    const geo = new InstancedBufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    // Per-instance attributes
    const offsets = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const rotations = new Float32Array(count);
    const [minH, maxH] = heightRange;

    for (let i = 0; i < count; i++) {
      // Random point in annular ring (rejection sampling)
      let x: number, z: number, dist: number;
      do {
        x = (Math.random() * 2 - 1) * radius;
        z = (Math.random() * 2 - 1) * radius;
        dist = Math.sqrt(x * x + z * z);
      } while (dist > radius || dist < innerRadius);

      offsets[i * 3] = x;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = z;

      // Taller near center, shorter at edges
      const edgeFade = 1 - (dist - innerRadius) / (radius - innerRadius);
      const heightBias = 0.5 + edgeFade * 0.5;
      scales[i] = minH + Math.random() * (maxH - minH) * heightBias;

      phases[i] = Math.random() * Math.PI * 2;
      rotations[i] = Math.random() * Math.PI; // Random facing
    }

    geo.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 3));
    geo.setAttribute("aScale", new InstancedBufferAttribute(scales, 1));
    geo.setAttribute("aPhase", new InstancedBufferAttribute(phases, 1));
    geo.setAttribute("aRotation", new InstancedBufferAttribute(rotations, 1));

    geo.instanceCount = count;
    return geo;
  }

  const geometry = createBladeGeometry();

  // -- Animation --

  // Direct references to uniforms we defined above — always present
  const uTime = material.uniforms.uTime!;
  const uBaseColor = material.uniforms.uBaseColor!;
  const uTipColor = material.uniforms.uTipColor!;
  const uWindSpeed = material.uniforms.uWindSpeed!;
  const uWindStrength = material.uniforms.uWindStrength!;

  useTask((delta) => {
    uTime.value += delta;
  });

  // Reactive uniform updates when props change
  $effect(() => {
    uBaseColor.value.set(baseColor);
    uTipColor.value.set(tipColor);
    uWindSpeed.value = windSpeed;
    uWindStrength.value = windStrength;
  });

  // Cleanup
  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Group position.y={groundY}>
  <T.Mesh
    {geometry}
    {material}
    frustumCulled={false}
  />
</T.Group>
