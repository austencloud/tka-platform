<script lang="ts">
  /**
   * AutumnPond
   *
   * An elliptical, organic pond matching the Blender-authored basin.
   *
   * The surface uses the project's existing water normal maps on two
   * independently moving physical layers: one for the water body and one for
   * its clear coat. A second, additive quad above it carries the moon's
   * reflection column.
   *
   * The `three/examples` Reflector branch that used to live here was deleted.
   * It was gated behind a flag that was false on every tier, so it never ran,
   * and a full second scene render at 512x512 is the wrong trade for a scene
   * whose runtime efficiency was the lowest-scoring dimension in review. The
   * glint quad below buys most of the read for two triangles.
   */

  import { T, useTask } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    AdditiveBlending,
    Color,
    NoColorSpace,
    PlaneGeometry,
    RepeatWrapping,
    ShaderMaterial,
    ShapeGeometry,
    TextureLoader,
    type MeshPhysicalMaterial,
    type Texture,
  } from "three";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";
  import { createOrganicPondShape } from "../../../../primitives/organic-pond-shape";
  import { AUTUMN_POND_LAYOUT } from "./autumn-pond-layout";
  import { AUTUMN_MOON_DIRECTION } from "../lighting/autumn-moon";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../../../primitives/motion-preference";
  import type { AutumnBootStatus } from "../autumn-boot-state";
  import { createAutumnPondSurfaceMaterial } from "./autumn-pond-surface-material";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    active?: boolean;
    retryRequest?: number;
    onStatus?: (status: AutumnBootStatus) => void;
    position?: [number, number, number];
    radiusX?: number;
    radiusZ?: number;
    seed?: number;
    waterLevelOffset?: number;
  }

  let {
    quality,
    groundY = 0,
    active = true,
    retryRequest = 0,
    onStatus,
    position = [0, 0, 0],
    radiusX = AUTUMN_POND_LAYOUT.radiusX,
    radiusZ = AUTUMN_POND_LAYOUT.radiusZ,
    seed = AUTUMN_POND_LAYOUT.seed,
    waterLevelOffset = AUTUMN_POND_LAYOUT.waterLevelOffset,
  }: Props = $props();

  const NORMAL_MAP_PATH = "/textures/water/Water_1_M_Normal.jpg";
  const COAT_NORMAL_MAP_PATH = "/textures/water/Water_2_M_Normal.jpg";

  function configureWaterNormal(texture: Texture, repeat: number): void {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = NoColorSpace;
    texture.anisotropy = 4;
  }

  const pondY = $derived((position[1] ?? groundY) + waterLevelOffset);

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  let surfaceGeometry = $state<ShapeGeometry | null>(null);
  let surfaceMaterial = $state<MeshPhysicalMaterial | null>(null);
  let bodyNormal = $state<Texture | null>(null);
  let coatNormal = $state<Texture | null>(null);

  function reportStatus(status: AutumnBootStatus): void {
    untrack(() => onStatus?.(status));
  }

  $effect(() => {
    const retry = retryRequest;
    let cancelled = false;
    let loadedNormals = 0;
    let normalLoadFailed = false;
    reportStatus("pending");

    const markNormalReady = () => {
      if (cancelled || normalLoadFailed) return;
      loadedNormals += 1;
      if (loadedNormals === 2) reportStatus("ready");
    };
    const markNormalFailed = (error: unknown) => {
      if (cancelled || normalLoadFailed) return;
      normalLoadFailed = true;
      console.warn("[AutumnPond] water normal failed to load", error);
      reportStatus("failed");
    };

    const geometry = new ShapeGeometry(
      createOrganicPondShape({ radiusX, radiusZ, seed }),
      48
    );
    const loader = new TextureLoader();
    const retrySuffix = retry > 0 ? `?retry=${retry}` : "";
    const normal0 = loader.load(
      `${NORMAL_MAP_PATH}${retrySuffix}`,
      markNormalReady,
      undefined,
      markNormalFailed
    );
    const normal1 = loader.load(
      `${COAT_NORMAL_MAP_PATH}${retrySuffix}`,
      markNormalReady,
      undefined,
      markNormalFailed
    );
    configureWaterNormal(normal0, 3.6);
    configureWaterNormal(normal1, 5.2);
    normal1.center.set(0.5, 0.5);
    normal1.rotation = 0.42;

    const material = createAutumnPondSurfaceMaterial(normal0, normal1);

    untrack(() => {
      surfaceGeometry?.dispose();
      surfaceMaterial?.dispose();
      bodyNormal?.dispose();
      coatNormal?.dispose();
      surfaceGeometry = geometry;
      surfaceMaterial = material;
      bodyNormal = normal0;
      coatNormal = normal1;
    });

    return () => {
      cancelled = true;
      geometry.dispose();
      material.dispose();
      normal0.dispose();
      normal1.dispose();
    };
  });

  //
  // A real planar reflection would cost a second render of the whole scene. The
  // moon is the only thing bright enough to reflect at dusk, so it is drawn
  // directly: a soft vertical column, broken into bands by the same ripple
  // clock the surface uses, additively blended over the water.

  const glintGeometry = untrack(
    () => new PlaneGeometry(radiusX * 0.34, radiusZ * 1.15)
  );

  // The column runs from the viewer toward the moon's compass bearing.
  const moonBearing = Math.atan2(
    AUTUMN_MOON_DIRECTION[0],
    AUTUMN_MOON_DIRECTION[2]
  );

  const glintMaterial = untrack(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color("#cddcff") },
          uStrength: { value: 0.075 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uStrength;
          varying vec2 vUv;

          void main() {
            vec2 p = vUv - 0.5;
            // Narrow across the column, long down it, and soft on every edge.
            // The first pass used hard-ish masks with a high-frequency band
            // term, which rendered as a striped rectangle sitting on the water
            // rather than a reflection.
            // Everything here is squared twice. A flat additive quad viewed at
            // a grazing angle - which is exactly how a walk-level camera sees a
            // pond - compresses vertically and turns any firm edge into a hard
            // bright streak lying on the water. Only a very soft falloff
            // survives that projection as a reflection.
            float across = 1.0 - smoothstep(0.0, 0.20, abs(p.x));
            float along = 1.0 - smoothstep(0.0, 0.44, abs(p.y));
            across *= across * across;
            along *= along * along;
            // Gentle ripple banding, low contrast so it reads as broken
            // reflection rather than as scanlines.
            float bands = 0.78 + 0.22 * sin(p.y * 21.0 + uTime * 1.1);
            float alpha = across * along * bands * uStrength;
            if (alpha < 0.004) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      })
  );

  let elapsed = 0;
  const waterTask = useTask(
    (delta) => {
      const scaled = delta * motionScale;
      const normal0 = bodyNormal;
      const normal1 = coatNormal;
      if (normal0) {
        normal0.offset.x = (normal0.offset.x + scaled * 0.0045) % 1;
        normal0.offset.y = (normal0.offset.y + scaled * 0.0022) % 1;
      }
      if (normal1) {
        normal1.offset.x = (normal1.offset.x - scaled * 0.0031 + 1) % 1;
        normal1.offset.y = (normal1.offset.y + scaled * 0.0048) % 1;
      }
      elapsed += scaled;
      glintMaterial.uniforms.uTime!.value = elapsed;
    },
    { autoStart: false }
  );

  $effect(() => {
    if (active) waterTask.start();
    else waterTask.stop();
    return () => waterTask.stop();
  });

  onDestroy(() => {
    surfaceGeometry?.dispose();
    surfaceMaterial?.dispose();
    bodyNormal?.dispose();
    coatNormal?.dispose();
    glintGeometry.dispose();
    glintMaterial.dispose();
  });
</script>

{#if surfaceGeometry && surfaceMaterial}
  <T.Mesh
    geometry={surfaceGeometry}
    material={surfaceMaterial}
    position.x={position[0]}
    position.y={pondY}
    position.z={position[2]}
    rotation.x={-Math.PI / 2}
    renderOrder={80}
  />
  <T.Mesh
    geometry={glintGeometry}
    material={glintMaterial}
    position.x={position[0]}
    position.y={pondY + 0.012}
    position.z={position[2]}
    rotation.x={-Math.PI / 2}
    rotation.z={moonBearing}
    renderOrder={81}
  />
{/if}
