import type { MandalaPaths, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
import type { StickerBackground, StickerUnit, StickerVariant } from "../../domain/sticker-types";
import {
  STICKER_ART_DIAMETER_PX,
  STICKER_ART_RADIUS_PX,
  STICKER_BLEED_PX,
  STICKER_TILE_SIZE_PX,
} from "../../domain/sticker-constants";
import type { IStickerUnitRenderer } from "../contracts/IStickerUnitRenderer";

/**
 * Light-mode palette tuned for white sticker paper.
 * Darker, more saturated than the dark-mode defaults so blue/red read as primary colors
 * rather than washed-out glows.
 */
const LIGHT_MODE_PALETTE: MandalaPalette = {
  blueStroke: "#1e40af",
  blueFill: "rgba(37, 99, 235, 0.65)",
  redStroke: "#991b1b",
  redFill: "rgba(220, 38, 38, 0.65)",
  purpleStroke: "#6b21a8",
  purpleFill: "rgba(126, 34, 206, 0.75)",
};

/**
 * Stroke width at 3" standalone. Wider than the card-back default (2.5) because the
 * sticker is ~6x larger than its card-back equivalent.
 */
const STICKER_STROKE_WIDTH = 6;

export class StickerUnitRenderer implements IStickerUnitRenderer {
  private readonly mandalaRenderer = new MandalaRenderer();

  renderSVG(unit: StickerUnit, mandalaPaths: MandalaPaths): string {
    const mandalaSvg = this.mandalaRenderer.renderSVG(mandalaPaths, {
      size: STICKER_ART_DIAMETER_PX,
      style: "filled", // stroke + fill layered — see MandalaRenderer.filledAttributes
      showGridDots: false,
      show: toMandalaShow(unit.variant),
      strokeWidth: STICKER_STROKE_WIDTH,
      transparentBackground: true,
      palette: LIGHT_MODE_PALETTE,
    });

    // Strip the outer <svg> wrapper from the mandala — we inline its <defs> and <g>
    // into our sticker-scoped SVG.
    const mandalaInner = extractSvgInner(mandalaSvg);

    const bg = renderBackground(unit.background);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STICKER_TILE_SIZE_PX} ${STICKER_TILE_SIZE_PX}" width="${STICKER_TILE_SIZE_PX}" height="${STICKER_TILE_SIZE_PX}">`,
      bg.defs,
      `  <g transform="translate(${STICKER_BLEED_PX}, ${STICKER_BLEED_PX})">`,
      bg.body,
      mandalaInner,
      `  </g>`,
      `</svg>`,
    ].join("\n");
  }
}

function toMandalaShow(variant: StickerVariant): "blue" | "red" | "both" {
  return variant === "full" ? "both" : variant;
}

interface BackgroundParts {
  defs: string;
  body: string;
}

function renderBackground(background: StickerBackground): BackgroundParts {
  const cx = STICKER_ART_RADIUS_PX;
  const cy = STICKER_ART_RADIUS_PX;
  const r = STICKER_ART_RADIUS_PX;

  if (background === "transparent") {
    return { defs: "", body: "" };
  }

  if (background === "white") {
    return {
      defs: "",
      body: `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>`,
    };
  }

  // radial-gradient
  const gradientId = `sticker-bg-gradient-${Math.random().toString(36).slice(2, 8)}`;
  return {
    defs: [
      `  <defs>`,
      `    <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">`,
      `      <stop offset="0%" stop-color="#fefcf7" stop-opacity="1"/>`,
      `      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.85"/>`,
      `    </radialGradient>`,
      `  </defs>`,
    ].join("\n"),
    body: `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradientId})"/>`,
  };
}

/**
 * Extract the contents of the outer <svg>...</svg> wrapper.
 * MandalaRenderer.renderSVG returns a complete <svg> element; we need its inner
 * content to inline into our sticker-scoped SVG.
 */
function extractSvgInner(svg: string): string {
  const openEnd = svg.indexOf(">", svg.indexOf("<svg"));
  const closeStart = svg.lastIndexOf("</svg>");
  if (openEnd === -1 || closeStart === -1) return "";
  return svg.substring(openEnd + 1, closeStart);
}
