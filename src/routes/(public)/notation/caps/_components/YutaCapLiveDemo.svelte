<!--
  Live Yuta CAP hero for /notation/caps: one club floating in space, drawing
  the pattern's trace as it plays, looping forever. Same recipe as the
  shape-matrix drill hero (InlineAnimationPlayer + transparent canvas + trail
  preset + tip-effect map), narrowed to a single hand via
  prepareMandalaClubSequence, so it reads as "a prop doing the pattern" with
  no letter/step chrome and no background box.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { buildYutaCapSequence } from "./yuta-cap-sequence";
  import { setPerHand } from "$lib/shared/animation-engine/services/tip-effect-resolver";
  import {
    TrailMode,
    TrailEffect,
    DEFAULT_TRAIL_SETTINGS,
    type TrailSettings,
  } from "$lib/shared/animation-engine/domain/types/trail-types";

  const sequence = buildYutaCapSequence();

  // Trails on the red (solo) hand only — index 1 = red.
  const tipEffectMap = setPerHand({}, 1, "trails");

  // Hero-visibility numbers from the landing hero preset, with LOOP_CLEAR so
  // the club redraws the full closed curve fresh on every cycle — the trace IS
  // the mandala, drawn live instead of pre-rendered.
  const trailSettings: TrailSettings = {
    ...DEFAULT_TRAIL_SETTINGS,
    mode: TrailMode.LOOP_CLEAR,
    effect: TrailEffect.GLOW,
    fadeDurationMs: 3200,
    glowBlur: 9,
    tailLength: 36,
    lineWidth: 6,
    minOpacity: 0.35,
  };
</script>

<div class="yuta-stage">
  <LazyMount
    loader={() =>
      import(
        "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
      )}
    active={true}
    props={{
      sequence,
      autoPlay: true,
      externalBpm: 90,
      tipEffortMap: { "*": { effort: "linear" } },
      chrome: "minimal",
      fill: true,
      beatIndicators: false,
      bluePropType: "club",
      redPropType: "club",
      hideTkaGlyph: true,
      hideStepNumbers: true,
      trailSettingsOverride: trailSettings,
      tipEffectMap,
      backgroundAlpha: 0,
    }}
  />
</div>

<style>
  /* Square stage reserved up front (no-layout-shift); the player fills it and
     its canvas is transparent, so the page background shows through. */
  .yuta-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }
</style>
