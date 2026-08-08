<script lang="ts">
  /**
   * SkyGradient Primitive
   *
   * Renders a large inverted sphere with a vertical gradient shader.
   * Lives in 3D space so it's visible through gaps in geometry (trees, buildings)
   * and doesn't depend on scene.background timing.
   */

  import { T } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import { onDestroy, untrack } from "svelte";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    Color,
    MathUtils,
    Vector3,
  } from "three";
  import type { MoonConfig } from "../domain/models/scene-configs";

  interface Props {
    /** Top color of gradient */
    topColor?: string;
    /** Bottom color of gradient */
    bottomColor?: string;
    /** Optional middle color for 3-stop gradient */
    midColor?: string;
    /** Radius of the sky dome */
    radius?: number;
    /** Optional celestial moon composited into the sky itself. */
    moon?: MoonConfig | null;
  }

  let {
    topColor = "#1e1b4b",
    bottomColor = "#0a0a12",
    midColor,
    radius = 200,
    moon = null,
  }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 32, 32));
  const moonTexture = useTexture(moon?.texture ?? "/textures/moon.png");

  function resolveMoonDirection(config: MoonConfig | null): Vector3 {
    const source = config?.direction ?? config?.position ?? [0, 0.25, -1];
    return new Vector3(...source).normalize();
  }

  function resolveMoonAngularDiameter(config: MoonConfig | null): number {
    if (!config) return 0.52;
    if (config.angularDiameterDegrees !== undefined) {
      return config.angularDiameterDegrees;
    }

    // Preserve the apparent size of older saved configs while they migrate
    // from a world-space diameter and position to an angular sky measurement.
    if (config.diameter !== undefined && config.position !== undefined) {
      const distance = new Vector3(...config.position).length();
      return MathUtils.radToDeg(
        2 * Math.atan(config.diameter / (2 * distance))
      );
    }

    return 0.52;
  }

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const top = new Color(topColor);
    const mid = midColor ? new Color(midColor) : null;
    const bottom = new Color(bottomColor);
    const moonDirection = resolveMoonDirection(moon);
    const moonAngularDiameter = resolveMoonAngularDiameter(moon);

    const mat = new ShaderMaterial({
      uniforms: {
        uTopColor: { value: top },
        uMidColor: { value: mid ?? new Color().lerpColors(top, bottom, 0.5) },
        uBottomColor: { value: bottom },
        uHasMid: { value: mid ? 1.0 : 0.0 },
        uMoonEnabled: { value: moon?.enabled && $moonTexture ? 1.0 : 0.0 },
        uMoonTexture: { value: $moonTexture ?? null },
        uMoonDirection: { value: moonDirection },
        uMoonAngularRadius: {
          value: MathUtils.degToRad(moonAngularDiameter * 0.5),
        },
        uMoonOpacity: { value: moon?.opacity ?? 1.0 },
        uMoonGlowScale: { value: moon?.glowScale ?? 1.12 },
        uMoonGlowOpacity: { value: moon?.glowOpacity ?? 0.025 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vSkyDirection;

        void main() {
          vSkyDirection = normalize(position);

          // A celestial background has orientation but no camera translation.
          // Removing the translation makes every point effectively optical
          // infinity: rotation changes the view, walking does not add parallax.
          mat4 rotationalView = mat4(mat3(viewMatrix));
          vec4 clipPosition = projectionMatrix * rotationalView * vec4(position, 1.0);
          gl_Position = clipPosition.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBottomColor;
        uniform float uHasMid;
        uniform float uMoonEnabled;
        uniform sampler2D uMoonTexture;
        uniform vec3 uMoonDirection;
        uniform float uMoonAngularRadius;
        uniform float uMoonOpacity;
        uniform float uMoonGlowScale;
        uniform float uMoonGlowOpacity;
        varying vec3 vSkyDirection;

        void main() {
          vec3 skyDirection = normalize(vSkyDirection);
          float h = skyDirection.y * 0.5 + 0.5;

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

          if (uMoonEnabled > 0.5) {
            vec3 moonDirection = normalize(uMoonDirection);
            vec3 referenceUp = abs(moonDirection.y) > 0.98
              ? vec3(1.0, 0.0, 0.0)
              : vec3(0.0, 1.0, 0.0);
            vec3 moonRight = normalize(cross(referenceUp, moonDirection));
            vec3 moonUp = normalize(cross(moonDirection, moonRight));

            // Map the view ray into the Moon's tangent plane. The disk size is
            // specified in angular degrees, independent of camera position or
            // scene scale.
            float angularScale = max(sin(uMoonAngularRadius), 0.00001);
            vec2 moonPlane = vec2(
              dot(skyDirection, moonRight),
              dot(skyDirection, moonUp)
            ) / angularScale;
            float radialDistance = length(moonPlane);
            vec2 moonUv = moonPlane * vec2(0.5, -0.5) + 0.5;

            vec4 moonSample = texture2D(uMoonTexture, moonUv);
            float diskEdge = 1.0 - smoothstep(0.965, 1.0, radialDistance);
            float diskAlpha = moonSample.a * diskEdge * uMoonOpacity;

            // A low moon crosses more atmosphere: it dims, warms, and acquires
            // a restrained forward-scattering halo near the horizon.
            float elevation = clamp(moonDirection.y, 0.0, 1.0);
            float atmospherePath = smoothstep(0.0, 0.42, elevation);
            float transmittance = mix(0.48, 1.0, atmospherePath);
            vec3 atmosphericTint = mix(
              vec3(1.0, 0.67, 0.42),
              vec3(0.92, 0.96, 1.0),
              atmospherePath
            );
            vec3 moonColor = moonSample.rgb * atmosphericTint * transmittance;

            float haloRadius = max(uMoonGlowScale, 1.001);
            float halo = 1.0 - smoothstep(1.0, haloRadius, radialDistance);
            halo *= 1.0 - diskEdge;
            color += atmosphericTint * halo * uMoonGlowOpacity * transmittance;
            color = mix(color, moonColor, clamp(diskAlpha, 0.0, 1.0));
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
