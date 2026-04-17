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
  import { getEffectsConfigContext as getUnifiedEffectsState } from "$lib/shared/effects/state/effects-config-context";
  import { resolveMotion3D, resolveSparkles3D, resolveZap3D } from "$lib/shared/effects/translators/webgl3d-translator";
  import { AUSTEN_STAFF } from "../config/avatar-proportions";
  import { TrackingMode, TrailStyle } from "./types";

  // Effect components
  import TrailRenderer from "./trails/TrailRenderer.svelte";
  import RibbonTrail3D from "./trails/RibbonTrail3D.svelte";
  import FireEmitter from "./particles/FireEmitter.svelte";
  import SparkleEmitter from "./particles/SparkleEmitter.svelte";
  import ElectricityArc from "./energy/ElectricityArc.svelte";
  import PropMotionEffects from "./motion/PropMotionEffects.svelte";
  import MotionBlur from "./motion/MotionBlur.svelte";
  import SpeedLines from "./motion/SpeedLines.svelte";

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
  const unifiedState = getUnifiedEffectsState();
  const zap3D = $derived(unifiedState ? resolveZap3D(unifiedState.zap) : null);
  const zapEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "zap" : false,
  );
  const sparkles3D = $derived(unifiedState ? resolveSparkles3D(unifiedState.sparkles) : null);
  const sparklesEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "sparkles" : false,
  );
  const motion3D = $derived(unifiedState ? resolveMotion3D(unifiedState.motion) : null);
  const motionEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "motion" : false,
  );

  /**
   * Pick a per-tip color for unified motion intent. Tip indices:
   * 0 = blueA, 1 = blueB, 2 = redA, 3 = redB.
   *
   * `velocity` mode falls back to motion3D.color in 3D — per-frame velocity
   * hue requires per-emitter derived state and adds noise without much payoff
   * in 3D where the tip already moves through space (deferred).
   */
  function pickMotionColor(i: number): string {
    if (!motion3D) return "#ffffff";
    if (motion3D.colorMode === "prop-matched") {
      const isBlue = i < 2;
      const trails = unifiedState?.trails;
      if (isBlue) return trails?.blueColor ?? "#3b82f6";
      return trails?.redColor ?? "#ef4444";
    }
    if (motion3D.colorMode === "rainbow") {
      const hue = (Date.now() * 0.05 + i * 90) % 360;
      return `hsl(${hue}, 80%, 60%)`;
    }
    // solid + velocity (deferred) → motion3D.color
    return motion3D.color;
  }

  function pickSparkleColor(i: number): string {
    if (!sparkles3D) return "#ffffff";
    if (sparkles3D.colorMode === "solid") return sparkles3D.color;
    if (sparkles3D.colorMode === "palette" && sparkles3D.palette.length > 0) {
      return sparkles3D.palette[i % sparkles3D.palette.length]!;
    }
    // rainbow mode — rotate hue by emitter index
    const hue = (Date.now() * 0.05 + i * 90) % 360;
    return `hsl(${hue}, 80%, 60%)`;
  }

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
{#if sparklesEnabled && sparkles3D && isPlaying}
  {#if blueEnds}
    <SparkleEmitter
      position={blueEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(0)}
      spread={sparkles3D.spread}
    />
    <SparkleEmitter
      position={blueEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(1)}
      spread={sparkles3D.spread * 0.75}
    />
  {/if}

  {#if redEnds}
    <SparkleEmitter
      position={redEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(2)}
      spread={sparkles3D.spread}
    />
    <SparkleEmitter
      position={redEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(3)}
      spread={sparkles3D.spread * 0.75}
    />
  {/if}
{/if}

<!-- =============================================================================
     Electricity / Zap Effects (sourced from unified intent layer via resolveZap3D)
     ============================================================================= -->
{#if zapEnabled && zap3D && isPlaying}
  {#if bluePropState && redPropState && blueEnds && redEnds}
    <ElectricityArc
      start={blueEnds.positive}
      end={redEnds.positive}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.leftColor}
      mode={zap3D.mode}
    />
    <ElectricityArc
      start={blueEnds.negative}
      end={redEnds.negative}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.rightColor}
      mode={zap3D.mode}
    />
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

<!-- =============================================================================
     Unified Motion intent (Phase 1d) — velocity-gated MotionBlur + SpeedLines
     per tip, sourced from the unified intent layer via resolveMotion3D.
     Lives alongside the legacy PropMotionEffects mount above; Phase 3 retires
     the legacy path.
     ============================================================================= -->
{#if motionEnabled && motion3D && isPlaying}
  {@const blueTrail = effectState.getTrailPoints("blue", 2)}
  {@const redTrail = effectState.getTrailPoints("red", 2)}
  {@const bluePrev = blueTrail[1]?.position ?? blueCenter}
  {@const redPrev = redTrail[1]?.position ?? redCenter}
  {@const trailCount = Math.max(1, Math.floor(3 + motion3D.blur * 6))}
  {@const speedMaxLength = motion3D.length * 1.2}

  {#if blueEnds && bluePrev}
    <MotionBlur
      currentPosition={blueEnds.positive}
      previousPosition={bluePrev}
      enabled={motion3D.blur > 0}
      intensity={motion3D.blur}
      threshold={motion3D.threshold}
      color={pickMotionColor(0)}
      trailCount={trailCount}
    />
    <SpeedLines
      currentPosition={blueEnds.positive}
      previousPosition={bluePrev}
      enabled={motion3D.speedLines > 0}
      intensity={motion3D.speedLines}
      threshold={motion3D.threshold}
      color={pickMotionColor(0)}
      lineCount={motion3D.count}
      maxLength={speedMaxLength}
    />
    <MotionBlur
      currentPosition={blueEnds.negative}
      previousPosition={bluePrev}
      enabled={motion3D.blur > 0}
      intensity={motion3D.blur}
      threshold={motion3D.threshold}
      color={pickMotionColor(1)}
      trailCount={trailCount}
    />
    <SpeedLines
      currentPosition={blueEnds.negative}
      previousPosition={bluePrev}
      enabled={motion3D.speedLines > 0}
      intensity={motion3D.speedLines}
      threshold={motion3D.threshold}
      color={pickMotionColor(1)}
      lineCount={motion3D.count}
      maxLength={speedMaxLength}
    />
  {/if}

  {#if redEnds && redPrev}
    <MotionBlur
      currentPosition={redEnds.positive}
      previousPosition={redPrev}
      enabled={motion3D.blur > 0}
      intensity={motion3D.blur}
      threshold={motion3D.threshold}
      color={pickMotionColor(2)}
      trailCount={trailCount}
    />
    <SpeedLines
      currentPosition={redEnds.positive}
      previousPosition={redPrev}
      enabled={motion3D.speedLines > 0}
      intensity={motion3D.speedLines}
      threshold={motion3D.threshold}
      color={pickMotionColor(2)}
      lineCount={motion3D.count}
      maxLength={speedMaxLength}
    />
    <MotionBlur
      currentPosition={redEnds.negative}
      previousPosition={redPrev}
      enabled={motion3D.blur > 0}
      intensity={motion3D.blur}
      threshold={motion3D.threshold}
      color={pickMotionColor(3)}
      trailCount={trailCount}
    />
    <SpeedLines
      currentPosition={redEnds.negative}
      previousPosition={redPrev}
      enabled={motion3D.speedLines > 0}
      intensity={motion3D.speedLines}
      threshold={motion3D.threshold}
      color={pickMotionColor(3)}
      lineCount={motion3D.count}
      maxLength={speedMaxLength}
    />
  {/if}
{/if}
