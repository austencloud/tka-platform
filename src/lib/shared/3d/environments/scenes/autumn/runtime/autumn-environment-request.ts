import { getAutumnEnvironmentUrl } from "./autumn-boot-state";

export const AUTUMN_ENVIRONMENT_TIMEOUT_MS = 15_000;

export interface AutumnEnvironmentFailure {
  reason: "rejected" | "timeout";
  message: string;
  error?: unknown;
}

interface StartAutumnEnvironmentRequestOptions<T> {
  retryRequest: number;
  load: (url: string) => Promise<T>;
  onReady: (value: T) => void;
  onFailure: (failure: AutumnEnvironmentFailure) => void;
  timeoutMs?: number;
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
  timeoutMs = AUTUMN_ENVIRONMENT_TIMEOUT_MS,
}: StartAutumnEnvironmentRequestOptions<T>): () => void {
  let cancelled = false;
  let settled = false;

  const timer = setTimeout(() => {
    if (cancelled || settled) return;
    settled = true;
    onFailure({
      reason: "timeout",
      message:
        "Autumn is taking too long to load. Check the connection and retry.",
    });
  }, timeoutMs);

  Promise.resolve()
    .then(() => load(getAutumnEnvironmentUrl(retryRequest)))
    .then(
      (value) => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(timer);
        onReady(value);
      },
      (error: unknown) => {
        if (cancelled || settled) return;
        settled = true;
        clearTimeout(timer);
        onFailure({
          reason: "rejected",
          message: "Autumn couldn't load. Retry the environment.",
          error,
        });
      }
    );

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
