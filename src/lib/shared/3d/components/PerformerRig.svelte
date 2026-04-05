<script lang="ts">
  /**
   * PerformerRig — Unified 3D Transform Hierarchy
   *
   * Replaces the sibling-based scene graph where avatar, grid, props, and
   * effects each independently computed their world positions. Instead,
   * everything is a child of this component's transform hierarchy, so
   * position, facing, and shoulder height are inherited through the scene
   * graph automatically. No manual cos/sin. No STAGE_LIFT trick. No
   * skipFacingTransform flag.
   *
   * Hierarchy:
   *   PerformerRig (T.Group) — position=[x, groundOffset, z], rotation.y=facingAngle
   *   ├── Avatar3D (conditional)
   *   ├── ShoulderAnchor (T.Group, y=shoulderHeight)
   *   │   ├── GridAnchor (conditional, dual-wheel vs single grid)
   *   │   ├── Blue HandAnchor + PropAnchor
   *   │   ├── Red HandAnchor + PropAnchor
   *   │   └── EffectOrchestrator3D (conditional)
   *   └── Extras slot (snippet)
   */

  import { T } from "@threlte/core";
  import type { Group } from "three";
  import type { Snippet } from "svelte";
  import Avatar3D from "./Avatar3D.svelte";
  import Grid3D from "./Grid3D.svelte";
  import Prop3D from "./props/Prop3D.svelte";
  import EffectOrchestrator3D from "../effects/EffectOrchestrator3D.svelte";
  import { Plane } from "../domain/enums/Plane";
  import { PlaneMode } from "../domain/enums/PlaneMode";
  import {
    GRID_OFFSETS,
    PLANE_MODE_CONFIGS,
  } from "../domain/constants/plane-mode-configs";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropState3D } from "../domain/models/PropState3D";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { GridMode } from "../domain/constants/grid-layout";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";

  interface Props {
    /** World position (x/z). y=0 is ground level. */
    position: { x: number; z: number };
    /** Avatar body facing direction (radians, 0 = +Z toward audience) */
    facingAngle: number;
    /** Height from ground to shoulder (meters). Drives ShoulderAnchor y. */
    shoulderHeight?: number;
    /** Determines grid offset, lateral hand positions */
    planeMode: PlaneMode;
    /** Avatar instance that provides prop states, step configs, etc. */
    avatarState: AvatarInstanceState;

    // Visibility toggles (all default true)
    showAvatar?: boolean;
    showGrid?: boolean;
    showProps?: boolean;
    showEffects?: boolean;

    // Grid config
    visiblePlanes?: Set<Plane>;
    gridMode?: GridMode;

    // Prop types
    bluePropType?: PropType;
    redPropType?: PropType;

    // Prop state overrides (for mirror mode — caller swaps before passing)
    bluePropState?: PropState3D | null;
    redPropState?: PropState3D | null;

    // Effects
    tipEffectMap?: TipEffectMap;
    isPlaying?: boolean;
    staffHalfLength?: number;

    // Vertical offset (museum platforms, stages)
    groundOffset?: number;

    // Extension point for consumer-specific content (e.g. platform meshes, labels)
    extras?: Snippet;
  }

  let {
    position,
    facingAngle,
    shoulderHeight = -userProportionsState.groundY,
    planeMode,
    avatarState,
    showAvatar = true,
    showGrid = true,
    showProps = true,
    showEffects = true,
    visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]),
    gridMode = "diamond" as GridMode,
    bluePropType = PropType.STAFF,
    redPropType = PropType.STAFF,
    bluePropState: bluePropStateOverride,
    redPropState: redPropStateOverride,
    tipEffectMap = {},
    isPlaying = false,
    staffHalfLength = userProportionsState.staffLength / 2,
    groundOffset = 0,
    extras,
  }: Props = $props();

  // Resolve prop states: use overrides (for mirror mode) or avatarState defaults
  const bluePropState = $derived(bluePropStateOverride ?? avatarState.bluePropState);
  const redPropState = $derived(redPropStateOverride ?? avatarState.redPropState);

  // Derive mode config and grid offset from the current plane mode
  const modeConfig = $derived(PLANE_MODE_CONFIGS[planeMode]);
  const gridOffset = $derived(GRID_OFFSETS[planeMode]);
  const isDualWheel = $derived(planeMode === PlaneMode.DUAL_WHEEL);

  // HandAnchor positions relative to ShoulderAnchor.
  // Wall mode: both hands at z=gridOffset (grid center is forward of body).
  // Dual-wheel: hands at lateral offsets, z=0 (grid at solar plexus).
  const blueHandPos = $derived({
    x: modeConfig.blueLateralOffset,
    y: 0,
    z: isDualWheel ? 0 : gridOffset,
  });
  const redHandPos = $derived({
    x: modeConfig.redLateralOffset,
    y: 0,
    z: isDualWheel ? 0 : gridOffset,
  });

  // PropAnchor refs — these are the Three.js Group objects that Avatar3D
  // and EffectOrchestrator3D will read world positions from (Tasks 7, 8).
  let bluePropAnchorRef = $state<Group | undefined>(undefined);
  let redPropAnchorRef = $state<Group | undefined>(undefined);
</script>

<!-- Root: position in world space, apply facing rotation -->
<T.Group
  position.x={position.x}
  position.y={groundOffset}
  position.z={position.z}
  rotation.y={facingAngle}
>
  <!-- Avatar3D uses groundY (~-1.56) internally to position its mesh,
       so shoulders end up near y=0 in rig space. No position.y needed. -->
  {#if showAvatar}
    <Avatar3D
      id={avatarState.id}
      bluePropState={bluePropState}
      redPropState={redPropState}
      facingAngle={0}
      position={{ x: 0, z: 0 }}
      isActive={false}
      isMoving={false}
      bluePropAnchorRef={bluePropAnchorRef}
      redPropAnchorRef={redPropAnchorRef}
    />
  {/if}

  <!-- No ShoulderAnchor offset needed. Avatar3D positions its mesh using
       groundY so shoulders land near y=0 in rig space. The interpolator
       outputs positions relative to grid center (also y=0 = shoulder).
       Everything lives at the same coordinate origin. -->
  <T.Group>

    <!-- Grid rendering -->
    {#if showGrid}
      {#if isDualWheel}
        <!-- Dual-wheel: two grids offset laterally (one per hand) -->
        <Grid3D
          visiblePlanes={new Set([Plane.WHEEL])}
          centerPosition={{ x: modeConfig.blueLateralOffset, y: 0, z: 0 }}
          facingAngle={0}
          gridOffset={0}
          planeOpacity={0.10}
          showLabels={false}
          {gridMode}
        />
        <Grid3D
          visiblePlanes={new Set([Plane.WHEEL])}
          centerPosition={{ x: modeConfig.redLateralOffset, y: 0, z: 0 }}
          facingAngle={0}
          gridOffset={0}
          planeOpacity={0.10}
          showLabels={false}
          {gridMode}
        />
      {:else}
        <!-- Single grid: centered on body, offset forward by gridOffset -->
        <Grid3D
          {visiblePlanes}
          centerPosition={{ x: 0, y: 0, z: 0 }}
          facingAngle={0}
          gridOffset={gridOffset}
          planeOpacity={0.12}
          showLabels={false}
          {gridMode}
        />
      {/if}
    {/if}

    <!-- Blue hand: HandAnchor positions the hand's grid center -->
    <T.Group
      position.x={blueHandPos.x}
      position.y={blueHandPos.y}
      position.z={blueHandPos.z}
    >
      <!-- PropAnchor: positioned at the interpolated prop location relative to hand -->
      {#if bluePropState}
        <T.Group
          bind:ref={bluePropAnchorRef}
          position.x={bluePropState.worldPosition.x}
          position.y={bluePropState.worldPosition.y}
          position.z={bluePropState.worldPosition.z}
        >
          {#if showProps}
            <Prop3D
              propType={bluePropType}
              propState={bluePropState}
              color="blue"
            />
          {/if}
        </T.Group>
      {/if}
    </T.Group>

    <!-- Red hand: same pattern as blue -->
    <T.Group
      position.x={redHandPos.x}
      position.y={redHandPos.y}
      position.z={redHandPos.z}
    >
      {#if redPropState}
        <T.Group
          bind:ref={redPropAnchorRef}
          position.x={redPropState.worldPosition.x}
          position.y={redPropState.worldPosition.y}
          position.z={redPropState.worldPosition.z}
        >
          {#if showProps}
            <Prop3D
              propType={redPropType}
              propState={redPropState}
              color="red"
            />
          {/if}
        </T.Group>
      {/if}
    </T.Group>

    <!-- Effects sit at shoulder level alongside props -->
    {#if showEffects}
      <EffectOrchestrator3D
        {bluePropState}
        {redPropState}
        {isPlaying}
        {staffHalfLength}
        globalTipEffectMap={tipEffectMap}
        bluePropAnchorRef={bluePropAnchorRef}
        redPropAnchorRef={redPropAnchorRef}
      />
    {/if}

  </T.Group>

  <!-- Extras slot: consumer-specific content (platform meshes, labels, etc.) -->
  {#if extras}
    {@render extras()}
  {/if}
</T.Group>
