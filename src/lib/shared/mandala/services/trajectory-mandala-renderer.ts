import type {
  ProjectedTrajectoryPoint,
  ProjectedTrajectorySet,
} from "../domain/trajectory-types";
import { projectedTrajectoriesToMandalaLayers } from "./mandala-layer-adapter";

export function revealTrajectoryPoints(
  points: readonly ProjectedTrajectoryPoint[],
  throughBeat: number,
  durationBeats: number
): readonly ProjectedTrajectoryPoint[] {
  if (!points.length) return [];
  const timeAt = (index: number) =>
    points[index]!.beat ??
    (durationBeats * index) / Math.max(1, points.length - 1);
  if (throughBeat < timeAt(0)) return [];
  if (throughBeat >= timeAt(points.length - 1)) return points;
  let low = 0;
  let high = points.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (timeAt(middle) <= throughBeat) low = middle;
    else high = middle;
  }
  const from = points[low]!;
  const to = points[high]!;
  if (to.breakBefore) return points.slice(0, low + 1);
  const span = timeAt(high) - timeAt(low);
  const fraction = span > 0 ? (throughBeat - timeAt(low)) / span : 0;
  return [
    ...points.slice(0, low + 1),
    {
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
      beat: throughBeat,
    },
  ];
}

export function paintTrajectoryMandala(
  context: CanvasRenderingContext2D,
  trajectories: ProjectedTrajectorySet,
  options: {
    pixelSize: number;
    viewBoxSize: number;
    throughBeat: number;
    strokeWidth: number;
  }
): void {
  const { pixelSize, viewBoxSize, throughBeat, strokeWidth } = options;
  const scale = pixelSize / viewBoxSize;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize, pixelSize);
  context.setTransform(scale, 0, 0, -scale, pixelSize / 2, pixelSize / 2);
  context.lineWidth = strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const layer of trajectories.layers) {
    const points = revealTrajectoryPoints(
      layer.points,
      throughBeat,
      trajectories.durationBeats
    );
    context.beginPath();
    for (let index = 0; index < points.length; index++) {
      const point = points[index]!;
      if (index === 0 || point.breakBefore) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = layer.color;
    context.stroke();
  }
  context.restore();
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderTrajectoryMandalaSVG(
  trajectories: ProjectedTrajectorySet,
  viewBoxSize: number,
  strokeWidth = 2
): string {
  const layers = projectedTrajectoriesToMandalaLayers(trajectories);
  const paths = layers.layers
    .flatMap((layer) =>
      layer.paths.map(
        (path) =>
          `<path stroke="${escapeAttribute(layer.color)}" d="${escapeAttribute(path.d)}"/>`
      )
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBoxSize}" height="${viewBoxSize}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"><title>Third Order Mandala</title><g transform="translate(${viewBoxSize / 2} ${viewBoxSize / 2}) scale(1 -1)" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
