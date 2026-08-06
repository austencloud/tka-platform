import { CanvasTexture, SRGBColorSpace } from "three";
import type { SmokePalette } from "$lib/shared/effects/domain/smoke-palettes";

const COLUMNS = 8;
const CELL_SIZE = 128;
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let atlas: CanvasTexture | null = null;
const slots = new Map<string, number>();

export interface SmokeAtlasFrame {
  texture: CanvasTexture;
  x: number;
  width: number;
}

export function getSmokeTextureAtlas(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  ensureAtlas();
  return atlas;
}

/** One scene-independent atlas, including a bounded slot for a custom palette. */
export function getSmokeAtlasFrame(
  palette: SmokePalette
): SmokeAtlasFrame | null {
  if (typeof document === "undefined") return null;
  ensureAtlas();
  if (!canvas || !context || !atlas) return null;

  const key = `${palette.core}:${palette.edge}`;
  let slot = slots.get(key);
  if (slot === undefined) {
    slot = Math.min(slots.size, COLUMNS - 1);
    slots.set(key, slot);
    drawPuff(context, slot * CELL_SIZE, palette.core, palette.edge);
    atlas.needsUpdate = true;
  }
  return { texture: atlas, x: slot / COLUMNS, width: 1 / COLUMNS };
}

function ensureAtlas(): void {
  if (atlas) return;
  canvas = document.createElement("canvas");
  canvas.width = COLUMNS * CELL_SIZE;
  canvas.height = CELL_SIZE;
  context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.needsUpdate = true;
}

function drawPuff(
  target: CanvasRenderingContext2D,
  x: number,
  core: string,
  edge: string
): void {
  const centerX = x + CELL_SIZE / 2;
  const centerY = CELL_SIZE / 2;
  const gradient = target.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    CELL_SIZE / 2
  );
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.55, edge);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  target.fillStyle = gradient;
  target.fillRect(x, 0, CELL_SIZE, CELL_SIZE);
}
