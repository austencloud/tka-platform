<script lang="ts">
  import { Canvas } from "@threlte/core";
  import ContactCanvasLifecycle from "./ContactCanvasLifecycle.svelte";
  import ContactScene from "./ContactScene.svelte";

  interface Props {
    aspect: number;
  }

  let { aspect }: Props = $props();
</script>

<div
  class="contact-canvas"
  aria-label="Contact juggling hand-level motion viewer"
>
  <Canvas dpr={2}>
    <ContactCanvasLifecycle />
    <ContactScene {aspect} />
  </Canvas>
</div>

<style>
  .contact-canvas {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        circle at 50% 42%,
        rgba(61, 92, 150, 0.2),
        transparent 38%
      ),
      linear-gradient(155deg, #121a2c 0%, #080d18 58%, #050810 100%);
  }

  .contact-canvas :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
