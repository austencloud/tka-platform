import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — vi.mock factories are lifted above imports, so any value they
// reference must come from vi.hoisted (not a plain top-level const).
const h = vi.hoisted(() => ({
  composeFrontBitmap: vi.fn(),
  wrapFrame: vi.fn(() => ({ __framed: true })),
  workerAvailable: true,
}));

vi.mock("$lib/shared/render/services/composition-dispatcher", () => ({
  CompositionDispatcher: { canUseWorker: () => h.workerAvailable },
}));
vi.mock("$lib/shared/render/get-composition-dispatcher", () => ({
  getCompositionDispatcher: () => ({ composeFrontBitmap: h.composeFrontBitmap }),
}));
// Only the canvas-drawing wrapper needs stubbing. getCardFrameContentInset is
// pure arithmetic the compose options genuinely depend on, so it stays real.
vi.mock("../card-front-frame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../card-front-frame")>()),
  wrapContentInCardFrame: h.wrapFrame,
}));

// Stub the back-render import graph (pulls Firebase/protobuf, irrelevant here).
vi.mock("../card-back-dom-renderer", () => ({ renderCardBack: vi.fn() }));
vi.mock("../info-card-canvas-renderer", () => ({
  renderInfoCardFront: vi.fn(),
  renderInfoCardBack: vi.fn(),
}));
vi.mock("../card-back/card-back-job-builder", () => ({ buildBackJob: vi.fn() }));
vi.mock("../card-back/card-back-raster", () => ({ paintBackJob: vi.fn() }));

import { PrintCardRenderer } from "../PrintCardRenderer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = { id: "x", word: "X", steps: [], author: "" } as unknown as SequenceData;
const options = { canvasWidth: 822, canvasHeight: 1122, bleedPx: 36, includeStartPosition: true } as never;

describe("PrintCardRenderer.renderFront worker path", () => {
  beforeEach(() => {
    h.composeFrontBitmap.mockReset();
    h.wrapFrame.mockClear();
    h.wrapFrame.mockReturnValue({ __framed: true });
    h.workerAvailable = true;
  });

  it("uses composeFrontBitmap + frame wrap when the worker is available", async () => {
    const innerBitmap = { close: vi.fn() } as unknown as ImageBitmap;
    h.composeFrontBitmap.mockResolvedValue(innerBitmap);
    const composer = { composeSequenceImage: vi.fn() } as never;

    const renderer = new PrintCardRenderer(composer, "cosmic");
    const out = await renderer.renderFront(seq, options);

    expect(h.composeFrontBitmap).toHaveBeenCalledOnce();
    expect(h.wrapFrame).toHaveBeenCalledOnce();
    expect((innerBitmap as { close: () => void }).close).toHaveBeenCalledOnce();
    expect(out as unknown).toEqual({ __framed: true });
    expect((composer as { composeSequenceImage: () => void }).composeSequenceImage).not.toHaveBeenCalled();
  });

  it("falls back to the main-thread compose when the worker throws", async () => {
    h.composeFrontBitmap.mockRejectedValue(new Error("worker boom"));
    const mainCanvas = { __main: true };
    const composer = { composeSequenceImage: vi.fn().mockResolvedValue(mainCanvas) } as never;

    const renderer = new PrintCardRenderer(composer, "cosmic");
    await renderer.renderFront(seq, options);

    expect((composer as { composeSequenceImage: ReturnType<typeof vi.fn> }).composeSequenceImage).toHaveBeenCalledOnce();
    expect(h.wrapFrame).toHaveBeenCalledWith(mainCanvas, expect.anything(), expect.anything());
  });
});
