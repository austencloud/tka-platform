<script lang="ts">
  /**
   * Ocean Depth Gradient
   *
   * The abyss. FogExp2 has no height term — it fades everything toward one
   * colour, so looking DOWN past the shelf lip would resolve to exactly the
   * same navy as looking OUT at the horizon, and the drop-off would read as a
   * ledge over a glowing blue nothing.
   *
   * Same construction as primitives/SkyGradient.svelte: an inverted sphere
   * with a vertical gradient, re-centred on the camera every frame. Being
   * camera-locked is the load-bearing part — a backdrop that cannot be outrun
   * has no seam, which is what lets the forest's horizon feel infinite.
   *
   * depthTest:false + renderOrder:-1 means this always loses to real geometry
   * and only shows through gaps, so the shelf lip silhouettes against black.
   *
   * Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    BackSide,
    Color,
    ShaderMaterial,
    SphereGeometry,
    type Mesh,
  } from "three";

  interface Props {
    /** Just under the water plane, where light still reaches. */
    shallowColor?: string;
    /** Eye level. Matches the scene fog so geometry and void agree. */
    midColor?: string;
    /** Straight down. The abyss. */
    deepColor?: string;
    radius?: number;
  }

  let {
    shallowColor = "#1d5f74",
    midColor = "#0a2438",
    deepColor = "#01060b",
    radius = 180,
  }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 32, 32));
  const { camera } = useThrelte();

  // The material must exist when Threlte creates the mesh — supplying it from
  // an effect after first render leaves the mesh on Three's fallback material
  // path. Keep one stable material and update its uniforms reactively, the
  // same way SkyGradient does.
  const material = untrack(
    () =>
      new ShaderMaterial({
        uniforms: {
          uShallowColor: { value: new Color(shallowColor) },
          uMidColor: { value: new Color(midColor) },
          uDeepColor: { value: new Color(deepColor) },
        },
        vertexShader: /* glsl */ `
        varying vec3 vDirection;

        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: /* glsl */ `
        uniform vec3 uShallowColor;
        uniform vec3 uMidColor;
        uniform vec3 uDeepColor;
        varying vec3 vDirection;

        void main() {
          float height = vDirection.y;

          // Split at the horizon: the downward half ramps mid -> deep and the
          // upward half ramps mid -> shallow. Eye level therefore always
          // matches the scene fog colour, so geometry fading into the distance
          // meets the void with no visible seam.
          vec3 color = height < 0.0
            ? mix(uMidColor, uDeepColor, smoothstep(0.0, -0.55, height))
            : mix(uMidColor, uShallowColor, smoothstep(0.0, 0.75, height));

          gl_FragColor = vec4(color, 1.0);
        }
        `,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
      })
  );

  $effect(() => {
    material.uniforms.uShallowColor!.value.set(shallowColor);
    material.uniforms.uMidColor!.value.set(midColor);
    material.uniforms.uDeepColor!.value.set(deepColor);
  });

  let domeMesh: Mesh | undefined = $state();

  useTask(() => {
    const activeCamera = camera.current;
    if (activeCamera && domeMesh) {
      domeMesh.position.copy(activeCamera.position);
    }
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Mesh
  bind:ref={domeMesh}
  {geometry}
  {material}
  renderOrder={-1}
  frustumCulled={false}
/>
