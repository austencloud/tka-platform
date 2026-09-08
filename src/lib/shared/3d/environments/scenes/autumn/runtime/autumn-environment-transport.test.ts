import { describe, expect, it, vi } from "vitest";
import { createAutumnEnvironmentTransport } from "./autumn-environment-transport";

describe("Autumn environment transport", () => {
  it("aborts its dedicated loading manager when the request is cancelled", async () => {
    const abort = vi.fn();
    let rejectLoad!: (reason: unknown) => void;
    const loadAsync = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectLoad = reject;
        })
    );
    const transport = createAutumnEnvironmentTransport(() => {}, {
      createManager: () => ({ abort }),
      createLoader: () => ({ loadAsync }),
    });
    const controller = new AbortController();
    const pending = transport("/autumn.glb", vi.fn(), controller.signal);

    controller.abort();
    rejectLoad(new DOMException("Aborted", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalledOnce();
  });

  it("does not start a transport for an already-cancelled request", async () => {
    const createManager = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const transport = createAutumnEnvironmentTransport(() => {}, {
      createManager,
    });

    await expect(
      transport("/autumn.glb", vi.fn(), controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createManager).not.toHaveBeenCalled();
  });
});
