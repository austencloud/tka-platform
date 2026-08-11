import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterNavigateCallback: null as null | ((navigation: unknown) => void),
  resolveShortCode: vi.fn(),
  hydrateSequence: vi.fn(),
  openSequenceOverlay: vi.fn(),
  removeCurrentUrlParams: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  afterNavigate: (callback: (navigation: unknown) => void) => {
    mocks.afterNavigateCallback = callback;
  },
  goto: vi.fn(),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { loading: false },
}));

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({
    resolveShortCode: mocks.resolveShortCode,
  }),
}));

vi.mock("$lib/shared/navigation/services/sequence-hydrator", () => ({
  hydrateSequence: mocks.hydrateSequence,
}));

vi.mock("$lib/shared/create/get-loop-detector", () => ({
  getLoopDetector: () => ({ isLoop: vi.fn() }),
}));

vi.mock("$lib/shared/navigation/services/url-state", () => ({
  removeCurrentUrlParams: mocks.removeCurrentUrlParams,
}));

vi.mock("../state/sequence-viewer-overlay-state.svelte", () => ({
  getSequenceOverlayState: () => ({
    isOpen: false,
    sequence: null,
    initialBpm: 60,
    initialStep: 0,
    handPathMode: false,
    playOnOpen: false,
    dismissPath: null,
    openedFromUrl: false,
  }),
  closeSequenceOverlay: vi.fn(),
  openSequenceOverlay: mocks.openSequenceOverlay,
}));

vi.mock("./SequenceViewerOrchestrator.svelte", async () => ({
  default: (
    await import("./__test-stubs__/SequenceViewerDrawerHostChildStub.svelte")
  ).default,
}));

vi.mock("./SequenceViewerShell.svelte", async () => ({
  default: (
    await import("./__test-stubs__/SequenceViewerDrawerHostChildStub.svelte")
  ).default,
}));

import SequenceViewerDrawerHost from "./SequenceViewerDrawerHost.svelte";

describe("SequenceViewerDrawerHost URL bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterNavigateCallback = null;
    window.history.replaceState({}, "", "/create");
  });

  it("opens a sequence when a QR deep link arrives after the host mounted", async () => {
    const resolvedSequence = { id: "resolved-sequence" };
    const hydratedSequence = { id: "hydrated-sequence" };
    mocks.resolveShortCode.mockResolvedValue(resolvedSequence);
    mocks.hydrateSequence.mockResolvedValue(hydratedSequence);

    render(SequenceViewerDrawerHost);

    await vi.waitFor(() => {
      expect(mocks.afterNavigateCallback).toBeTypeOf("function");
    });
    expect(mocks.resolveShortCode).not.toHaveBeenCalled();

    const url = new URL("/browse/gallery?v=SCAN42", window.location.origin);
    window.history.replaceState({}, "", url);
    mocks.afterNavigateCallback?.({ to: { url } });

    await vi.waitFor(() => {
      expect(mocks.openSequenceOverlay).toHaveBeenCalledWith(hydratedSequence, {
        fromUrl: true,
        shortCode: "SCAN42",
        skipHistoryPush: true,
      });
    });

    expect(mocks.resolveShortCode).toHaveBeenCalledWith("SCAN42");
    expect(mocks.hydrateSequence).toHaveBeenCalledWith(resolvedSequence, {
      loopDetector: expect.any(Object),
    });
  });
});
