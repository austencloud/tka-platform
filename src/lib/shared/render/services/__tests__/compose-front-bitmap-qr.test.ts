import { describe, it, expect } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

// composeFrontBitmap must put the QR bitmap in the postMessage transfer list so
// it is moved (not cloned) into the worker.
describe("composeFrontBitmap qr transfer", () => {
  it("transfers the qrBitmap to the worker", async () => {
    const posted: { msg: any; transfer: Transferable[] }[] = [];
    const fakeWorker = {
      worker: {
        postMessage: (msg: any, transfer: Transferable[]) => posted.push({ msg, transfer }),
      },
      ready: true,
      pendingCount: 0,
    };
    const d = new CompositionDispatcher({} as never, {} as never);
    (d as any).initialized = true;
    (d as any).ensureInitialized = async () => {};
    (d as any).pickWorker = () => fakeWorker;

    const qr = { width: 8, height: 8 } as unknown as ImageBitmap;
    void d.composeFrontBitmap({ steps: [] } as never, {} as never, qr);
    await Promise.resolve();

    expect(posted).toHaveLength(1);
    expect(posted[0]!.msg.qrBitmap).toBe(qr);
    expect(posted[0]!.transfer).toContain(qr);
  });

  it("sends an empty transfer list when no qrBitmap", async () => {
    const posted: { msg: any; transfer: Transferable[] }[] = [];
    const fakeWorker = {
      worker: {
        postMessage: (msg: any, transfer: Transferable[]) => posted.push({ msg, transfer }),
      },
      ready: true,
      pendingCount: 0,
    };
    const d = new CompositionDispatcher({} as never, {} as never);
    (d as any).initialized = true;
    (d as any).ensureInitialized = async () => {};
    (d as any).pickWorker = () => fakeWorker;

    void d.composeFrontBitmap({ steps: [] } as never, {} as never);
    await Promise.resolve();

    expect(posted[0]!.msg.qrBitmap).toBeNull();
    expect(posted[0]!.transfer).toEqual([]);
  });
});
