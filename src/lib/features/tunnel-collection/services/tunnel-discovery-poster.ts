import { mount, unmount } from "svelte";
import TunnelDetailPreview from "../components/TunnelDetailPreview.svelte";
import {
  capturePosterFromContainer,
  compositeContainerLayers,
  DISCOVERY_POSTER_SIZE,
  DISCOVERY_RENDER_SIZE,
  POSTER_MAX_BYTES,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-poster";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

/**
 * Renders a saved tunnel offscreen at DISCOVERY_RENDER_SIZE and composites its
 * canvas layers down into a DISCOVERY_POSTER_SIZE world-readable Explore poster.
 *
 * The in-document `tunnel.poster` is a 200px thumbnail — right for the
 * collection grid, where every tunnel's poster rides inside its own Firestore
 * document, and far too small for Explore, which puts artwork on a plinth that
 * reaches ~950 CSS px on a 4K canvas. Re-uploading the thumbnail as the
 * discovery poster is what made published tunnels read as blocks.
 *
 * Rendering here rather than upscaling means the poster is resolution-independent:
 * it does not inherit whatever size the owner's screen happened to give the
 * preview when they pressed Share. This mirrors the mandala adapter, which
 * derives its poster from geometry for the same reason.
 */

/**
 * Hidden host: laid out (canvases need real boxes) and on-screen, but invisible.
 *
 * `left: -99999px` looks like the tidier choice and is the wrong one — Chrome
 * throttles rAF for content parked outside the viewport. A/B on the same tunnel,
 * three captures each: parked offscreen it took 9.8-10.0s and covered 10-14% of
 * the frame; at zero opacity behind the page, 3.6-4.6s and 15-19%. Slower AND a
 * thinner figure, because the trail stamps once per rendered frame. Zero opacity
 * keeps the renderer at full rate while showing the user nothing.
 */
function createHost(size: number): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: `${size}px`,
    height: `${size}px`,
    overflow: "hidden",
    opacity: "0",
    zIndex: "-1",
    pointerEvents: "none",
    // TunnelDetailPreview's .preview-stage sizes itself with 100cqw/100cqh, so
    // the host has to be a size container exactly like .detail-preview is.
    containerType: "size",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(host);
  return host;
}

/**
 * A tunnel's figure is not one frame. The stage has a long cold start — building
 * the kaleidoscope layers, preparing pictographs and loading prop art all happen
 * before a single pixel lands — and then the trail accumulator needs a moment to
 * fill in. Measured on a real tunnel: nothing at all is drawn at 5s, and the
 * complete figure is there by 8s.
 *
 * So don't guess a duration. Poll the stage until it has actually drawn
 * something, THEN hold for the trail to reach steady state. A fixed hold either
 * captures a black square (too short) or taxes every publish with the worst
 * machine's cold start (too long).
 *
 * Known and deliberately not fixed here: how DENSE the trail looks depends on
 * the frame rate, because the overlay's alpha-decay pass is throttled to every
 * Nth frame rather than by elapsed time. A slow stage therefore yields a fuller
 * figure than a fast one, and the poster can read richer than the live preview
 * on a quick machine. That belongs to the trail overlay (it affects every
 * surface that draws trails), not to poster sizing.
 */

/** Edge length of the scratch composite used to ask "has anything drawn yet?".
 *  Tiny on purpose: this runs on a timer, and the readback is the cost. */
const LIVENESS_PROBE_SIZE = 48;
/** Channel sum above which a probe pixel counts as drawn art rather than the
 *  stage's black ground. Low enough to catch a dim first frame. */
const LIVENESS_MIN_CHANNEL_SUM = 24;
/** Poll interval for the liveness probe. Every frame would be wasteful — each
 *  probe forces a GPU readback — and the cold start is measured in seconds. */
const LIVENESS_POLL_MS = 120;
/** Give up waiting for first paint. Past this the renderer is stuck or the
 *  machine is overwhelmed; the caller falls back to the stored thumbnail. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Floor/ceiling on the post-first-paint settle, which otherwise tracks the
 *  tunnel's own trail fade duration — the quantity that decides how long the
 *  figure takes to fill in. Default trails fade over 2500ms. */
const SETTLE_FLOOR_MS = 1_200;
const SETTLE_CEILING_MS = 6_000;
/** Trails are stamped once per rendered frame, so a settle that spans only a
 *  handful of frames yields a polygonal figure however long it lasted. */
const SETTLE_MIN_FRAMES = 24;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** True once any canvas layer in the stage holds a pixel brighter than its own
 *  black ground. */
function hasDrawnContent(host: HTMLElement): boolean {
  const probe = compositeContainerLayers(host, LIVENESS_PROBE_SIZE);
  const ctx = probe?.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(
    0,
    0,
    LIVENESS_PROBE_SIZE,
    LIVENESS_PROBE_SIZE
  );
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > LIVENESS_MIN_CHANNEL_SUM) {
      return true;
    }
  }
  return false;
}

/** Resolves true once the stage has drawn, false if it never does. */
async function waitForFirstPaint(host: HTMLElement): Promise<boolean> {
  const deadline = performance.now() + FIRST_PAINT_TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (hasDrawnContent(host)) return true;
    await new Promise((resolve) => setTimeout(resolve, LIVENESS_POLL_MS));
  }
  return false;
}

/** Hold for BOTH a wall-clock window (the trail fade is time-normalized) and a
 *  minimum number of rendered frames (each frame is one trail stamp). */
async function settle(ms: number): Promise<void> {
  const start = performance.now();
  // The frame floor can outlast the wall clock on a slow renderer; cap the
  // overrun so a stalled stage can't hold a publish open indefinitely.
  const hardStop = start + ms + SETTLE_CEILING_MS;
  let frames = 0;
  while (performance.now() - start < ms || frames < SETTLE_MIN_FRAMES) {
    if (performance.now() >= hardStop) return;
    await nextFrame();
    frames++;
  }
}

function settleMsFor(tunnel: CollectedTunnel): number {
  const fade = tunnel.snapshot?.trailRender?.fadeDurationMs;
  const base = typeof fade === "number" && fade > 0 ? fade : SETTLE_FLOOR_MS;
  return Math.min(Math.max(base, SETTLE_FLOOR_MS), SETTLE_CEILING_MS);
}

/**
 * Returns a WebP data URL, or "" when the tunnel could not be rendered (no DOM,
 * no drawable layer, renderer threw). Callers fall back to the stored thumbnail
 * so a publish never fails on its poster.
 */
export async function renderTunnelDiscoveryPoster(
  tunnel: CollectedTunnel
): Promise<string> {
  if (typeof document === "undefined") return "";

  const host = createHost(DISCOVERY_RENDER_SIZE);
  let component: Record<string, unknown> | undefined;
  try {
    // TunnelDetailPreview captures/applies/restores the three renderer globals
    // it can't take as props. When the owner publishes from the tunnel detail
    // view, an on-screen instance of the SAME tunnel is already mounted, so the
    // values this instance captures and restores are the ones already applied —
    // the nesting is a no-op rather than a fight.
    component = mount(TunnelDetailPreview, {
      target: host,
      props: { tunnel },
    }) as Record<string, unknown>;

    if (!(await waitForFirstPaint(host))) return "";
    await settle(settleMsFor(tunnel));

    return capturePosterFromContainer(host, {
      size: DISCOVERY_POSTER_SIZE,
      budgetBytes: POSTER_MAX_BYTES,
    });
  } catch {
    return "";
  } finally {
    if (component) {
      try {
        void unmount(component);
      } catch {
        // Teardown failure must not strand the host in the document.
      }
    }
    host.remove();
  }
}
