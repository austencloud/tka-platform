import { CanvasTexture } from "three";

export interface PerformerBadgeCanvas {
  width: number;
  height: number;
  getContext(
    contextId: "2d"
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

export type PerformerBadgeCanvasFactory = (
  width: number,
  height: number
) => PerformerBadgeCanvas;

export const PERFORMER_BADGE_TEXTURE_SIZE = 64;

/** One exact badge painter shared by the DOM canvas and worker canvas paths. */
export function createPerformerBadgeTexture(
  index: number,
  color: string,
  selected: boolean,
  createCanvas: PerformerBadgeCanvasFactory
): CanvasTexture {
  const size = PERFORMER_BADGE_TEXTURE_SIZE;
  const canvas = createCanvas(size, size);
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Performer badge requires a 2D canvas context");

  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();

  if (selected) {
    context.strokeStyle = "rgba(255, 255, 255, 0.6)";
    context.lineWidth = 3;
    context.stroke();
  }

  context.fillStyle = "#ffffff";
  context.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1), size / 2, size / 2);

  return new CanvasTexture(canvas as unknown as HTMLCanvasElement);
}
