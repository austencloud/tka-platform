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
  import type { PropState3D } from "@austencloud/scene-3d";
  import { getEffectState } from "./state/effect-state.svelte";
  import { getEffectsConfigContext as getUnifiedEffectsState } from "$lib/shared/effects/state/effects-config-context";
  import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { resolveGhost3D, resolveSparkles3D, resolveZap3D, resolveGoo3D, resolveBubbles3D, resolvePetals3D, resolveSmoke3D } from "$lib/shared/effects/translators/webgl3d-translator";
  import { AUSTEN_STAFF } from "@austencloud/scene-3d";

  // Effect components
  // Trails are no longer mounted here. The single consolidated 3D trail
  // (Trail3D ribbon) renders via EffectOrchestrator3D in PerformerRig's
  // effectsSlot.
  //
  // Mounted by EffectOrchestrator3D. This component owns the ONLY 3D renderers
  // for goo, bubbles, smoke, petals, sparkles, zap, ghost and bloom. It was
  // unmounted for a period, which silently cost those eight effects their 3D
  // path; tests/unit/effects/effect-orchestrator-mounts-layer.test.ts now
  // guards against that recurring.
  import SparkleEmitter from "./particles/SparkleEmitter.svelte";
  import ElectricityArc from "./energy/ElectricityArc.svelte";
  // PropMotionEffects is the LEGACY per-prop motion blur/speed-line mount
  // driven by configState.motion (the `effects-config-state` next to this
  // file, not the unified one). Phase 3 retires it. Ghost is the unified
  // intent-layer replacement, mounted via GhostStaff3D below.
  import PropMotionEffects from "./motion/PropMotionEffects.svelte";
  import GhostStaff3D from "./motion/GhostStaff3D.svelte";
  import BloomBillboard3D from "./post-processing/BloomBillboard3D.svelte";
  import WaterEmitter3D from "./water/WaterEmitter3D.svelte";
  import BubbleEmitter3D from "./bubbles/BubbleEmitter3D.svelte";
  import PetalEmitter3D from "./petals/PetalEmitter3D.svelte";
  import PetalAmbientShower3D from "./petals/PetalAmbientShower3D.svelte";
  import SmokeRenderer3D from "./smoke/SmokeRenderer3D.svelte";

  interface Props {
    /** Blue prop state from animation */
    bluePropState: PropState3D | null;
    /** Red prop state from animation */
    redPropState: PropState3D | null;
    /** Whether animation is currently playing */
    isPlaying: boolean;
    /** Staff length for end position calculations */
    staffLength?: number;
    /** Current animation step index (fractional). Used by Ghost (GhostStaff3D)
     *  to detect beat onsets and age phantoms. Default 0 when a parent
     *  hasn't plumbed it yet - Ghost stays silent rather than capturing a
     *  lone phantom at beat 0 every frame. */
    currentStep?: number;
  }

  let {
    bluePropState,
    redPropState,
    isPlaying,
    staffLength = AUSTEN_STAFF.length,
    currentStep = 0,
  }: Props = $props();

  // Get state instances
  const effectState = getEffectState();
  const unifiedState = getUnifiedEffectsState();
  const scene3DRender = getScene3DRenderContext();
  const zap3D = $derived(unifiedState ? resolveZap3D(unifiedState.zap) : null);
  const zapEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "zap" : false,
  );
  const sparkles3D = $derived(unifiedState ? resolveSparkles3D(unifiedState.sparkles) : null);
  const sparklesEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "sparkles" : false,
  );
  const ghost3D = $derived(unifiedState ? resolveGhost3D(unifiedState.ghost) : null);
  const ghostEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "ghost" : false,
  );
  const bloomIntent = $derived(unifiedState?.bloom ?? null);
  const bloomEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "bloom" : false,
  );
  const bloomBlueColor = $derived(unifiedState?.trails.blueColor ?? "#3b82f6");
  const bloomRedColor = $derived(unifiedState?.trails.redColor ?? "#ef4444");
  // 3D goo currently renders via the legacy WaterEmitter3D particle system; a dedicated 3D goo renderer is a follow-up.
  const goo3D = $derived(unifiedState ? resolveGoo3D(unifiedState.goo) : null);
  const gooEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "goo" : false,
  );
  const gooShowLeftEnd = $derived(
    goo3D?.trackingMode === "left_end" || goo3D?.trackingMode === "both_ends",
  );
  const gooShowRightEnd = $derived(
    goo3D?.trackingMode === "right_end" || goo3D?.trackingMode === "both_ends",
  );
  const bubbles3D = $derived(unifiedState ? resolveBubbles3D(unifiedState.bubbles) : null);
  const bubblesEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "bubbles" : false,
  );
  const bubblesShowLeftEnd = $derived(
    bubbles3D?.trackingMode === "left_end" || bubbles3D?.trackingMode === "both_ends",
  );
  const bubblesShowRightEnd = $derived(
    bubbles3D?.trackingMode === "right_end" || bubbles3D?.trackingMode === "both_ends",
  );
  const petals3D = $derived(unifiedState ? resolvePetals3D(unifiedState.petals) : null);
  const petalsEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "petals" : false,
  );
  const petalsShowLeftEnd = $derived(
    petals3D?.trackingMode === "left_end" || petals3D?.trackingMode === "both_ends",
  );
  const petalsShowRightEnd = $derived(
    petals3D?.trackingMode === "right_end" || petals3D?.trackingMode === "both_ends",
  );
  const smoke3D = $derived(unifiedState ? resolveSmoke3D(unifiedState.smoke) : null);
  const smokeEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "smoke" : false,
  );
  const smokeShowLeftEnd = $derived(
    smoke3D?.trackingMode === "left_end" || smoke3D?.trackingMode === "both_ends",
  );
  const smokeShowRightEnd = $derived(
    smoke3D?.trackingMode === "right_end" || smoke3D?.trackingMode === "both_ends",
  );
  /**
   * Pick the phantom color for the Ghost effect. Ghost is prop-matched: each
   * prop's ghosts wear that prop's unified trail color.
   */
  function pickGhostColor(whichProp: "blue" | "red"): string {
    const trails = unifiedState?.trails;
    return whichProp === "blue"
      ? trails?.blueColor ?? "#3b82f6"
      : trails?.redColor ?? "#ef4444";
  }

  function pickSparkleColor(i: number): string {
    if (!sparkles3D) return "#ffffff";
    if (sparkles3D.colorMode === "solid") return sparkles3D.color;
    if (sparkles3D.colorMode === "palette" && sparkles3D.palette.length > 0) {
      return sparkles3D.palette[i % sparkles3D.palette.length]!;
    }
    // rainbow mode - rotate hue by emitter index
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

<!-- Trails render via EffectOrchestrator3D (Trail3D ribbon) in the rig's
     effectsSlot, not here. -->

<!-- Fire renders via EffectOrchestrator3D (FireRenderer3D, imperative) in the
     rig's effectsSlot, not here — same as trails. The FireEmitter particle
     block that used to live at this spot double-rendered fire the moment this
     layer was mounted, blowing the exposure out on any fire station. -->

<!-- =============================================================================
     Sparkle Effects (on prop ends)
     ============================================================================= -->
{#if sparklesEnabled && sparkles3D && isPlaying}
  <!-- worldSpread / baseRadius / worldGravity, never the raw intent values:
       intent.spread is 2D canvas pixels and reading it as metres is what put
       7-metre sparkles on a 0.86m staff. -->
  {#if blueEnds}
    <SparkleEmitter
      position={blueEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(0)}
      spread={sparkles3D.worldSpread}
      radius={sparkles3D.baseRadius}
      gravity={sparkles3D.worldGravity}
      lifetime={sparkles3D.lifetime}
    />
    <SparkleEmitter
      position={blueEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(1)}
      spread={sparkles3D.worldSpread * 0.75}
      radius={sparkles3D.baseRadius}
      gravity={sparkles3D.worldGravity}
      lifetime={sparkles3D.lifetime}
    />
  {/if}

  {#if redEnds}
    <SparkleEmitter
      position={redEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(2)}
      spread={sparkles3D.worldSpread}
      radius={sparkles3D.baseRadius}
      gravity={sparkles3D.worldGravity}
      lifetime={sparkles3D.lifetime}
    />
    <SparkleEmitter
      position={redEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(3)}
      spread={sparkles3D.worldSpread * 0.75}
      radius={sparkles3D.baseRadius}
      gravity={sparkles3D.worldGravity}
      lifetime={sparkles3D.lifetime}
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
{#if scene3DRender && (scene3DRender.motion.blur || scene3DRender.motion.speedLines) && isPlaying}
  {#if blueCenter}
    <PropMotionEffects
      position={blueCenter}
      color="blue"
      enableBlur={scene3DRender.motion.blur}
      enableSpeedLines={scene3DRender.motion.speedLines}
      intensity={scene3DRender.motion.intensity}
      threshold={2}
    />
  {/if}

  {#if redCenter}
    <PropMotionEffects
      position={redCenter}
      color="red"
      enableBlur={scene3DRender.motion.blur}
      enableSpeedLines={scene3DRender.motion.speedLines}
      intensity={scene3DRender.motion.intensity}
      threshold={2}
    />
  {/if}
{/if}

<!-- =============================================================================
     Unified Ghost intent (Phase 1d revised) - beat-onset phantoms of each
     prop, sourced from the unified intent layer via resolveGhost3D.
     Lives alongside the legacy PropMotionEffects mount above; Phase 3
     retires the legacy path.
     ============================================================================= -->
{#if ghostEnabled && ghost3D && isPlaying}
  <GhostStaff3D
    propState={bluePropState}
    enabled={ghostEnabled}
    intensity={ghost3D.intensity}
    decay={ghost3D.decay}
    interval={ghost3D.interval}
    color={pickGhostColor("blue")}
    staffLength={staffLength}
    currentStep={currentStep}
    shape="staff"
  />
  <GhostStaff3D
    propState={redPropState}
    enabled={ghostEnabled}
    intensity={ghost3D.intensity}
    decay={ghost3D.decay}
    interval={ghost3D.interval}
    color={pickGhostColor("red")}
    staffLength={staffLength}
    currentStep={currentStep}
    shape="staff"
  />
{/if}

<!-- =============================================================================
     Bloom: per-tip radial halation sprites. Unlike echo/trails, bloom runs
     even when paused - pulse modulation is time-based, not step-based.
     4 sprites total: blueA, blueB, redA, redB.
     ============================================================================= -->
{#if bloomEnabled && bloomIntent}
  <BloomBillboard3D
    position={blueEnds?.positive ?? null}
    tipIndex={0}
    propIndex={0}
    blueColor={bloomBlueColor}
    redColor={bloomRedColor}
    intent={bloomIntent}
    enabled={bloomEnabled}
  />
  <BloomBillboard3D
    position={blueEnds?.negative ?? null}
    tipIndex={1}
    propIndex={0}
    blueColor={bloomBlueColor}
    redColor={bloomRedColor}
    intent={bloomIntent}
    enabled={bloomEnabled}
  />
  <BloomBillboard3D
    position={redEnds?.positive ?? null}
    tipIndex={2}
    propIndex={1}
    blueColor={bloomBlueColor}
    redColor={bloomRedColor}
    intent={bloomIntent}
    enabled={bloomEnabled}
  />
  <BloomBillboard3D
    position={redEnds?.negative ?? null}
    tipIndex={3}
    propIndex={1}
    blueColor={bloomBlueColor}
    redColor={bloomRedColor}
    intent={bloomIntent}
    enabled={bloomEnabled}
  />
{/if}

<!-- =============================================================================
     Water: per-tip droplet emitters (Phase 1f.i MVP). Ambient drip + motion-
     reactive emission. Later sub-phases add stream ribbon / metaballs /
     puddles / refraction.
     ============================================================================= -->
{#if gooEnabled && goo3D && isPlaying}
  {#if blueEnds && gooShowRightEnd}
    <WaterEmitter3D
      position={blueEnds.positive}
      propVelocity={blueVelocityVec}
      params={goo3D}
      enabled={true}
    />
  {/if}
  {#if blueEnds && gooShowLeftEnd}
    <WaterEmitter3D
      position={blueEnds.negative}
      propVelocity={blueVelocityVec}
      params={goo3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && gooShowRightEnd}
    <WaterEmitter3D
      position={redEnds.positive}
      propVelocity={redVelocityVec}
      params={goo3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && gooShowLeftEnd}
    <WaterEmitter3D
      position={redEnds.negative}
      propVelocity={redVelocityVec}
      params={goo3D}
      enabled={true}
    />
  {/if}
{/if}

<!-- =============================================================================
     Bubbles: per-tip buoyant bubble emitters. Ambient drift + motion-reactive
     emission. Bubbles rise (+y) and grow over lifetime before popping on
     timeout or max-size.
     ============================================================================= -->
{#if bubblesEnabled && bubbles3D && isPlaying}
  {#if blueEnds && bubblesShowRightEnd}
    <BubbleEmitter3D
      position={blueEnds.positive}
      propVelocity={blueVelocityVec}
      params={bubbles3D}
      enabled={true}
    />
  {/if}
  {#if blueEnds && bubblesShowLeftEnd}
    <BubbleEmitter3D
      position={blueEnds.negative}
      propVelocity={blueVelocityVec}
      params={bubbles3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && bubblesShowRightEnd}
    <BubbleEmitter3D
      position={redEnds.positive}
      propVelocity={redVelocityVec}
      params={bubbles3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && bubblesShowLeftEnd}
    <BubbleEmitter3D
      position={redEnds.negative}
      propVelocity={redVelocityVec}
      params={bubbles3D}
      enabled={true}
    />
  {/if}
{/if}

<!-- =============================================================================
     Petals: dual-source emission. Per-tip motion bursts (4 emitters) + one
     scene-wide ambient ceiling shower that rains petals from above.
     ============================================================================= -->
{#if petalsEnabled && petals3D && isPlaying}
  <PetalAmbientShower3D params={petals3D} enabled={true} />
  {#if blueEnds && petalsShowRightEnd}
    <PetalEmitter3D
      position={blueEnds.positive}
      propVelocity={blueVelocityVec}
      params={petals3D}
      enabled={true}
    />
  {/if}
  {#if blueEnds && petalsShowLeftEnd}
    <PetalEmitter3D
      position={blueEnds.negative}
      propVelocity={blueVelocityVec}
      params={petals3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && petalsShowRightEnd}
    <PetalEmitter3D
      position={redEnds.positive}
      propVelocity={redVelocityVec}
      params={petals3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && petalsShowLeftEnd}
    <PetalEmitter3D
      position={redEnds.negative}
      propVelocity={redVelocityVec}
      params={petals3D}
      enabled={true}
    />
  {/if}
{/if}

<!-- =============================================================================
     Smoke: per-tip curl-noise puff emitters (Phase 1i.i MVP). Each tip owns
     a 256-particle pool; palette carries lifetime + curl bias + rise bias.
     Sub-phases 1i.ii (blur) and 1i.iii (genie hue-shift) deferred.
     ============================================================================= -->
{#if smokeEnabled && smoke3D && isPlaying}
  {#if blueEnds && smokeShowRightEnd}
    <SmokeRenderer3D
      position={blueEnds.positive}
      propVelocity={blueVelocityVec}
      params={smoke3D}
      enabled={true}
    />
  {/if}
  {#if blueEnds && smokeShowLeftEnd}
    <SmokeRenderer3D
      position={blueEnds.negative}
      propVelocity={blueVelocityVec}
      params={smoke3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && smokeShowRightEnd}
    <SmokeRenderer3D
      position={redEnds.positive}
      propVelocity={redVelocityVec}
      params={smoke3D}
      enabled={true}
    />
  {/if}
  {#if redEnds && smokeShowLeftEnd}
    <SmokeRenderer3D
      position={redEnds.negative}
      propVelocity={redVelocityVec}
      params={smoke3D}
      enabled={true}
    />
  {/if}
{/if}
