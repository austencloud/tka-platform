<!--
  Live Yuta CAP hero for /notation/caps: one club floating in space, drawing
  the pattern's trace as it plays, looping forever. Same recipe as the
  shape-matrix drill hero (InlineAnimationPlayer + transparent canvas + trail
  preset + tip-effect map + engine-aligned MandalaHeroLayer ghost underneath),
  so it reads as "a prop doing the pattern" with no letter/step chrome and no
  background box.

  This surface is LOCKED: effort linear, 90 BPM, clubs, grid hidden, context
  menu suppressed — a public exhibit, not an editable canvas.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import MandalaHeroLayer from "$lib/shared/shape-matrix/components/MandalaHeroLayer.svelte";
  import { buildYutaCapSequence } from "./yuta-cap-sequence";
  import { setPerHand } from "$lib/shared/animation-engine/services/tip-effect-resolver";
  import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
  import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
  import {
    TrailMode,
    TrailEffect,
    DEFAULT_TRAIL_SETTINGS,
    type TrailSettings,
  } from "$lib/shared/animation-engine/domain/types/trail-types";

  const sequence = buildYutaCapSequence();

  // The static mandala under the live trail — same alignment contract as the
  // shape-matrix drill: both layers fill the SAME square, and the geometry is
  // computed with the club's single outer tip so the ghost sits exactly under
  // the path the prop traces. (Blue is invisible in this sequence, so only the
  // red hand's locus comes back.)
  const clubTipDx = getTipPoints("club").points[0]?.dx ?? 130;
  const mandalaPaths = calculateMandalaGeometry(
    sequence.steps,
    undefined,
    undefined,
    { tipEnds: 1, pathShape: "arc" },
    { dx: clubTipDx, dy: 0 },
  );

  // Trails on the red (solo) hand only — index 1 = red.
  const tipEffectMap = setPerHand({}, 1, "trails");

  // Hero-visibility numbers from the landing hero preset, with LOOP_CLEAR so
  // the club redraws the full closed curve fresh on every cycle — the trace IS
  // the mandala, drawn live over its ghost.
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
  <MandalaHeroLayer paths={mandalaPaths} {clubTipDx} opacity={0.55} />
  <div class="player-layer">
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
        gridVisible: false,
        disableContextMenu: true,
        trailSettingsOverride: trailSettings,
        tipEffectMap,
        backgroundAlpha: 0,
      }}
    />
  </div>
</div>

<style>
  /* Square stage reserved up front (no-layout-shift); mandala ghost and player
     both fill THIS box, so their coordinate frames coincide — that is the
     alignment contract (see ShapeMatrixDrill's .hero-square). The player's
     canvas is transparent, so ghost and page background show through. */
  .yuta-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }

  .player-layer {
    position: absolute;
    inset: 0;
  }
</style>
