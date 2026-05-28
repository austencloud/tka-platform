import { mount, unmount } from "svelte";
import CardBack from "../components/card-back/CardBack.svelte";
import { getCardBackThemeVisuals } from "../components/card-back/card-back-theme-visuals";
import type { CardBackDomRenderOptions } from "./types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export async function renderCardBack(sequence: SequenceData, options: CardBackDomRenderOptions): Promise<HTMLCanvasElement> {
  const { width, height, theme } = options;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = "hidden";
  container.style.containerType = "inline-size";
  document.body.appendChild(container);

  try {
    const themeOverride = theme
      ? { visuals: getCardBackThemeVisuals(theme), name: theme }
      : undefined;
    const component = mount(CardBack, {
      target: container,
      props: { sequence, themeOverride },
    });

    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, 200))
    ));

    const { domToCanvas } = await import("modern-screenshot");

    const canvas = await domToCanvas(container, {
      width,
      height,
      scale: 2,
    });

    unmount(component);
    return canvas;
  } finally {
    document.body.removeChild(container);
  }
}
