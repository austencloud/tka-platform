<script lang="ts">
  /**
   * EffectsLayer Component
   *
   * Orchestrates all visual effects for the 3D viewer.
   * Reads prop states from animation state and configuration from effects state.
   * Renders enabled effects with proper positioning.
   *
   * Must be placed inside Scene3D's children snippet to be part of the 3D scene.
   */

  import { Vector3, Quaternion, Euler } from "three";
  import { useTask } from "@threlte/core";
  import type { PropState3D } from "../domain/models/PropState3D";
  import { getEffectState } from "./state/effect-state.svelte";
  import { getEffectsConfigState } from "./state/effects-config-state.svelte";
  import { AUSTEN_STAFF } from "../config/avatar-proportions";
  import { TrackingMode, TrailStyle } from "./types";

  // Effect components
  import TrailRenderer from "./trails/TrailRenderer.svelte";
  import RibbonTrail3D from "./trails/RibbonTrail3D.svelte";
  import FireEmitter from "./particles/FireEmitter.svelte";
  import SparkleEmitter from "./particles/SparkleEmitter.svelte";
  import ElectricityArc from "./energy/ElectricityArc.svelte";
  import PropMotionEffects from "./motion/PropMotionEffects.svelte";

  interface Props {
    /** Blue prop state from animation */
    bluePropState: PropState3D | null;
    /** Red prop state from animation */
    redPropState: PropState3D | null;
    /** Whether animation is currently playing */
    isPlaying: boolean;
    /** Staff length for end position calculations */
    staffLength?: number;
  }

  let {
    bluePropState,
    redPropState,
    isPlaying,
    staffLength = AUSTEN_STAFF.length,
  }: Props = $props();

  // Get state instances
  const effectState = getEffectState();
  const configState = getEffectsConfigState();

  // Half staff length for calculating prop ends
  const halfLength = $derived(staffLength / 2);

  // =============================================================================
  // Calculate Prop End Positions
  // =============================================================================

  /**
   * Calculate the two end positions of a staff given its state
   * Must match the exact rotation logic used in Staff3D.svelte
   */
  function calculatePropEnds(propState: PropState3D): {
    positive: Vector3;
    negative: Vector3;
  } {
    const center = propState.worldPosition.clone();

    // Staff3D applies: finalQuat = worldRotation.clone().multiply(horizontalQuat)
    // where horizontalQuat is 90° around Z axis
    // This makes the cylinder (which is vertical by default along Y) horizontal
    const horizontalQuat = new Quaternion().setFromEuler(
      new Euler(0, 0, Math.PI / 2)
    );
    const finalQuat = propState.worldRotation.clone().multiply(horizontalQuat);

    // After this combined rotation, the staff's Y axis points in the staff direction
    const localAxis = new Vector3(0, 1, 0);
    const worldAxis = localAxis.applyQuaternion(finalQuat);

    // Calculate end positions
    const positive = center
      .clone()
      .add(worldAxis.clone().multiplyScalar(halfLength));
    const negative = center
      .clone()
      .add(worldAxis.clone().multiplyScalar(-halfLength));

    return { positive, negative };
  }

  // Derived prop end positions
  const blueEnds = $derived.by(() => {
    if (!bluePropState) return null;
    return calculatePropEnds(bluePropState);
  });

  const redEnds = $derived.by(() => {
    if (!redPropState) return null;
    return calculatePropEnds(redPropState);
  });

  // Blue prop center for trail/motion effects
  const blueCenter = $derived(bluePropState?.worldPosition ?? null);
  const redCenter = $derived(redPropState?.worldPosition ?? null);

  // =============================================================================
  // Position History Updates
  // =============================================================================

  // Update position history each frame when playing
  useTask(() => {
    if (!isPlaying) return;

    effectState.updatePositions(
      bluePropState?.worldPosition ?? null,
      redPropState?.worldPosition ?? null
    );
  });

  // Clear history when not playing or prop states change significantly
  $effect(() => {
    if (!isPlaying) {
      effectState.clear();
    }
  });

  // =============================================================================
  // Derived Effect States
  // =============================================================================

  // Check if we have enough history for trail effects
  const hasBlueTrailHistory = $derived(
    effectState.hasEnoughHistory(
      "blue",
      configState.trails.length > 10 ? 10 : 2
    )
  );
  const hasRedTrailHistory = $derived(
    effectState.hasEnoughHistory("red", configState.trails.length > 10 ? 10 : 2)
  );

  // Trail positions for each prop
  const blueTrailPositions = $derived(
    effectState.getPositions("blue", configState.trails.length)
  );
  const redTrailPositions = $derived(
    effectState.getPositions("red", configState.trails.length)
  );

  // Velocities for velocity-reactive effects
  const blueVelocity = $derived(effectState.getVelocity("blue"));
  const redVelocity = $derived(effectState.getVelocity("red"));

  // Velocity as Vector3 for fire emitter (approximated from position changes)
  const blueVelocityVec = $derived.by(() => {
    const history = effectState.getTrailPoints("blue", 2);
    if (history.length < 2) return new Vector3(0, 0, 0);
    const curr = history[0]!.position;
    const prev = history[1]!.position;
    return curr.clone().sub(prev);
  });

  const redVelocityVec = $derived.by(() => {
    const history = effectState.getTrailPoints("red", 2);
    if (history.length < 2) return new Vector3(0, 0, 0);
    const curr = history[0]!.position;
    const prev = history[1]!.position;
    return curr.clone().sub(prev);
  });
</script>

<!-- =============================================================================
     Trail Effects - Physics-based ribbons attached to prop ends
     ============================================================================= -->
{#if configState.trails.enabled && isPlaying}
  {@const trackMode = configState.trails.trackingMode}
  {@const isRainbow = configState.trails.color === "rainbow"}
  {@const showLeftEnd =
    trackMode === TrackingMode.LEFT_END || trackMode === TrackingMode.BOTH_ENDS}
  {@const showRightEnd =
    trackMode === TrackingMode.RIGHT_END ||
    trackMode === TrackingMode.BOTH_ENDS}

  <!-- Blue prop ribbons -->
  {#if blueEnds}
    {#if showRightEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.positive}
        color={isRainbow ? "rainbow" : "#3b82f6"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width}
        opacity={configState.trails.opacity}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
    {#if showLeftEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.negative}
        color={isRainbow ? "rainbow" : "#60a5fa"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width * 0.8}
        opacity={configState.trails.opacity * 0.7}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
  {/if}

  <!-- Red prop ribbons -->
  {#if redEnds}
    {#if showRightEnd}
      <RibbonTrail3D
        attachPoint={redEnds.positive}
        color={isRainbow ? "rainbow" : "#ef4444"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width}
        opacity={configState.trails.opacity}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
    {#if showLeftEnd}
      <RibbonTrail3D
        attachPoint={redEnds.negative}
        color={isRainbow ? "rainbow" : "#f87171"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width * 0.8}
        opacity={configState.trails.opacity * 0.7}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
  {/if}
{/if}

<!-- =============================================================================
     Fire Effects (on prop ends)
     ============================================================================= -->
{#if configState.fire.enabled && isPlaying}
  <!-- Blue prop fire -->
  {#if blueEnds}
    <FireEmitter
      position={blueEnds.positive}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={blueVelocityVec}
    />
    <FireEmitter
      position={blueEnds.negative}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity * 0.7}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={blueVelocityVec}
    />
  {/if}

  <!-- Red prop fire -->
  {#if redEnds}
    <FireEmitter
      position={redEnds.positive}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={redVelocityVec}
    />
    <FireEmitter
      position={redEnds.negative}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity * 0.7}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={redVelocityVec}
    />
  {/if}
{/if}

<!-- =============================================================================
     Sparkle Effects (on prop ends)
     ============================================================================= -->
{#if configState.sparkles.enabled && isPlaying}
  <!-- Blue prop sparkles -->
  {#if blueEnds}
    <SparkleEmitter
      position={blueEnds.positive}
      enabled={configState.sparkles.enabled}
      intensity={configState.sparkles.rate}
      color="#60a5fa"
      spread={configState.sparkles.size * 200}
    />
    <SparkleEmitter
      position={blueEnds.negative}
      enabled={configState.sparkles.enabled}
      intensity={configState.sparkles.rate * 0.7}
      color="#93c5fd"
      spread={configState.sparkles.size * 150}
    />
  {/if}

  <!-- Red prop sparkles -->
  {#if redEnds}
    <SparkleEmitter
      position={redEnds.positive}
      enabled={configState.sparkles.enabled}
      intensity={configState.sparkles.rate}
      color="#f87171"
      spread={configState.sparkles.size * 200}
    />
    <SparkleEmitter
      position={redEnds.negative}
      enabled={configState.sparkles.enabled}
      intensity={configState.sparkles.rate * 0.7}
      color="#fca5a5"
      spread={configState.sparkles.size * 150}
    />
  {/if}
{/if}

<!-- =============================================================================
     Electricity Effects
     ============================================================================= -->
{#if configState.electricity.enabled && isPlaying}
  <!-- Blue prop electricity -->
  {#if blueEnds}
    {#if configState.electricity.segments > 3}
      <!-- Arc mode: connect the two ends -->
      <ElectricityArc
        start={blueEnds.positive}
        end={blueEnds.negative}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity}
        color="#88ccff"
        mode="arc"
      />
    {:else}
      <!-- Crackle mode: radiate from each end -->
      <ElectricityArc
        start={blueEnds.positive}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity}
        color="#88ccff"
        mode="crackle"
      />
      <ElectricityArc
        start={blueEnds.negative}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity * 0.6}
        color="#88ccff"
        mode="crackle"
      />
    {/if}
  {/if}

  <!-- Red prop electricity -->
  {#if redEnds}
    {#if configState.electricity.segments > 3}
      <ElectricityArc
        start={redEnds.positive}
        end={redEnds.negative}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity}
        color="#ff8888"
        mode="arc"
      />
    {:else}
      <ElectricityArc
        start={redEnds.positive}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity}
        color="#ff8888"
        mode="crackle"
      />
      <ElectricityArc
        start={redEnds.negative}
        enabled={configState.electricity.enabled}
        intensity={configState.electricity.intensity * 0.6}
        color="#ff8888"
        mode="crackle"
      />
    {/if}
  {/if}
{/if}

<!-- =============================================================================
     Motion Effects (blur and speed lines)
     ============================================================================= -->
{#if (configState.motion.blur || configState.motion.speedLines) && isPlaying}
  {#if blueCenter}
    <PropMotionEffects
      position={blueCenter}
      color="blue"
      enableBlur={configState.motion.blur}
      enableSpeedLines={configState.motion.speedLines}
      intensity={configState.motion.intensity}
      threshold={configState.motion.threshold}
    />
  {/if}

  {#if redCenter}
    <PropMotionEffects
      position={redCenter}
      color="red"
      enableBlur={configState.motion.blur}
      enableSpeedLines={configState.motion.speedLines}
      intensity={configState.motion.intensity}
      threshold={configState.motion.threshold}
    />
  {/if}
{/if}
