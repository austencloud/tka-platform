<!--
  GhostPointer — the attract act's visible "finger". A soft accent-colored dot
  that dips on press. Position is rAF-driven by the act's human motor model
  (curved, distance-scaled paths) — no CSS transform transition here, it would
  fight the per-frame updates.

  Two poses:
  - Acting (default): pure decoration — pointer-events none, aria-hidden.
  - Parked (after takeover): the dot sits in the pane's corner showing a tiny
    play glyph and BECOMES a real button — click it and the demonstration
    runs again. The ghost is its own "watch it again" affordance.

  Rendered only while the act exists (never under reduced motion — the
  section simply doesn't mount it).

  Grep evidence (never-hand-roll, 2026-07-19): no ghost-cursor/attract-pointer
  primitive exists in src/lib; the landing hero act swaps sequences and has no
  pointer. Creation justified in the design spec.
-->
<script lang="ts">
  let {
    x,
    y,
    pressed = false,
    visible = false,
    parked = false,
    onResume,
  }: {
    x: number;
    y: number;
    pressed?: boolean;
    visible?: boolean;
    parked?: boolean;
    onResume?: () => void;
  } = $props();
</script>

<div
  class="ghost"
  class:visible
  class:parked
  style={`transform: translate(${x}px, ${y}px)`}
  aria-hidden={!parked}
>
  <div class="dot" class:pressed>
    {#if parked}
      <i class="fas fa-play" aria-hidden="true"></i>
    {/if}
  </div>
  {#if parked}
    <!-- 44px hit area over the 28px dot — touch-target floor. -->
    <button
      type="button"
      class="resume-hit"
      onclick={onResume}
      aria-label="Watch the demo again"
      title="Watch the demo again"
    ></button>
  {/if}
</div>

<style>
  .ghost {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 6;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease;
    will-change: transform;
  }

  .ghost.visible {
    opacity: 1;
  }

  .ghost.parked {
    pointer-events: auto;
  }

  .dot {
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      circle at 35% 35%,
      color-mix(in srgb, var(--accent, #8b8cff) 90%, white),
      color-mix(in srgb, var(--accent, #8b8cff) 65%, transparent) 70%
    );
    box-shadow:
      0 0 18px color-mix(in srgb, var(--accent, #8b8cff) 65%, transparent),
      0 0 40px color-mix(in srgb, var(--accent, #8b8cff) 30%, transparent);
    transition: transform 140ms ease;
  }

  .dot.pressed {
    transform: scale(0.72);
  }

  .dot i {
    font-size: 9px;
    color: #fff;
    /* Optical centering: a play triangle reads centered a hair right of true. */
    margin-left: 2px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  /* Parked: breathe gently so the corner dot reads as an invitation. */
  .ghost.parked .dot {
    animation: ghost-breathe 2.4s ease-in-out infinite;
  }

  .ghost.parked:hover .dot {
    animation-play-state: paused;
    transform: scale(1.15);
  }

  @keyframes ghost-breathe {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.12);
    }
  }

  .resume-hit {
    position: absolute;
    left: -22px;
    top: -22px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .resume-hit:focus-visible {
    outline: 2px solid var(--accent, #8b8cff);
    outline-offset: 2px;
  }

  /* A 28px dot on a 3840px panel — or on a TV across a field at a jam — reads
     as a speck. Nothing scales for you up here, so the finger steps too
     (4k-native-layout.md). The 44px hit area is untouched: it is a touch-target
     floor, not a size. */
  @media (min-width: 2600px) {
    .dot {
      width: 44px;
      height: 44px;
      margin: -22px 0 0 -22px;
    }

    .dot i {
      font-size: 14px;
    }
  }
</style>
