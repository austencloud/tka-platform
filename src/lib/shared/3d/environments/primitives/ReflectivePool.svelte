<script lang="ts">
  /**
   * ReflectivePool — a horizontal body of water: PlanarReflector driving the
   * ReflectivePoolShader, plus the clock that moves its ripples.
   *
   * The reflection technique still belongs to PlanarReflector. This composes
   * it with water optics (Fresnel, depth absorption, ripple normals, foam) so
   * the surface reads as liquid instead of as an opening in the floor.
   */
  import { useTask } from "@threlte/core";
  import { Color, Vector2, Vector3, type ShaderMaterial } from "three";
  import type { Reflector } from "three/examples/jsm/objects/Reflector.js";

  import PlanarReflector from "./PlanarReflector.svelte";
  import {
    REFLECTIVE_POOL_DEFAULTS,
    ReflectivePoolShader,
  } from "./reflective-pool-shader";

  interface Props {
    /** Metres along world X. */
    width: number;
    /** Metres along world Z. */
    depth: number;
    /** Centre of the surface in world space. */
    position: [number, number, number];
    /** Local XY shoreline in metres for a non-rectangular body of water. */
    outline?: Array<[number, number]>;
    textureWidth?: number;
    textureHeight?: number;
    deepColor?: string | number;
    shallowColor?: string | number;
    reflectionTint?: number;
    sunDirection?: [number, number, number];
    rippleScale?: number;
    rippleStrength?: number;
    foamWidth?: number;
    /** Allows natural rock or terrain to own the shoreline instead of foam. */
    foamOpacity?: number;
    /** Metres over which the rim colour gives way to the deep colour. */
    shoreFade?: number;
    /**
     * Wave amplitude at the surface's west (u=0) and east (u=1) edges,
     * interpolated across it. 1 is the surface as authored, 0 is dead flat.
     * Lets one long body of water change state along its length instead of
     * being cut into separate surfaces, which would foam at every internal cut.
     */
    waveAmplitudeStart?: number;
    waveAmplitudeEnd?: number;
    /** Ripple speed multiplier. Still water is not motionless water. */
    flowSpeed?: number;
    active?: boolean;
  }

  const props: Props = $props();

  const defaults = REFLECTIVE_POOL_DEFAULTS;
  const MAX_SHORELINE_SEGMENTS = 16;

  function resolveShoreline(): Array<[number, number]> {
    if (props.outline && props.outline.length >= 3) {
      return props.outline.slice(0, MAX_SHORELINE_SEGMENTS);
    }

    const halfWidth = props.width / 2;
    const halfDepth = props.depth / 2;
    return [
      [-halfWidth, -halfDepth],
      [halfWidth, -halfDepth],
      [halfWidth, halfDepth],
      [-halfWidth, halfDepth],
    ];
  }

  const shoreline = resolveShoreline();
  const shorelineStarts = Array.from(
    { length: MAX_SHORELINE_SEGMENTS },
    (_, index) => {
      const point = shoreline[index % shoreline.length]!;
      return new Vector2(point[0], point[1]);
    }
  );
  const shorelineEnds = Array.from(
    { length: MAX_SHORELINE_SEGMENTS },
    (_, index) => {
      const point = shoreline[(index + 1) % shoreline.length]!;
      return new Vector2(point[0], point[1]);
    }
  );

  const uniforms: Record<string, unknown> = {
    uDeepColor: new Color(props.deepColor ?? defaults.deepColor),
    uShallowColor: new Color(props.shallowColor ?? defaults.shallowColor),
    uSize: new Vector2(props.width, props.depth),
    uSunDirection: props.sunDirection
      ? new Vector3(...props.sunDirection).normalize()
      : defaults.sunDirection.clone(),
    uSunColor: defaults.sunColor.clone(),
    uRippleScale: props.rippleScale ?? defaults.rippleScale,
    uRippleStrength: props.rippleStrength ?? defaults.rippleStrength,
    uFoamWidth: props.foamWidth ?? defaults.foamWidth,
    uFoamOpacity: props.foamOpacity ?? defaults.foamOpacity,
    uShoreFade: props.shoreFade ?? defaults.shoreFade,
    // A fresh Vector2 per pool: two pools must never share one instance.
    uWaveAmplitude: new Vector2(
      props.waveAmplitudeStart ?? defaults.waveAmplitudeStart,
      props.waveAmplitudeEnd ?? defaults.waveAmplitudeEnd
    ),
    uShorelineCount: shoreline.length,
    uShorelineStarts: shorelineStarts,
    uShorelineEnds: shorelineEnds,
    uTime: 0,
  };

  const flowSpeed = props.flowSpeed ?? 1;
  let material = $state.raw<ShaderMaterial | null>(null);

  function handleReady(reflector: Reflector): void {
    material = reflector.material as ShaderMaterial;
  }

  useTask((delta) => {
    const uTime = material?.uniforms.uTime;
    if (!uTime) return;
    uTime.value += delta * flowSpeed;
  });
</script>

<PlanarReflector
  width={props.width}
  height={props.depth}
  position={props.position}
  outline={props.outline}
  rotation={[-Math.PI / 2, 0, 0]}
  textureWidth={props.textureWidth ?? 1024}
  textureHeight={props.textureHeight ?? 1024}
  color={props.reflectionTint ?? defaults.reflectionTint.getHex()}
  shader={ReflectivePoolShader}
  {uniforms}
  active={props.active}
  onReady={handleReady}
/>
