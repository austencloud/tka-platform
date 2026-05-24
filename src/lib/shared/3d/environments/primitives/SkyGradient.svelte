<script lang="ts">
  /**
   * SkyGradient Primitive
   *
   * Renders a large inverted sphere with a vertical gradient shader.
   * Lives in 3D space so it's visible through gaps in geometry (trees, buildings)
   * and doesn't depend on scene.background timing.
   */

  import { T } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    Color,
    AdditiveBlending,
  } from "three";

  interface Props {
    /** Top color of gradient */
    topColor?: string;
    /** Bottom color of gradient */
    bottomColor?: string;
    /** Optional middle color for 3-stop gradient */
    midColor?: string;
    /** Radius of the sky dome */
    radius?: number;
  }

  let {
    topColor = "#1e1b4b",
    bottomColor = "#0a0a12",
    midColor,
    radius = 80,
  }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 32, 32));

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const top = new Color(topColor);
    const mid = midColor ? new Color(midColor) : null;
    const bottom = new Color(bottomColor);

    const mat = new ShaderMaterial({
      uniforms: {
        uTopColor: { value: top },
        uMidColor: { value: mid ?? new Color().lerpColors(top, bottom, 0.5) },
        uBottomColor: { value: bottom },
        uHasMid: { value: mid ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBottomColor;
        uniform float uHasMid;
        varying vec3 vWorldPosition;

        void main() {
          // Normalize height: 0 = bottom, 1 = top of sphere
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;

          vec3 color;
          if (uHasMid > 0.5) {
            // 3-stop gradient: bottom → mid → top
            if (h < 0.5) {
              color = mix(uBottomColor, uMidColor, h * 2.0);
            } else {
              color = mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
            }
          } else {
            color = mix(uBottomColor, uTopColor, h);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
    });
    material = mat;
    return () => mat.dispose();
  });

  onDestroy(() => geometry.dispose());
</script>

<T.Mesh {geometry} {material} renderOrder={-1} frustumCulled={false} />
