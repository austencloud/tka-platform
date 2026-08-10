<script lang="ts">
  /**
   * SkyGradient Primitive
   *
   * Renders a large inverted sphere with a vertical gradient shader.
   * Lives in 3D space so it's visible through gaps in geometry (trees, buildings)
   * and doesn't depend on scene.background timing.
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import { onDestroy, untrack } from "svelte";
  import {
    SphereGeometry,
    ShaderMaterial,
    BackSide,
    Color,
    MathUtils,
    type Mesh,
    Vector3,
  } from "three";
  import type { MoonConfig } from "../domain/models/scene-configs";
  import type { SkySunConfig } from "../domain/models/environment-models";

  interface Props {
    /** Top color of gradient */
    topColor?: string;
    /** Bottom color of gradient */
    bottomColor?: string;
    /** Optional middle color for 3-stop gradient */
    midColor?: string;
    /** Radius of the sky dome */
    radius?: number;
    /** Raw sky-latitude value mapped to the bottom gradient stop. */
    gradientStart?: number;
    /** Raw sky-latitude value mapped to the top gradient stop. */
    gradientEnd?: number;
    /** Optional celestial moon composited into the sky itself. */
    moon?: MoonConfig | null;
    /** Optional solar disk composited by the same camera-centred sky owner. */
    sun?: SkySunConfig | null;
  }

  let {
    topColor = "#1e1b4b",
    bottomColor = "#0a0a12",
    midColor,
    radius = 200,
    gradientStart = 0,
    gradientEnd = 1,
    moon = null,
    sun = null,
  }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 32, 32));
  const moonTexture = useTexture(moon?.texture ?? "/textures/moon.png");
  const { camera } = useThrelte();

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

  function resolveSunDirection(config: SkySunConfig | null): Vector3 {
    return new Vector3(...(config?.direction ?? [0, 0.5, -1])).normalize();
  }

  // The material must exist when Threlte creates the mesh. Supplying
  // `undefined` on the first render and replacing it from an effect left the
  // sky mesh on Three's fallback material path in some runtimes, so only the
  // scene clear colour was visible. Keep one stable material and update its
  // uniforms reactively instead.
  const material = untrack(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTopColor: { value: new Color(topColor) },
          uMidColor: { value: new Color(midColor ?? topColor) },
          uBottomColor: { value: new Color(bottomColor) },
          uHasMid: { value: midColor ? 1.0 : 0.0 },
          uGradientStart: { value: gradientStart },
          uGradientEnd: { value: gradientEnd },
          uMoonEnabled: { value: 0.0 },
          uMoonTexture: { value: null },
          uMoonDirection: { value: resolveMoonDirection(moon) },
          uMoonAngularRadius: {
            value: MathUtils.degToRad(resolveMoonAngularDiameter(moon) * 0.5),
          },
          uMoonOpacity: { value: moon?.opacity ?? 1.0 },
          uMoonGlowScale: { value: moon?.glowScale ?? 1.12 },
          uMoonGlowOpacity: { value: moon?.glowOpacity ?? 0.025 },
          uMoonSurfaceLift: { value: moon?.surfaceLift ?? 0.0 },
          uMoonHorizonWarmth: { value: moon?.horizonWarmth ?? 1.0 },
          uSunEnabled: { value: 0.0 },
          uSunDirection: { value: resolveSunDirection(sun) },
          uSunAngularRadius: {
            value: MathUtils.degToRad(
              (sun?.angularDiameterDegrees ?? 0.53) * 0.5
            ),
          },
          uSunColor: { value: new Color(sun?.color ?? "#fff4d2") },
          uSunOpacity: { value: sun?.opacity ?? 1.0 },
          uSunGlowScale: { value: sun?.glowScale ?? 6.0 },
          uSunGlowOpacity: { value: sun?.glowOpacity ?? 0.12 },
        },
        vertexShader: /* glsl */ `
        varying vec3 vSkyDirection;

        void main() {
          vSkyDirection = normalize(position);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBottomColor;
        uniform float uHasMid;
        uniform float uGradientStart;
        uniform float uGradientEnd;
        uniform float uMoonEnabled;
        uniform sampler2D uMoonTexture;
        uniform vec3 uMoonDirection;
        uniform float uMoonAngularRadius;
        uniform float uMoonOpacity;
        uniform float uMoonGlowScale;
        uniform float uMoonGlowOpacity;
        uniform float uMoonSurfaceLift;
        uniform float uMoonHorizonWarmth;
        uniform float uSunEnabled;
        uniform vec3 uSunDirection;
        uniform float uSunAngularRadius;
        uniform vec3 uSunColor;
        uniform float uSunOpacity;
        uniform float uSunGlowScale;
        uniform float uSunGlowOpacity;
        varying vec3 vSkyDirection;

        void main() {
          vec3 skyDirection = normalize(vSkyDirection);
          float rawHeight = skyDirection.y * 0.5 + 0.5;
          float h = clamp(
            (rawHeight - uGradientStart) / max(uGradientEnd - uGradientStart, 0.0001),
            0.0,
            1.0
          );

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

          if (uSunEnabled > 0.5) {
            float sunAngle = acos(clamp(
              dot(skyDirection, normalize(uSunDirection)),
              -1.0,
              1.0
            ));
            float sunRadius = max(uSunAngularRadius, 0.00001);
            float diskDistance = sunAngle / sunRadius;
            float disk = 1.0 - smoothstep(0.82, 1.0, diskDistance);
            float haloRadius = max(uSunGlowScale, 1.001);
            float halo = 1.0 - smoothstep(1.0, haloRadius, diskDistance);
            halo = pow(max(halo, 0.0), 2.2) * (1.0 - disk);
            color += uSunColor * halo * uSunGlowOpacity;
            color = mix(color, uSunColor, disk * uSunOpacity);
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
            float transmittance = mix(0.82, 1.0, atmospherePath);
            vec3 horizonTint = mix(
              vec3(0.94, 0.97, 1.0),
              vec3(1.0, 0.67, 0.42),
              uMoonHorizonWarmth
            );
            vec3 atmosphericTint = mix(
              horizonTint,
              vec3(0.92, 0.96, 1.0),
              atmospherePath
            );
            // Preserve crater detail while keeping a horizon moon luminous
            // enough to lead the composition after filmic tone mapping.
            vec3 moonSurface = pow(max(moonSample.rgb, vec3(0.0)), vec3(0.72));
            moonSurface = mix(moonSurface, vec3(1.0), uMoonSurfaceLift);
            vec3 moonColor = moonSurface * atmosphericTint * transmittance;

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
        depthTest: false,
        depthWrite: false,
      })
  );

  $effect(() => {
    const top = new Color(topColor);
    const mid = midColor ? new Color(midColor) : null;
    const bottom = new Color(bottomColor);
    material.uniforms.uTopColor!.value.copy(top);
    material.uniforms.uMidColor!.value.copy(
      mid ?? new Color().lerpColors(top, bottom, 0.5)
    );
    material.uniforms.uBottomColor!.value.copy(bottom);
    material.uniforms.uHasMid!.value = mid ? 1.0 : 0.0;
    material.uniforms.uGradientStart!.value = gradientStart;
    material.uniforms.uGradientEnd!.value = gradientEnd;
    material.uniforms.uMoonEnabled!.value =
      moon?.enabled && $moonTexture ? 1.0 : 0.0;
    material.uniforms.uMoonTexture!.value = $moonTexture ?? null;
    material.uniforms.uMoonDirection!.value.copy(resolveMoonDirection(moon));
    material.uniforms.uMoonAngularRadius!.value = MathUtils.degToRad(
      resolveMoonAngularDiameter(moon) * 0.5
    );
    material.uniforms.uMoonOpacity!.value = moon?.opacity ?? 1.0;
    material.uniforms.uMoonGlowScale!.value = moon?.glowScale ?? 1.12;
    material.uniforms.uMoonGlowOpacity!.value = moon?.glowOpacity ?? 0.025;
    material.uniforms.uMoonSurfaceLift!.value = moon?.surfaceLift ?? 0.0;
    material.uniforms.uMoonHorizonWarmth!.value = moon?.horizonWarmth ?? 1.0;
    material.uniforms.uSunEnabled!.value = sun?.enabled ? 1.0 : 0.0;
    material.uniforms.uSunDirection!.value.copy(resolveSunDirection(sun));
    material.uniforms.uSunAngularRadius!.value = MathUtils.degToRad(
      (sun?.angularDiameterDegrees ?? 0.53) * 0.5
    );
    material.uniforms.uSunColor!.value.set(sun?.color ?? "#fff4d2");
    material.uniforms.uSunOpacity!.value = sun?.opacity ?? 1.0;
    material.uniforms.uSunGlowScale!.value = sun?.glowScale ?? 6.0;
    material.uniforms.uSunGlowOpacity!.value = sun?.glowOpacity ?? 0.12;
  });

  let skyMesh = $state<Mesh>();

  // Keep the dome centred on the active camera. This gives celestial features
  // orientation without translation parallax and lets Three handle projection
  // with its proven camera path instead of forcing every vertex onto the far
  // clip plane.
  useTask(() => {
    const activeCamera = camera.current;
    if (activeCamera && skyMesh) {
      skyMesh.position.copy(activeCamera.position);
    }
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Mesh
  bind:ref={skyMesh}
  {geometry}
  {material}
  renderOrder={-1}
  frustumCulled={false}
/>
