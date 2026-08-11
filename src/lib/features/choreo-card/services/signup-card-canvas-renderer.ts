/**
 * Signup Card Canvas Renderer
 *
 * Draws the festival sample-pack signup card at MPC print dimensions.
 * Front: QR to tkaflowarts.com/start, the URL as text (QR-dead insurance),
 * and one pitch line. Back: brand mark.
 *
 * Content is static, so canvases are cached after first render — same
 * discipline as the info card. Frame aesthetics (border gradient, theme
 * background, corner radii) delegate to the info-card renderer's helpers so
 * the signup card matches the deck it ships with.
 */

import type { InfoCardCanvasOptions } from "./types";
import {
  REF_SCALE,
  drawBorderFrame,
  fillBackground,
  roundRect,
  wrapText,
} from "./info-card-canvas-renderer";
import { QRCodeGenerator } from "$lib/shared/qr/services/qr-code-generator";

export const SIGNUP_CARD_URL = "https://tkaflowarts.com/start";
/** Printed under the QR. No scheme — it is for humans typing it in. */
const SIGNUP_CARD_URL_TEXT = "tkaflowarts.com/start";
const PITCH_LINE =
  "Create a free account and every card in this pack comes alive.";

let cachedFront: HTMLCanvasElement | null = null;
let cachedFrontKey: string | null = null;
let cachedBack: HTMLCanvasElement | null = null;
let cachedBackKey: string | null = null;

export async function renderSignupCardFront(
  options: InfoCardCanvasOptions
): Promise<HTMLCanvasElement> {
  const key = `${options.theme}|${options.width}x${options.height}`;
  if (cachedFront && cachedFrontKey === key) return cachedFront;

  // The QR is the card's whole job — render it before touching the canvas so
  // a generator failure surfaces as an error, never as a card with a hole.
  // URL-only generator: no ShortCodeManager, so the bare /test harness (no
  // app-shell wiring) can render the card.
  const qrImage = await new QRCodeGenerator().generateUrlAsImage(
    SIGNUP_CARD_URL,
    600,
    { style: "classic", margin: 2, centerIcon: "none" }
  );

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d")!;

  const bleed = options.bleedPx;
  const contentW = options.width - bleed * 2;
  const contentH = options.height - bleed * 2;

  ctx.fillStyle = "#080c24";
  ctx.fillRect(0, 0, options.width, options.height);

  const borderWidth = 4 * REF_SCALE;
  drawBorderFrame(ctx, bleed, bleed, contentW, contentH, borderWidth, options.theme);

  const innerX = bleed + borderWidth;
  const innerY = bleed + borderWidth;
  const innerW = contentW - borderWidth * 2;
  const innerH = contentH - borderWidth * 2;

  fillBackground(ctx, innerX, innerY, innerW, innerH, options.theme);

  const padX = 30 * REF_SCALE;
  const padY = 28 * REF_SCALE;
  const centerX = innerX + innerW / 2;

  // Measured once against a throwaway context, then vertically centred —
  // same probe-and-centre pattern as the info card.
  const drawBody = (ctx: CanvasRenderingContext2D, startY: number): number => {
    let curY = startY;

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${34 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Start Here", centerX, curY);
    curY += 34 * REF_SCALE + 6 * REF_SCALE;

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = `400 ${17 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("Flow Arts Composer", centerX, curY);
    curY += 17 * REF_SCALE + 22 * REF_SCALE;

    // QR on a white tile. Print + lamination + jam lighting want the classic
    // dark-modules-on-white contrast, not a themed QR.
    const tileSize = 300 * REF_SCALE;
    const tilePad = 18 * REF_SCALE;
    const tileX = centerX - tileSize / 2;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, tileX, curY, tileSize, tileSize, 14 * REF_SCALE);
    ctx.fill();
    ctx.drawImage(
      qrImage,
      tileX + tilePad,
      curY + tilePad,
      tileSize - tilePad * 2,
      tileSize - tilePad * 2
    );
    curY += tileSize + 16 * REF_SCALE;

    // The URL as text — insurance for a QR that will not scan.
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `700 ${17 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(SIGNUP_CARD_URL_TEXT, centerX, curY);
    curY += 17 * REF_SCALE + 20 * REF_SCALE;

    // Pitch line
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    const pitchSize = 14 * REF_SCALE;
    ctx.font = `400 ${pitchSize}px "Segoe UI", system-ui, sans-serif`;
    const pitchLines = wrapText(ctx, PITCH_LINE, innerW - padX * 2.6);
    for (const line of pitchLines) {
      ctx.fillText(line, centerX, curY);
      curY += pitchSize * 1.5;
    }

    return curY;
  };

  const bodyTop = innerY + padY;
  const bodyLimit = innerY + innerH - padY - 20 * REF_SCALE;
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = 1;
  probeCanvas.height = 1;
  const naturalH = drawBody(probeCanvas.getContext("2d")!, bodyTop) - bodyTop;
  const slack = Math.max(0, bodyLimit - bodyTop - naturalH);
  drawBody(ctx, bodyTop + slack / 2);

  // Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = `400 ${11 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("The Kinetic Alphabet", centerX, innerY + innerH - padY);

  cachedFront = canvas;
  cachedFrontKey = key;
  return canvas;
}

export async function renderSignupCardBack(
  options: InfoCardCanvasOptions
): Promise<HTMLCanvasElement> {
  const key = `${options.theme}|${options.width}x${options.height}`;
  if (cachedBack && cachedBackKey === key) return cachedBack;

  const logo = await loadImage("/branding/logo.jpg");

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d")!;

  const bleed = options.bleedPx;
  const contentW = options.width - bleed * 2;
  const contentH = options.height - bleed * 2;

  ctx.fillStyle = "#080c24";
  ctx.fillRect(0, 0, options.width, options.height);

  const borderWidth = 4 * REF_SCALE;
  drawBorderFrame(ctx, bleed, bleed, contentW, contentH, borderWidth, options.theme);

  const innerX = bleed + borderWidth;
  const innerY = bleed + borderWidth;
  const innerW = contentW - borderWidth * 2;
  const innerH = contentH - borderWidth * 2;

  fillBackground(ctx, innerX, innerY, innerW, innerH, options.theme);

  const centerX = innerX + innerW / 2;
  const padY = 28 * REF_SCALE;

  // Brand mark: the round logo on a white disc (the logo is a JPEG with its
  // own white ground, so the disc gives it a clean, anti-aliased edge), with
  // the wordmark below — the same brand row the /start page opens with.
  const logoR = 60 * REF_SCALE;
  const blockH =
    logoR * 2 + 20 * REF_SCALE + 30 * REF_SCALE + 8 * REF_SCALE + 16 * REF_SCALE;
  const blockTop = innerY + (innerH - blockH) / 2;
  const logoCY = blockTop + logoR;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX, logoCY, logoR, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, logoCY, logoR - 2 * REF_SCALE, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    logo,
    centerX - logoR,
    logoCY - logoR,
    logoR * 2,
    logoR * 2
  );
  ctx.restore();

  let curY = logoCY + logoR + 20 * REF_SCALE;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${26 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Flow Arts Composer", centerX, curY);
  curY += 26 * REF_SCALE + 8 * REF_SCALE;

  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = `400 ${15 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("The Kinetic Alphabet", centerX, curY);

  // Footer: the URL again — the back is the face a stacked pack shows.
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.font = `400 ${12 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(SIGNUP_CARD_URL_TEXT, centerX, innerY + innerH - padY);

  cachedBack = canvas;
  cachedBackKey = key;
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
