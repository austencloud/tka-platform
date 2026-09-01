import { getAutumnEnvironmentUrl } from "./autumn-boot-state";

export const AUTUMN_ENVIRONMENT_STALL_TIMEOUT_MS = 15_000;
export const AUTUMN_ENVIRONMENT_TOTAL_TIMEOUT_MS = 90_000;

export interface AutumnEnvironmentProgress {
  loaded: number;
  total?: number;
}

export interface AutumnEnvironmentFailure {
  reason: "rejected" | "timeout";
  message: string;
  error?: unknown;
}

interface StartAutumnEnvironmentRequestOptions<T> {
  retryRequest: number;
  load: (
    url: string,
    onProgress: (progress: AutumnEnvironmentProgress) => void
  ) => PromiseLike<T>;
  onReady: (value: T) => void;
  onFailure: (failure: AutumnEnvironmentFailure) => void;
  stallTimeoutMs?: number;
  totalTimeoutMs?: number;
}

/**
 * Owns one cancellable GLB request, including the stall boundary.
 *
 * Late resolve/reject callbacks are ignored after cancellation or timeout so
 * an old retry cannot replace the current world.
 */
export function startAutumnEnvironmentRequest<T>({
  retryRequest,
  load,
  onReady,
  onFailure,
  stallTimeoutMs = AUTUMN_ENVIRONMENT_STALL_TIMEOUT_MS,
  totalTimeoutMs = AUTUMN_ENVIRONMENT_TOTAL_TIMEOUT_MS,
}: StartAutumnEnvironmentRequestOptions<T>): () => void {
  let cancelled = false;
  let settled = false;
  let lastLoadedBytes = -1;
  let stallTimer: ReturnType<typeof setTimeout>;

  function failForTimeout(message: string): void {
    if (cancelled || settled) return;
    settled = true;
    clearTimeout(stallTimer);
    clearTimeout(totalTimer);
    onFailure({
      reason: "timeout",
      message,
    });
  }

  function armStallTimer(): void {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      failForTimeout(
        "Autumn stopped receiving data. Check the connection and retry."
      );
    }, stallTimeoutMs);
  }

  function reportProgress(progress: AutumnEnvironmentProgress): void {
    if (cancelled || settled || progress.loaded <= lastLoadedBytes) return;
    lastLoadedBytes = progress.loaded;
    armStallTimer();
  }

  const totalTimer = setTimeout(() => {
    failForTimeout(
      "Autumn is taking too long to finish loading. Check the connection and retry."
    );
  }, totalTimeoutMs);
  armStallTimer();

  Promise.resolve()
    .then(() => load(getAutumnEnvironmentUrl(retryRequest), reportProgress))
    .then(
      (value) => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(stallTimer);
        clearTimeout(totalTimer);
        onReady(value);
      },
      (error: unknown) => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(stallTimer);
        clearTimeout(totalTimer);
        onFailure({
          reason: "rejected",
          message: "Autumn couldn't load. Retry the environment.",
          error,
        });
      }
    );

  return () => {
    cancelled = true;
    clearTimeout(stallTimer);
    clearTimeout(totalTimer);
  };
}
