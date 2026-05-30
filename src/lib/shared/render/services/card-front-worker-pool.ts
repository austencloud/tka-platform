import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "./types";
import type { AssetBundle } from "./card-asset-bundle";
import { bundleTransferables } from "./card-asset-bundle";
import { createPictographWorker } from "../workers/create-pictograph-worker";
import type { WorkerInMessage, WorkerOutMessage } from "../workers/pictograph-render.worker";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

interface Lane { worker: Worker; seeded: boolean; pending: number; }
// Carries both render-result (Blob, via composeCell) and front-result
// (ImageBitmap, via composeFront). resolve is widened to accept either; each
// call site narrows at the await boundary.
interface PendingRender { resolve: (value: Blob | ImageBitmap) => void; reject: (e: Error) => void; }

const POOL_SIZE = Math.max(
  1,
  (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4) - 1,
);

// Parallel front rendering is DISABLED: benchmarked 0.45x (2.2x SLOWER) vs the
// main thread. Warm, per-cell raster is only ~13% of render time; ~87% is
// main-thread assembly (borders/QR/mandala/header glyphs/footer + draw). The
// worker pool can only offload that 13% and pays a per-cell tax for it — deep
// clone of prepared data + PNG encode in-worker + createImageBitmap decode on
// main. Amdahl + IPC = net loss. The infrastructure (assembler extraction,
// seed bundle) is kept for a future full-card-in-worker rebuild, which is the
// only path to a real multicore win but requires decoupling assembly from $env.
const PARALLEL_FRONT_ENABLED = false;

export class CardFrontWorkerPool {
  private lanes: Lane[] = [];
  private pending = new Map<number, PendingRender>();
  private nextId = 0;
  private deckKey: string | null = null;
  private bootPromise: Promise<void> | null = null;
  private booted = false;

  isReady(): boolean {
    if (!PARALLEL_FRONT_ENABLED) return false;
    return this.booted && this.lanes.length > 0 && this.deckKey !== null && this.lanes.every((l) => l.seeded);
  }

  /**
   * Flag-INDEPENDENT readiness — same body as isReady() minus the
   * PARALLEL_FRONT_ENABLED check. Lets the parity/timing harness verify the pool
   * is seeded and exercise composeFront WITHOUT enabling the parallel path in
   * production (production gates on isReady(), which stays flag-off). See the
   * PARALLEL_FRONT_ENABLED note for why production stays on the main thread.
   */
  isSeeded(): boolean {
    return this.booted && this.lanes.length > 0 && this.deckKey !== null && this.lanes.every((l) => l.seeded);
  }

  private boot(): Promise<void> {
    if (this.booted) return Promise.resolve();
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = (async () => {
      if (typeof OffscreenCanvas === "undefined") { this.booted = true; return; } // no lanes → never ready → caller falls back
      for (let i = 0; i < POOL_SIZE; i++) {
        const worker = createPictographWorker();
        const lane: Lane = { worker, seeded: false, pending: 0 };
        worker.onmessage = (ev: MessageEvent<WorkerOutMessage>) => this.onMessage(ev.data);
        this.lanes.push(lane);
      }
      this.booted = true;
    })();
    return this.bootPromise;
  }

  /**
   * Build + seed the deck's AssetBundle into every lane. Idempotent per deckKey.
   *
   * `force` bypasses the PARALLEL_FRONT_ENABLED gate so the parity/timing harness
   * can seed + composeFront while production stays OFF. Production callers
   * (PrintPreviewPages) pass no force, so the flag still gates them.
   */
  async seedForDeck(
    sequences: SequenceData[],
    opts: { bluePropType: PropType; redPropType: PropType; theme: string },
    deckKey: string,
    force = false,
  ): Promise<void> {
    if (!PARALLEL_FRONT_ENABLED && !force) return; // disabled — see PARALLEL_FRONT_ENABLED note
    await this.boot();
    if (this.lanes.length === 0) return; // no OffscreenCanvas
    if (this.deckKey === deckKey && this.lanes.every((l) => l.seeded)) return;

    const { getCardAssetBundle } = await import("./get-card-asset-bundle");
    const bundle = await getCardAssetBundle(sequences, opts);

    this.lanes.forEach((l) => (l.seeded = false));
    await Promise.all(this.lanes.map((lane) => this.seedLane(lane, bundle)));
    this.deckKey = deckKey;
  }

  private seedLane(lane: Lane, bundle: AssetBundle): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (ev: MessageEvent<WorkerOutMessage>) => {
        const m = ev.data;
        if (m.type === "seed-done") { lane.worker.removeEventListener("message", handler); lane.seeded = true; resolve(); }
        else if (m.type === "error" && m.id === -1) { lane.worker.removeEventListener("message", handler); reject(new Error(m.message)); }
      };
      lane.worker.addEventListener("message", handler);
      // Transfer detaches bitmaps, so each lane needs its own copy.
      const copy = structuredClone(bundle);
      const msg: WorkerInMessage = { type: "seed", bundle: copy };
      lane.worker.postMessage(msg, bundleTransferables(copy));
    });
  }

  async composeCell(
    prepared: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber: number | undefined,
  ): Promise<ImageBitmap> {
    if (!this.isReady()) throw new Error("CardFrontWorkerPool not ready");
    const id = this.nextId++;
    const lane = this.pickLane();
    lane.pending++;
    const msg: WorkerInMessage = JSON.parse(
      JSON.stringify({ type: "render", id, preparedData: prepared, options, visibility, stepNumber }),
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: Blob | ImageBitmap) => void, reject });
      lane.worker.postMessage(msg);
    });
    return createImageBitmap(blob);
  }

  /**
   * Render a full card front in one worker round-trip: one `paint-front` job
   * per card, the assembled ImageBitmap transferred back (zero-copy). This is
   * the full-card-in-worker path (Task 8); composeCell remains for the legacy
   * per-cell harness until it's retargeted.
   */
  async composeFront(job: import("./front-job").FrontJob): Promise<ImageBitmap> {
    // Gates on isSeeded (flag-independent) not isReady (flag-gated): the harness
    // force-seeds with the parallel flag OFF, so it must be able to compose even
    // though isReady() is false. Production reaches composeFront only after its
    // own isReady() gate (PrintCardRenderer), so this stays safe.
    if (!this.isSeeded()) throw new Error("CardFrontWorkerPool not ready");
    const id = this.nextId++;
    const lane = this.pickLane();
    lane.pending++;
    // The prepared cell data + resolved visibility carry Svelte $state proxies /
    // non-cloneable refs, so a raw postMessage(job) throws "could not be cloned".
    // Snapshot the job to plain JSON (same approach the legacy per-cell path used
    // on preparedData), preserving the one real Transferable — footer.iconBitmap —
    // out-of-band, then transfer it.
    const icon = job.footer.iconBitmap;
    const plainJob = JSON.parse(
      JSON.stringify({ ...job, footer: { ...job.footer, iconBitmap: undefined } }),
    ) as import("./front-job").FrontJob;
    if (icon) plainJob.footer.iconBitmap = icon;
    return new Promise<ImageBitmap>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: Blob | ImageBitmap) => void, reject });
      const transfer = icon ? [icon] : [];
      lane.worker.postMessage({ type: "paint-front", id, job: plainJob }, transfer);
    });
  }

  private pickLane(): Lane {
    let best = this.lanes[0]!;
    for (const l of this.lanes) if (l.pending < best.pending) best = l;
    return best;
  }

  private onMessage(msg: WorkerOutMessage): void {
    if (msg.type === "render-result") {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); this.decPending(); p.resolve(msg.blob); }
    } else if (msg.type === "front-result") {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); this.decPending(); p.resolve(msg.bitmap); }
    } else if (msg.type === "error" && msg.id >= 0) {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); this.decPending(); p.reject(new Error(msg.message)); }
    }
  }

  private decPending(): void {
    let max: Lane | null = null;
    for (const l of this.lanes) if (l.pending > 0 && (!max || l.pending > max.pending)) max = l;
    if (max) max.pending--;
  }

  dispose(): void {
    for (const l of this.lanes) l.worker.terminate();
    this.lanes = []; this.booted = false; this.deckKey = null; this.bootPromise = null;
    for (const [, p] of this.pending) p.reject(new Error("pool disposed"));
    this.pending.clear();
  }
}

let instance: CardFrontWorkerPool | null = null;
export function getCardFrontWorkerPool(): CardFrontWorkerPool {
  return (instance ??= new CardFrontWorkerPool());
}
