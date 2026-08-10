/**
 * View capture - copy a view, replay a view.
 *
 * Austen walks a 3D room, sees something wrong, and needs to hand that exact
 * viewpoint to an agent. Words do not locate a camera: "the spiky bit near the
 * second court" is not a position, so the agent guesses, screenshots something
 * adjacent, and reports on a frame that was never the complaint.
 *
 * This copies both halves to the clipboard. The PNG proves what he saw. The
 * pose lets an agent stand in the same spot after a change and compare like for
 * like.
 *
 * Scene-agnostic on purpose: this module knows about a pose, a canvas and a
 * clipboard. What the pose means is the calling scene's business.
 */

/** A first-person camera pose. Angles in radians, position in world metres. */
export interface ViewPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** The clipboard payload. Fields are omitted, never nulled, when unavailable. */
export interface ViewCapture {
  scene: string;
  /** Absolute disk path, for an agent to read the image directly. */
  frame?: string;
  /** Served URL, for opening the frame in a browser. */
  frameUrl?: string;
  /** Why no frame. Present only when the capture failed. */
  frameError?: string;
  /** The current URL plus `view=`, so room state survives into the replay. */
  replay: string;
  camera: ViewPose;
  viewport: { width: number; height: number };
  /** Opaque per-scene identifiers. Not interpreted here. */
  state?: Record<string, unknown>;
}

/** Query parameter carrying an encoded pose. */
export const VIEW_PARAM = "view";

const ROUND = 1e4;
const round = (value: number) => Math.round(value * ROUND) / ROUND;

/**
 * Encode a pose as base64url, so it survives a URL without escaping.
 *
 * Rounded to four decimals first: sub-tenth-of-a-millimetre precision is noise
 * that only makes the URL longer and the copied JSON harder to read.
 */
export function encodeViewParam(pose: ViewPose): string {
  const compact = {
    x: round(pose.x),
    y: round(pose.y),
    z: round(pose.z),
    yaw: round(pose.yaw),
    pitch: round(pose.pitch),
  };
  const json = JSON.stringify(compact);
  const base64 =
    typeof btoa === "function"
      ? btoa(json)
      : Buffer.from(json, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read a pose out of a query string. Returns null when absent or unusable.
 *
 * Null rather than throwing: a mistyped URL should drop the visitor at the
 * spawn point, not white-screen the route.
 */
export function parseViewParam(search: string): ViewPose | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get(VIEW_PARAM);
  } catch {
    return null;
  }
  if (!raw) return null;

  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    // typeof, not Number(): coercion turns null into 0 and "" into 0, so a
    // corrupt pose would silently teleport the visitor to the world origin
    // rather than being rejected.
    const read = (key: keyof ViewPose): number | null => {
      const value = candidate[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };
    const x = read("x");
    const y = read("y");
    const z = read("z");
    const yaw = read("yaw");
    const pitch = read("pitch");
    if (x === null || y === null || z === null || yaw === null || pitch === null) {
      return null;
    }
    return { x, y, z, yaw, pitch };
  } catch {
    return null;
  }
}

/** Build the replay URL from the live location, preserving every other param. */
export function buildReplayUrl(pose: ViewPose, location: URL): string {
  const url = new URL(location.href);
  url.searchParams.set(VIEW_PARAM, encodeViewParam(pose));
  return url.toString();
}

export interface CaptureViewOptions {
  /** Scene id. Names the capture folder and appears in the payload. */
  sceneId: string;
  pose: ViewPose;
  /** The live WebGL canvas. Requires `preserveDrawingBuffer` on the renderer. */
  canvas: HTMLCanvasElement | null | undefined;
  /** Per-scene identifiers to carry along (phase, active exhibit, ...). */
  state?: Record<string, unknown>;
}

async function writeFrame(
  sceneId: string,
  canvas: HTMLCanvasElement
): Promise<{ frame?: string; frameUrl?: string; frameError?: string }> {
  let base64: string;
  try {
    // Blank output here means the renderer lacks preserveDrawingBuffer: the
    // context is free to discard the drawing buffer once it has composited.
    base64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
  } catch (error) {
    return {
      frameError: `canvas read failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!base64) return { frameError: "canvas produced an empty frame" };

  try {
    const response = await fetch("/api/dev/view-capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sceneId, base64 }),
    });
    if (!response.ok) {
      return { frameError: `capture endpoint returned ${response.status}` };
    }
    const body: { absolutePath?: string; path?: string } =
      await response.json();
    return { frame: body.absolutePath, frameUrl: body.path };
  } catch (error) {
    return {
      frameError: `capture endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Capture the current view and put it on the clipboard.
 *
 * Every failure degrades rather than cancelling: the pose is the part an agent
 * cannot reconstruct, so the pose always survives even when the image does not.
 */
export async function captureView(
  options: CaptureViewOptions
): Promise<ViewCapture> {
  const { sceneId, pose, canvas, state } = options;

  const frameResult = canvas
    ? await writeFrame(sceneId, canvas)
    : { frameError: "no canvas available" };

  const capture: ViewCapture = {
    scene: sceneId,
    ...frameResult,
    replay: buildReplayUrl(pose, new URL(window.location.href)),
    camera: {
      x: round(pose.x),
      y: round(pose.y),
      z: round(pose.z),
      yaw: round(pose.yaw),
      pitch: round(pose.pitch),
    },
    viewport: {
      width: canvas?.width ?? window.innerWidth,
      height: canvas?.height ?? window.innerHeight,
    },
    ...(state ? { state } : {}),
  };

  const json = JSON.stringify(capture, null, 2);
  try {
    await navigator.clipboard.writeText(json);
  } catch {
    // Clipboard is permission-gated and unavailable over plain http. Logging
    // with a known prefix keeps the capture recoverable from the console.
    console.log("[view-capture]", json);
  }

  return capture;
}
