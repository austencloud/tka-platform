/**
 * Signup Card Canvas Renderer
 *
 * Draws the festival sample-pack signup card at MPC print dimensions.
 * Front: QR to tkaflowarts.com/start, the URL as text (QR-dead insurance),
 * and one pitch line. Back: brand mark.
 *
 * The card uses the SAME frame as the real deck cards — wrapContentInCardFrame
 * (stripe border, white inner content) — so it matches the pack it ships with
 * and stays home-printer friendly: ink lives in the border and the QR, not in
 * a full-bleed dark ground.
 *
 * Content is static, so canvases are cached after first render.
 */

import type { InfoCardCanvasOptions } from "./types";
import { REF_SCALE, roundRect, wrapText } from "./info-card-canvas-renderer";
import {
  getCardFrameContentInset,
  wrapContentInCardFrame,
} from "./card-front-frame";
import { QRCodeGenerator } from "$lib/shared/qr/services/qr-code-generator";

export const SIGNUP_CARD_URL = "https://tkaflowarts.com/start";
/** Printed under the QR. No scheme — it is for humans typing it in. */
const SIGNUP_CARD_URL_TEXT = "tkaflowarts.com/start";
const PITCH_LINE =
  "Create a free account and every card in this pack comes alive.";

const INK = "#1e1b4b";
const INK_SOFT = "rgba(30, 27, 75, 0.55)";
const INK_FAINT = "rgba(30, 27, 75, 0.4)";

/** Stripe-border palette per harness theme, mirroring the tndElement
 * accent/darkComplement pairs real cards are framed with. */
const FRAME_COLORS: Record<string, { accent: string; dark: string }> = {
  cosmic: { accent: "#818cf8", dark: "#1e1b4b" },
  ocean: { accent: "#22d3ee", dark: "#0c4a6e" },
  ember: { accent: "#fb923c", dark: "#7c2d12" },
};

let cachedFront: HTMLCanvasElement | null = null;
let cachedFrontKey: string | null = null;
let cachedBack: HTMLCanvasElement | null = null;
let cachedBackKey: string | null = null;

function htmlFactory(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function makeContentCanvas(options: InfoCardCanvasOptions): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  border: number;
} {
  const border = getCardFrameContentInset(options.bleedPx);
  const canvas = htmlFactory(options.width - border * 2, options.height - border * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, border };
}

function frameColors(theme: string): { accent: string; dark: string } {
  return FRAME_COLORS[theme] ?? FRAME_COLORS.cosmic!;
}

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

  const { canvas, ctx } = makeContentCanvas(options);
  const centerX = canvas.width / 2;
  const padY = 28 * REF_SCALE;

  // Measured once against a throwaway context, then vertically centred —
  // same probe-and-centre pattern as the info card.
  const drawBody = (ctx: CanvasRenderingContext2D, startY: number): number => {
    let curY = startY;

    // Title
    ctx.fillStyle = INK;
    ctx.font = `800 ${34 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Start Here", centerX, curY);
    curY += 34 * REF_SCALE + 6 * REF_SCALE;

    // Subtitle
    ctx.fillStyle = INK_SOFT;
    ctx.font = `400 ${17 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("Flow Arts Composer", centerX, curY);
    curY += 17 * REF_SCALE + 22 * REF_SCALE;

    // QR straight on the white ground, inside a hairline keyline so the cut
    // zone reads as deliberate. Classic dark-on-white modules scan best.
    const tileSize = 300 * REF_SCALE;
    const tilePad = 16 * REF_SCALE;
    const tileX = centerX - tileSize / 2;
    ctx.strokeStyle = "rgba(30, 27, 75, 0.15)";
    ctx.lineWidth = 2;
    roundRect(ctx, tileX, curY, tileSize, tileSize, 14 * REF_SCALE);
    ctx.stroke();
    ctx.drawImage(
      qrImage,
      tileX + tilePad,
      curY + tilePad,
      tileSize - tilePad * 2,
      tileSize - tilePad * 2
    );
    curY += tileSize + 16 * REF_SCALE;

    // The URL as text — insurance for a QR that will not scan.
    ctx.fillStyle = INK;
    ctx.font = `700 ${17 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(SIGNUP_CARD_URL_TEXT, centerX, curY);
    curY += 17 * REF_SCALE + 20 * REF_SCALE;

    // Pitch line
    ctx.fillStyle = INK_SOFT;
    const pitchSize = 14 * REF_SCALE;
    ctx.font = `400 ${pitchSize}px "Segoe UI", system-ui, sans-serif`;
    const pitchLines = wrapText(ctx, PITCH_LINE, canvas.width - 60 * REF_SCALE);
    for (const line of pitchLines) {
      ctx.fillText(line, centerX, curY);
      curY += pitchSize * 1.5;
    }

    return curY;
  };

  const bodyTop = padY;
  const bodyLimit = canvas.height - padY - 20 * REF_SCALE;
  const probeCanvas = htmlFactory(1, 1);
  const naturalH = drawBody(probeCanvas.getContext("2d")!, bodyTop) - bodyTop;
  const slack = Math.max(0, bodyLimit - bodyTop - naturalH);
  drawBody(ctx, bodyTop + slack / 2);

  // Footer
  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 ${11 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("The Kinetic Alphabet", centerX, canvas.height - padY);

  const framed = wrapContentInCardFrame(
    canvas,
    {
      canvasWidth: options.width,
      canvasHeight: options.height,
      bleedPx: options.bleedPx,
      ...frameColors(options.theme),
    },
    htmlFactory
  ) as HTMLCanvasElement;

  cachedFront = framed;
  cachedFrontKey = key;
  return framed;
}

export async function renderSignupCardBack(
  options: InfoCardCanvasOptions
): Promise<HTMLCanvasElement> {
  const key = `${options.theme}|${options.width}x${options.height}`;
  if (cachedBack && cachedBackKey === key) return cachedBack;

  const logo = await loadImage("/branding/logo.jpg");

  const { canvas, ctx } = makeContentCanvas(options);
  const centerX = canvas.width / 2;
  const padY = 28 * REF_SCALE;
  const { accent } = frameColors(options.theme);

  // Brand mark: the round logo with a thin accent ring (the logo JPEG carries
  // its own white ground, so on a white card only the ring defines its edge),
  // wordmark below — the same brand row the /start page opens with.
  const logoR = 60 * REF_SCALE;
  const blockH =
    logoR * 2 + 20 * REF_SCALE + 30 * REF_SCALE + 8 * REF_SCALE + 16 * REF_SCALE;
  const blockTop = (canvas.height - blockH) / 2;
  const logoCY = blockTop + logoR;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, logoCY, logoR - 2 * REF_SCALE, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, centerX - logoR, logoCY - logoR, logoR * 2, logoR * 2);
  ctx.restore();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2 * REF_SCALE;
  ctx.beginPath();
  ctx.arc(centerX, logoCY, logoR - REF_SCALE, 0, Math.PI * 2);
  ctx.stroke();

  let curY = logoCY + logoR + 20 * REF_SCALE;
  ctx.fillStyle = INK;
  ctx.font = `800 ${26 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Flow Arts Composer", centerX, curY);
  curY += 26 * REF_SCALE + 8 * REF_SCALE;

  ctx.fillStyle = INK_SOFT;
  ctx.font = `400 ${15 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("The Kinetic Alphabet", centerX, curY);

  // Footer: the URL again — the back is the face a stacked pack shows.
  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 ${12 * REF_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(SIGNUP_CARD_URL_TEXT, centerX, canvas.height - padY);

  const framed = wrapContentInCardFrame(
    canvas,
    {
      canvasWidth: options.width,
      canvasHeight: options.height,
      bleedPx: options.bleedPx,
      ...frameColors(options.theme),
    },
    htmlFactory
  ) as HTMLCanvasElement;

  cachedBack = framed;
  cachedBackKey = key;
  return framed;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
