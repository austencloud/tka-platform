/**
 * Classified, auto-retrying, cancellable sequence resolution for the Choreo
 * sheet. Private library first, public gallery fallback, with the auth-settled
 * gate in front so a restored draft never races Firebase session restoration
 * (the six-red-rows bug). Pure DI — the view wires the real loaders.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { LibraryError } from "$lib/shared/library/domain/library-error";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/is-permission-denied-error";

export type ResolveFailure = "transient" | "permission" | "missing";

export interface ResolveOutcome {
  sequence: SequenceData | null;
  source: "private" | "public" | null;
  failure: ResolveFailure | null;
  attempts: number;
}

export interface SheetSequenceResolverDeps {
  /** Private library read. Throws LibraryError / FirestoreError; null = confirmed not in library. */
  loadPrivate: (id: string) => Promise<SequenceData | null>;
  /** Public gallery read. null = confirmed not public; throws only for network-class failures. */
  loadPublic: (id: string) => Promise<SequenceData | null>;
  awaitAuthSettled: () => Promise<void>;
  /** Injectable for fake timers in tests. */
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/** Error classes: unauthorized = genuinely no identity (post-settle) → public-only,
 *  permission = never present as deleted, transient = retry. Unknowns fail open
 *  to transient — never toward "deleted". */
export function classifyResolveError(error: unknown): "unauthorized" | "permission" | "transient" {
  if (error instanceof LibraryError && error.code === "UNAUTHORIZED") return "unauthorized";
  if (isPermissionDeniedError(error)) return "permission";
  return "transient";
}

const BACKOFF_MS = [500, 1500, 4000] as const;

function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

function abortError(): DOMException {
  return new DOMException("Sequence resolution aborted", "AbortError");
}

function defaultDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function hasSteps(seq: SequenceData | null): seq is SequenceData {
  return seq != null && (seq.steps?.length ?? 0) > 0;
}

export function createSheetSequenceResolver(deps: SheetSequenceResolverDeps) {
  const delay = deps.delay ?? defaultDelay;
  const inFlight = new Map<string, Promise<ResolveOutcome>>();

  /** One private→public pass. Throws for transient failures (caller retries). */
  async function attempt(
    id: string
  ): Promise<
    | { sequence: SequenceData; source: "private" | "public" }
    | { terminal: "missing" | "permission" }
  > {
    let sawPermission = false;
    try {
      const own = await deps.loadPrivate(id);
      if (hasSteps(own)) return { sequence: own, source: "private" };
    } catch (error) {
      const cls = classifyResolveError(error);
      if (cls === "transient") throw error;
      if (cls === "permission") sawPermission = true;
      // "unauthorized": no identity — the public tier is all we have. Not a failure.
    }
    const pub = await deps.loadPublic(id);
    if (hasSteps(pub)) return { sequence: pub, source: "public" };
    return { terminal: sawPermission ? "permission" : "missing" };
  }

  async function resolve(id: string, signal: AbortSignal): Promise<ResolveOutcome> {
    const existing = inFlight.get(id);
    if (existing) return existing;

    const run = (async (): Promise<ResolveOutcome> => {
      await deps.awaitAuthSettled();
      let attempts = 0;
      for (;;) {
        if (signal.aborted) throw abortError();
        attempts++;
        try {
          const result = await attempt(id);
          if ("sequence" in result) {
            return { sequence: result.sequence, source: result.source, failure: null, attempts };
          }
          return { sequence: null, source: null, failure: result.terminal, attempts };
        } catch (error) {
          if (signal.aborted) throw abortError();
          const backoff = BACKOFF_MS[attempts - 1];
          if (backoff === undefined) {
            return { sequence: null, source: null, failure: "transient", attempts };
          }
          await delay(jitter(backoff), signal);
        }
      }
    })();

    const tracked = run.finally(() => inFlight.delete(id));
    inFlight.set(id, tracked);
    return tracked;
  }

  return { resolve };
}

export type SheetSequenceResolver = ReturnType<typeof createSheetSequenceResolver>;
