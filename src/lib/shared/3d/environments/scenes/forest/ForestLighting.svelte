<script lang="ts">
  /**
   * ForestLighting
   *
   * The visible Sun or Moon owns the broad direction of the scene. A restrained
   * fill preserves bark and foliage on the camera side, while the Night Master
   * keeps one small pool on the performance clearing. Campsite lights remain in
   * ForestScene because they are local practicals tied to the fire.
   */

  import { T, useTask } from "@threlte/core";
  import { DirectionalLight, Object3D } from "three";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";
  import type { HemisphereLightConfig } from "../../domain/models/scene-configs/shared-scene-config";
  import {
    FOREST_NIGHT_LIGHTING,
    type ForestLightingConfig,
  } from "../../domain/models/scene-configs/forest-scene-config";

  interface Props {
    hemisphere: HemisphereLightConfig;
    profile?: ForestLightingConfig;
    groundY?: number;
    /** World-space center of the active shadow pool. */
    anchor?: { x: number; y: number; z: number };
    /** Site-scale consumers can widen the original clearing shadow camera. */
    shadowExtentMeters?: number;
    keyLightDistanceMeters?: number;
    /**
     * Keeps a moving site-scale shadow pool stable until its anchor crosses a
     * measured world-space cell. Omit this to preserve continuous tracking.
     */
    shadowAnchorSnapMeters?: number;
    /**
     * Dynamic shadow casters can refresh below render frequency. Zero keeps
     * Three's default every-frame shadow update behavior.
     */
    shadowRefreshIntervalSeconds?: number;
    /** Forces a shadow refresh when static scene dressing or lighting changes. */
    shadowRefreshToken?: string | number;
  }

  let {
    hemisphere,
    profile,
    groundY = 0,
    anchor = { x: 0, y: groundY, z: 0 },
    shadowExtentMeters,
    keyLightDistanceMeters = 64,
    shadowAnchorSnapMeters = 0,
    shadowRefreshIntervalSeconds = 0,
    shadowRefreshToken = 0,
  }: Props = $props();

  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const shadowsEnabled = $derived(
    adaptiveQuality?.config.enableShadows ?? true
  );
  const activeProfile = $derived(profile ?? FOREST_NIGHT_LIGHTING);
  const keyTarget = new Object3D();
  let keyLight = $state<DirectionalLight>();
  let shadowRefreshElapsed = 0;
  const resolvedShadowAnchorSnapMeters = $derived(
    Math.max(0, shadowAnchorSnapMeters)
  );
  const shadowAnchorX = $derived(
    snapShadowCoordinate(anchor.x, resolvedShadowAnchorSnapMeters)
  );
  const shadowAnchorY = $derived(
    snapShadowCoordinate(
      anchor.y,
      resolvedShadowAnchorSnapMeters > 0
        ? Math.min(1, resolvedShadowAnchorSnapMeters)
        : 0
    )
  );
  const shadowAnchorZ = $derived(
    snapShadowCoordinate(anchor.z, resolvedShadowAnchorSnapMeters)
  );
  const keyPosition = $derived.by(() => {
    const direction = activeProfile.key.direction;
    const length = Math.hypot(...direction);
    if (length === 0) {
      return [
        shadowAnchorX + 12,
        shadowAnchorY + 22,
        shadowAnchorZ - 58,
      ] as const;
    }

    return [
      shadowAnchorX + (direction[0] / length) * keyLightDistanceMeters,
      shadowAnchorY + (direction[1] / length) * keyLightDistanceMeters,
      shadowAnchorZ + (direction[2] / length) * keyLightDistanceMeters,
    ] as const;
  });

  function snapShadowCoordinate(value: number, gridMeters: number): number {
    if (gridMeters <= 0) return value;
    return Math.round(value / gridMeters) * gridMeters;
  }

  $effect(() => {
    const position = keyPosition;
    const light = keyLight;
    const controlledRefresh =
      resolvedShadowAnchorSnapMeters > 0 || shadowRefreshIntervalSeconds > 0;
    void shadowRefreshToken;
    keyTarget.position.set(shadowAnchorX, shadowAnchorY, shadowAnchorZ);
    keyTarget.updateMatrixWorld();
    if (!light) return;
    light.position.set(position[0], position[1], position[2]);
    light.target = keyTarget;
    light.updateMatrixWorld();
    light.shadow.autoUpdate = !controlledRefresh;
    light.shadow.needsUpdate = shadowsEnabled;
    shadowRefreshElapsed = 0;
  });

  useTask((delta) => {
    const light = keyLight;
    const interval = Math.max(0, shadowRefreshIntervalSeconds);
    if (!light || !shadowsEnabled || interval <= 0) return;
    shadowRefreshElapsed += Math.max(0, delta);
    if (shadowRefreshElapsed < interval) return;
    shadowRefreshElapsed %= interval;
    light.shadow.needsUpdate = true;
  });
</script>

<!-- The visible celestial body establishes one global light direction without
     paying for a full-canopy shadow pass. -->
<T.DirectionalLight
  bind:ref={keyLight}
  color={activeProfile.key.color}
  intensity={activeProfile.key.intensity}
  position.x={keyPosition[0]}
  position.y={keyPosition[1]}
  position.z={keyPosition[2]}
  target={keyTarget}
  castShadow={shadowsEnabled}
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.near={1}
  shadow.camera.far={140}
  shadow.camera.left={shadowExtentMeters ? -shadowExtentMeters : -28}
  shadow.camera.right={shadowExtentMeters ?? 48}
  shadow.camera.top={shadowExtentMeters ?? 30}
  shadow.camera.bottom={shadowExtentMeters ? -shadowExtentMeters : -30}
  shadow.bias={-0.0006}
  shadow.normalBias={0.035}
  shadow.radius={3}
  shadow.intensity={activeProfile.key.shadowIntensity}
/>
<T is={keyTarget} />

<!-- Camera-side canopy fill keeps bark and leaf color legible while the
     authored key still owns the shadows. -->
<T.DirectionalLight
  color={activeProfile.fill.color}
  intensity={activeProfile.fill.intensity}
  position.x={-18}
  position.y={7 + groundY}
  position.z={26}
/>

<T.HemisphereLight
  color={hemisphere.skyColor}
  groundColor={hemisphere.groundColor}
  intensity={hemisphere.intensity}
/>

<!-- A small ambient lift prevents dark materials from clipping after AgX. -->
<T.AmbientLight
  color={activeProfile.ambient.color}
  intensity={activeProfile.ambient.intensity}
/>

<!-- The Night Master gathers moonlight over the stage. Day turns this off. -->
{#if activeProfile.stage.intensity > 0}
  <T.PointLight
    color={activeProfile.stage.color}
    intensity={activeProfile.stage.intensity}
    distance={activeProfile.stage.distance}
    decay={2}
    position.x={-1.5}
    position.y={5.5 + groundY}
    position.z={2}
  />
{/if}
