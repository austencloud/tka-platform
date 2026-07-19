<!--
  GhostPointer — the attract act's visible "finger". A soft accent-colored dot
  that eases between targets and dips on press. Pure decoration: aria-hidden,
  pointer-events none, rendered only while the act is alive (never under
  reduced motion — the section simply doesn't mount it).

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
  }: { x: number; y: number; pressed?: boolean; visible?: boolean } = $props();
</script>

<div
  class="ghost"
  class:visible
  style={`transform: translate(${x}px, ${y}px)`}
  aria-hidden="true"
>
  <div class="dot" class:pressed></div>
</div>

<style>
  .ghost {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 6;
    pointer-events: none;
    opacity: 0;
    transition:
      transform 450ms cubic-bezier(0.22, 0.9, 0.3, 1),
      opacity 200ms ease;
    will-change: transform;
  }

  .ghost.visible {
    opacity: 1;
  }

  .dot {
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border-radius: 50%;
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
</style>
