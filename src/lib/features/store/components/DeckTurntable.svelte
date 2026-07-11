<!--
  DeckTurntable — the LOOP configurator preview as a real 3D object. One
  representative printed card floats center-stage; you drag to spin it (yaw
  free, pitch is a self-righting foil-catch tilt), it flicks with momentum and
  settles on a spring, and it retextures instantly when the buyer changes prop
  or flavor. Drop-in for DeckFanCover (same cards/deckId/deckName/propType
  contract); the fan stays the static fallback (reduced-motion / no WebGL).

  Interaction model: NO raycast, NO OrbitControls. The repo's Threlte
  interactivity() is documented-broken and orbiting a camera around one centered
  object gimbal-locks + reads as a viewer demo. With exactly one object dead
  centre, pointer deltas on the wrapper drive the object's own rotation through
  Svelte springs — smaller and better than either alternative.
-->
<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import DeckTurntableCard from "./DeckTurntableCard.svelte";
  import type { CoverCard } from "../domain/models/product";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { DEFAULT_SHOP_PROP } from "../domain/shop-prop-options";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

  interface Props {
    cards: readonly CoverCard[];
    deckId?: string;
    deckName?: string;
    propType?: PropType;
    /** Iridescence strength 0–1 (foil). Off until Step 3. */
    foil?: number;
  }
  let {
    cards,
    deckId,
    deckName,
    propType = DEFAULT_SHOP_PROP,
    foil = 0,
  }: Props = $props();

  // One representative card for the turntable (the fan shows the hand; the
  // turntable shows the object).
  const card = $derived(cards[0] ?? null);

  const haptics = getHapticFeedback();

  // Rotation targets the card's useTask spring integrator chases. Yaw is the
  // primary spin (keeps its flicked angle → free spin); pitch is the foil-catch
  // tilt that self-rights to 0. The intro 3/4 turn lives in the child's initial
  // curYaw, so targets start at rest (0).
  let targetYaw = $state(0);
  let targetPitch = $state(0);

  // ── drag: move the target with the finger, flick with momentum on release ──
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velYaw = 0;
  let velPitch = 0;

  const YAW_PER_PX = 0.011;
  const PITCH_PER_PX = 0.006;
  const PITCH_CLAMP = 0.5;
  const FLICK = 12; // release-momentum multiplier
  const TWO_PI = Math.PI * 2;

  const clampPitch = (v: number) =>
    Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, v));

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velYaw = 0;
    velPitch = 0;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / already-captured pointer */
    }
    haptics?.trigger("selection");
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velYaw = dx * YAW_PER_PX;
    velPitch = dy * PITCH_PER_PX;
    targetYaw += velYaw;
    targetPitch = clampPitch(targetPitch + velPitch);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    // Flick coasts by recent velocity, then the card ALWAYS settles facing the
    // buyer: snap the landing to the nearest full turn. A firm flick spins one
    // or more turns and lands front; a nudge eases straight home. Without this
    // the card can rest edge-on or backward — unacceptable for a product preview
    // whose whole job is to show the buyer their card. Pitch self-rights to 0.
    const landed = targetYaw + velYaw * FLICK;
    targetYaw = Math.round(landed / TWO_PI) * TWO_PI;
    targetPitch = 0;
  }
</script>

<div
  class="turntable"
  role="img"
  aria-label={deckName ? `${deckName} card, drag to spin` : "Deck card, drag to spin"}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  <Canvas renderMode="on-demand">
    <T.PerspectiveCamera makeDefault position={[0, 0, 6.2]} fov={34} />

    <!-- Card-forward light rig (brighter than the night-scene rig — the card is
         the hero, not set dressing): cool ambient + a warm key + a violet fill
         so the nebula palette reads on the foil. -->
    <T.AmbientLight intensity={0.5} color="#b9c4ff" />
    <T.DirectionalLight position={[3, 4, 5]} intensity={1.45} color="#fff6ec" />
    <T.DirectionalLight position={[-4, 1, 2]} intensity={0.35} color="#8ea2ff" />

    <DeckTurntableCard
      {card}
      {deckId}
      {deckName}
      {propType}
      {foil}
      {targetYaw}
      {targetPitch}
    />
  </Canvas>
</div>

<style>
  .turntable {
    width: 100%;
    height: 100%;
    /* Pointer drives rotation — never let touch scroll/zoom steal the gesture. */
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .turntable:active {
    cursor: grabbing;
  }
</style>
