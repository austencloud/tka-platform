import { mount, unmount } from "svelte";
import CardBack from "../components/card-back/CardBack.svelte";
import { getCardBackThemeVisuals } from "../components/card-back/card-back-theme-visuals";
import type { CardBackDomRenderOptions } from "./types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export async function renderCardBack(sequence: SequenceData, options: CardBackDomRenderOptions): Promise<HTMLCanvasElement> {
  const { width, height, bleedPx } = options;
  const contentW = width - bleedPx * 2;
  const contentH = height - bleedPx * 2;

  // Create an offscreen container at the exact content dimensions
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${contentW}px`;
  container.style.height = `${contentH}px`;
  container.style.overflow = "hidden";
  // CardBack uses container queries - container-type is required
  container.style.containerType = "inline-size";
  document.body.appendChild(container);

  try {
    // Mount CardBack into the offscreen container
    const component = mount(CardBack, {
      target: container,
      props: { sequence },
    });

    // Wait for SVG mandala and images to render
    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, 200))
    ));

    const { domToCanvas } = await import("modern-screenshot");

    const capturedCanvas = await domToCanvas(container, {
      width: contentW,
      height: contentH,
      scale: 1,
    });

    // Unmount the Svelte component
    unmount(component);

    // Create the final MPC canvas with bleed
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext("2d")!;

    const visuals = getCardBackThemeVisuals(options.theme);
    const isProofMode = visuals.textColor === "#111111";
    ctx.fillStyle = isProofMode ? "#ffffff" : "#060610";
    ctx.fillRect(0, 0, width, height);

    // Draw captured content centered in the bleed area
    ctx.drawImage(capturedCanvas, bleedPx, bleedPx, contentW, contentH);

    return finalCanvas;
  } finally {
    document.body.removeChild(container);
  }
}
