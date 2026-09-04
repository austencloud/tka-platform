export interface WorkerRendererResponsivenessResult {
  requestId: number;
  requestedAt: number;
  mainThreadMaxGapMs: number;
  mainThreadGapsOver50Ms: number;
  outgoingWorkerMaxFrameGapMs: number;
}

export interface WorkerRendererResponsivenessState extends WorkerRendererResponsivenessResult {
  previousTimerAt: number;
}

export function createWorkerRendererResponsivenessState(
  requestId: number,
  requestedAt: number
): WorkerRendererResponsivenessState {
  return {
    requestId,
    requestedAt,
    previousTimerAt: requestedAt,
    mainThreadMaxGapMs: 0,
    mainThreadGapsOver50Ms: 0,
    outgoingWorkerMaxFrameGapMs: 0,
  };
}

export function recordMainThreadTimer(
  state: WorkerRendererResponsivenessState,
  now: number
): void {
  const gap = now - state.previousTimerAt;
  state.previousTimerAt = now;
  state.mainThreadMaxGapMs = Math.max(state.mainThreadMaxGapMs, gap);
  if (gap > 50) state.mainThreadGapsOver50Ms += 1;
}

export function recordOutgoingWorkerFrame(
  state: WorkerRendererResponsivenessState,
  deltaMs: number
): void {
  state.outgoingWorkerMaxFrameGapMs = Math.max(
    state.outgoingWorkerMaxFrameGapMs,
    deltaMs
  );
}

export class WorkerRendererResponsivenessProbe {
  private active: WorkerRendererResponsivenessState | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  begin(requestId: number): void {
    this.end();
    const requestedAt = performance.now();
    const active = createWorkerRendererResponsivenessState(
      requestId,
      requestedAt
    );
    this.active = active;
    this.interval = setInterval(() => {
      if (this.active === active) {
        recordMainThreadTimer(active, performance.now());
      }
    }, 16);
  }

  recordOutgoingFrame(deltaMs: number): void {
    if (this.active) recordOutgoingWorkerFrame(this.active, deltaMs);
  }

  end(): WorkerRendererResponsivenessResult | null {
    const active = this.active;
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    this.active = null;
    if (!active) return null;
    return {
      requestId: active.requestId,
      requestedAt: active.requestedAt,
      mainThreadMaxGapMs: active.mainThreadMaxGapMs,
      mainThreadGapsOver50Ms: active.mainThreadGapsOver50Ms,
      outgoingWorkerMaxFrameGapMs: active.outgoingWorkerMaxFrameGapMs,
    };
  }
}
