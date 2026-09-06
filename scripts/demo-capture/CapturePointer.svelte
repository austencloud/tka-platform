<script lang="ts">
  import { onDestroy } from "svelte";
  import GhostPointer from "../../src/lib/shared/attract/components/GhostPointer.svelte";

  let x = $state(0);
  let y = $state(0);
  let visible = $state(false);
  let pressed = $state(false);
  let speed = $state(0);
  let heading = $state(0);
  let lastTime = 0;
  let resting: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(resting));

  function move(event: PointerEvent) {
    const elapsed = Math.max(1, event.timeStamp - lastTime);
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    speed = visible ? Math.min(1, Math.hypot(dx, dy) / elapsed / 1.4) : 0;
    heading = Math.atan2(dy, dx);
    x = event.clientX;
    y = event.clientY;
    lastTime = event.timeStamp;
    visible = true;
    clearTimeout(resting);
    resting = setTimeout(() => (speed = 0), 80);
  }
</script>

<svelte:window
  onpointermove={move}
  onpointerdown={() => (pressed = true)}
  onpointerup={() => (pressed = false)}
  onblur={() => (pressed = false)}
/>

<div class="capture-pointer" aria-hidden="true">
  <GhostPointer
    {x}
    {y}
    {visible}
    {pressed}
    {speed}
    {heading}
    considering={visible && speed === 0 && !pressed}
  />
</div>

<style>
  .capture-pointer {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
  }
</style>
