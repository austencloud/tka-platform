export interface CameraUrlPoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraUrlPose {
  position: CameraUrlPoint;
  target: CameraUrlPoint;
  fov: number;
}

function parsePoint(raw: string | null): CameraUrlPoint | null {
  if (!raw) return null;
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.length !== 3 || !values.every(Number.isFinite)) return null;
  const [x, y, z] = values;
  if (x === undefined || y === undefined || z === undefined) return null;
  return { x, y, z };
}

/**
 * Read the camera format shared by 3D review links. Both points are required:
 * restoring only the camera position would leave the viewer looking somewhere
 * different from the person who shared the URL.
 */
export function readCameraUrlPose(
  searchParams: URLSearchParams,
  fallbackFov: number
): CameraUrlPose | null {
  const position = parsePoint(searchParams.get("cam"));
  const target = parsePoint(searchParams.get("look"));
  if (!position || !target) return null;

  const requestedFov = Number(searchParams.get("fov"));
  const fov =
    Number.isFinite(requestedFov) && requestedFov > 0
      ? requestedFov
      : fallbackFov;
  return { position, target, fov };
}

function formatPoint(point: CameraUrlPoint, precision: number): string {
  return [point.x, point.y, point.z]
    .map((value) => value.toFixed(precision))
    .join(",");
}

export function setCameraUrlPose(
  url: URL,
  pose: CameraUrlPose,
  precision = 2
): void {
  url.searchParams.set("cam", formatPoint(pose.position, precision));
  url.searchParams.set("look", formatPoint(pose.target, precision));
  url.searchParams.set("fov", String(pose.fov));
}

export function clearCameraUrlPose(url: URL): void {
  url.searchParams.delete("cam");
  url.searchParams.delete("look");
  url.searchParams.delete("fov");
}
