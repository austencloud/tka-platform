<script lang="ts">
  /**
   * PerformerRig — Unified 3D Transform Hierarchy
   *
   * One T.Group owns position + facingAngle. Avatar, grid, props, and
   * effects are all children. The scene graph guarantees frame-perfect
   * attachment. No manual cos/sin. No STAGE_LIFT trick.
   *
   * Hierarchy:
   *   PerformerRig (T.Group) — position=[x, groundOffset, z], rotation.y=facingAngle
   *   ├── Avatar3D (conditional)
   *   ├── Grid (conditional, dual-wheel renders two wheel grids)
   *   ├── Blue HandAnchor → PropAnchor
   *   ├── Red HandAnchor → PropAnchor
   *   └── EffectsGroup → EffectOrchestrator3D
   */

  import { T } from "@threlte/core";
  import type { Group } from "three";
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

  // Constant sets to avoid allocating new Set objects on every reactive update.
  const WHEEL_ONLY = new Set([Plane.WHEEL]);

  interface Props {
    /** World position (x/z). y=0 is ground level. */
    position: { x: number; z: number };
    /** Avatar body facing direction (radians, 0 = +Z toward audience) */
    facingAngle: number;
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

    // Avatar model selection
    avatarId?: import("../config/avatar-definitions").AvatarId;

    // Locomotion (walk/idle animation)
    enableLocomotion?: boolean;
    isMoving?: boolean;
    moveSpeed?: number;
  }

  let {
    position,
    facingAngle,
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
    avatarId,
    enableLocomotion = false,
    isMoving = false,
    moveSpeed = 0,
  }: Props = $props();

  // Resolve prop states: use overrides (for mirror mode) or avatarState defaults
  const bluePropState = $derived(bluePropStateOverride ?? avatarState.bluePropState);
  const redPropState = $derived(redPropStateOverride ?? avatarState.redPropState);

  // Derive mode config and grid offset from the current plane mode
  const modeConfig = $derived(PLANE_MODE_CONFIGS[planeMode]);
  const gridOffset = $derived(GRID_OFFSETS[planeMode]);
  const isDualWheel = $derived(planeMode === PlaneMode.DUAL_WHEEL);

  // HandAnchor positions in rig-local space.
  // Wall mode: both hands at z=gridOffset (grid center is forward of body).
  // Dual-wheel: hands at lateral offsets, z=0 (grid at solar plexus).
  // HandAnchor positions only vary in x (lateral) and z (forward offset).
  // y is always 0 — hands orbit at the same height as the rig origin.
  const blueHandPos = $derived({
    x: modeConfig.blueLateralOffset,
    z: isDualWheel ? 0 : gridOffset,
  });
  const redHandPos = $derived({
    x: modeConfig.redLateralOffset,
    z: isDualWheel ? 0 : gridOffset,
  });

  // PropAnchor refs — Avatar3D reads world positions from these for IK targeting.
  let bluePropAnchorRef = $state<Group | undefined>(undefined);
  let redPropAnchorRef = $state<Group | undefined>(undefined);

  // Effects group ref — imperative renderers add meshes here so they
  // inherit the rig's transform.
  let effectsGroupRef = $state<Group | undefined>(undefined);
</script>

<!-- Root: position in world space, apply facing rotation -->
<T.Group
  position.x={position.x}
  position.y={groundOffset}
  position.z={position.z}
  rotation.y={facingAngle}
>
  <!-- Avatar3D uses groundY (~-1.56) internally to position its mesh,
       so shoulders end up near y=0 in rig space. -->
  {#if showAvatar}
    <Avatar3D
      id={avatarState.id}
      {avatarId}
      bluePropState={bluePropState}
      redPropState={redPropState}
      facingAngle={0}
      position={{ x: 0, z: 0 }}
      isActive={false}
      {isMoving}
      {moveSpeed}
      {enableLocomotion}
      bluePropAnchorRef={bluePropAnchorRef}
      redPropAnchorRef={redPropAnchorRef}
    />
  {/if}

  <!-- Grid -->
  {#if showGrid}
    {#if isDualWheel}
      <T.Group position.x={modeConfig.blueLateralOffset}>
        <Grid3D
          visiblePlanes={WHEEL_ONLY}
          planeOpacity={0.10}
          showLabels={false}
          {gridMode}
        />
      </T.Group>
      <T.Group position.x={modeConfig.redLateralOffset}>
        <Grid3D
          visiblePlanes={WHEEL_ONLY}
          planeOpacity={0.10}
          showLabels={false}
          {gridMode}
        />
      </T.Group>
    {:else}
      <T.Group position.z={gridOffset}>
        <Grid3D
          {visiblePlanes}
          planeOpacity={0.12}
          showLabels={false}
          {gridMode}
        />
      </T.Group>
    {/if}
  {/if}

  <!-- Blue HandAnchor + PropAnchor -->
  <T.Group
    position.x={blueHandPos.x}
    position.z={blueHandPos.z}
  >
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

  <!-- Red HandAnchor + PropAnchor -->
  <T.Group
    position.x={redHandPos.x}
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

  <!-- Effects in rig-local space -->
  {#if showEffects}
    <T.Group bind:ref={effectsGroupRef}>
      <EffectOrchestrator3D
        {bluePropState}
        {redPropState}
        {isPlaying}
        {staffHalfLength}
        globalTipEffectMap={tipEffectMap}
        {blueHandPos}
        {redHandPos}
        effectsParentRef={effectsGroupRef}
      />
    </T.Group>
  {/if}
</T.Group>
