import { describe, it, expect, afterEach } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

// The thumbnail path calls compose() (not composeFrontBitmap). It used to
// hardcode qrBitmap:null, so worker-rendered gallery thumbnails NEVER drew a QR
// regardless of the setting. compose() must now forward + transfer the QR
// bitmap to the worker, which re-attaches it as options.qrImageBitmap.
describe("compose() qr transfer (thumbnail path)", () => {
  afterEach(() => {
    (CompositionDispatcher as unknown as { workerSupport: boolean | null }).workerSupport = null;
  });

  function makeDispatcher(posted: { msg: any; transfer: Transferable[] }[]) {
    const fakeWorker = {
      worker: {
        postMessage: (msg: any, transfer: Transferable[]) => posted.push({ msg, transfer }),
      },
      ready: true,
      pendingCount: 0,
    };
    // Force the worker path (compose() gates on canUseWorker()).
    (CompositionDispatcher as unknown as { workerSupport: boolean | null }).workerSupport = true;
    const d = new CompositionDispatcher({} as never, {} as never);
    (d as any).initialized = true;
    (d as any).ensureInitialized = async () => {};
    (d as any).pickWorker = () => fakeWorker;
    return d;
  }

  it("transfers the qrBitmap to the worker when supplied", async () => {
    const posted: { msg: any; transfer: Transferable[] }[] = [];
    const d = makeDispatcher(posted);

    const qr = { width: 8, height: 8 } as unknown as ImageBitmap;
    void d.compose({ steps: [] } as never, {} as never, undefined, undefined, qr);
    await Promise.resolve();

    expect(posted).toHaveLength(1);
    expect(posted[0]!.msg.qrBitmap).toBe(qr);
    expect(posted[0]!.transfer).toContain(qr);
  });

  it("sends null qrBitmap + empty transfer list when none supplied", async () => {
    const posted: { msg: any; transfer: Transferable[] }[] = [];
    const d = makeDispatcher(posted);

    void d.compose({ steps: [] } as never, {} as never);
    await Promise.resolve();

    expect(posted[0]!.msg.qrBitmap).toBeNull();
    expect(posted[0]!.transfer).toEqual([]);
  });
});
