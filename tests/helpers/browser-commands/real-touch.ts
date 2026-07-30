import type { BrowserCommand } from "vitest/node";
// Type-only: applies the playwright provider's BrowserCommandContext
// augmentation (`ctx.page`, `ctx.frame`, `ctx.iframe`).
import type {} from "@vitest/browser-playwright";

/**
 * Drives a touch drag through Chromium's REAL input pipeline via CDP
 * `Input.dispatchTouchEvent` — scroll/gesture arbitration, `touch-action`,
 * implicit pointer capture, the works.
 *
 * This exists because synthetic `dispatchEvent(new PointerEvent(...))` bypasses
 * all of that: the 2026-07-29 drag-to-aim touch bug (browser stole the gesture
 * with a `pointercancel` because `touch-action: none` on an SVG child is not
 * honoured) passed a 64-case synthetic suite while being fully broken under a
 * real finger. Any test guarding touch behaviour must come through here.
 *
 * Coordinates are client coordinates INSIDE the test iframe (what
 * `getBoundingClientRect()` reports in the test); the command maps them onto
 * the orchestrator page.
 */
export const dispatchRealTouchDrag: BrowserCommand<
  [
    from: { x: number; y: number },
    to: { x: number; y: number },
    options?: { steps?: number; stepDelayMs?: number },
  ]
> = async (ctx, from, to, options = {}) => {
  if (ctx.provider.name !== "playwright") {
    throw new Error(
      `dispatchRealTouchDrag requires the playwright provider, got ${ctx.provider.name}`
    );
  }

  const { steps = 12, stepDelayMs = 16 } = options;

  // Map iframe-relative client coords to page coords. The tester iframe can be
  // scaled down when it doesn't fit the orchestrator viewport, so measure the
  // ratio rather than assuming 1:1.
  const frame = await ctx.frame();
  const iframeElement = await frame.frameElement();
  const box = await iframeElement.boundingBox();
  if (!box) throw new Error("test iframe has no bounding box");
  const innerSize = await frame.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const scaleX = box.width / innerSize.w;
  const scaleY = box.height / innerSize.h;
  const toPage = (p: { x: number; y: number }) => ({
    x: box.x + p.x * scaleX,
    y: box.y + p.y * scaleY,
  });

  const cdp = await ctx.page.context().newCDPSession(ctx.page);
  try {
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });

    const touchPoint = (p: { x: number; y: number }) => [
      { x: p.x, y: p.y, radiusX: 12, radiusY: 14, force: 0.6, id: 0 },
    ];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const start = toPage(from);
    const end = toPage(to);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: touchPoint(start),
    });
    for (let i = 1; i <= steps; i++) {
      await sleep(stepDelayMs);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: touchPoint({
          x: start.x + ((end.x - start.x) * i) / steps,
          y: start.y + ((end.y - start.y) * i) / steps,
        }),
      });
    }
    await sleep(stepDelayMs);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await cdp.detach().catch(() => {});
  }
};

declare module "vitest/browser" {
  interface BrowserCommands {
    dispatchRealTouchDrag: (
      from: { x: number; y: number },
      to: { x: number; y: number },
      options?: { steps?: number; stepDelayMs?: number }
    ) => Promise<void>;
  }
}
