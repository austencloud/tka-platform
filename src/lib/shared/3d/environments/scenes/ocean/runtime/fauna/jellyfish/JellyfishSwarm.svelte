<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Camera, WebGLRenderer } from "three";
  import type { OceanQualityConfig } from "../../../quality/ocean-quality";
  import { createOceanJellyfishSwarm } from "../../../../../worlds/ocean/ocean-jellyfish-swarm";
  import { createJellyfishChime } from "./jellyfish-chime";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  const swarm = createOceanJellyfishSwarm(quality.maxJellyfish);
  const chime = createJellyfishChime();
  const { renderer, camera } = useThrelte();
  let cursorElement: HTMLCanvasElement | undefined;
  let cursorSet = false;

  function getRenderer(): WebGLRenderer | undefined {
    return (renderer as { current?: WebGLRenderer })?.current ??
      (renderer as unknown as WebGLRenderer);
  }

  function getCamera(): Camera | undefined {
    return (camera as { current?: Camera })?.current ??
      (camera as unknown as Camera);
  }

  function eventNdc(
    event: PointerEvent,
  ): { x: number; y: number; element: HTMLCanvasElement } | null {
    const element = getRenderer()?.domElement;
    if (!element || event.target !== element) return null;
    const rect = element.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return null;
    }
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      element,
    };
  }

  function setHoverCursor(on: boolean): void {
    if (on === cursorSet) return;
    cursorSet = on;
    if (cursorElement) cursorElement.style.cursor = on ? "pointer" : "";
  }

  function onPointerMove(event: PointerEvent): void {
    const point = eventNdc(event);
    const activeCamera = getCamera();
    if (!point || !activeCamera) {
      setHoverCursor(false);
      return;
    }
    cursorElement = point.element;
    setHoverCursor(swarm.hoverAt(point.x, point.y, activeCamera));
  }

  function onPointerDown(event: PointerEvent): void {
    const point = eventNdc(event);
    const activeCamera = getCamera();
    if (!point || !activeCamera) return;
    const interaction = swarm.interactAt(point.x, point.y, activeCamera);
    if (interaction) chime.play(interaction.frequencyHz, interaction.pan);
  }

  $effect(() => {
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      setHoverCursor(false);
    };
  });

  useTask((delta) => swarm.update(delta));

  onDestroy(() => {
    swarm.dispose();
    chime.dispose();
  });
</script>

<T is={swarm.object} />
