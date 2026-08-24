import { browser } from "$app/environment";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "$lib/shared/auth/firebase";
import { authedFetch } from "$lib/shared/auth/services/authed-fetch";
import type {
  LifecycleEventEnvelope,
  LifecycleEventInput,
} from "../domain/lifecycle-event";
import {
  deferLifecycleEvent,
  dueLifecycleEvents,
  enqueueLifecycleEvent,
  getLifecycleOutboxStorage,
  readLifecycleOutbox,
  removeLifecycleEvent,
} from "./posthog-lifecycle-outbox";
import { getCurrentPostHogSessionId } from "./posthog";

const LIFECYCLE_ENDPOINT = "/api/rune/lifecycle";

let initialized = false;
let flushPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function deliver(entry: {
  envelope: LifecycleEventEnvelope;
  sessionId: string | null;
}): Promise<boolean> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (entry.sessionId) {
    headers.set("X-PostHog-Session-ID", entry.sessionId);
  }
  try {
    const response = await authedFetch(LIFECYCLE_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(entry.envelope),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function scheduleNextFlush(ownerUid: string): void {
  if (!browser || retryTimer !== null) return;
  const now = Date.now();
  const nextAttempt = readLifecycleOutbox()
    .filter((entry) => entry.ownerUid === ownerUid)
    .reduce(
      (earliest, entry) => Math.min(earliest, entry.nextAttemptAt),
      Number.POSITIVE_INFINITY
    );
  if (!Number.isFinite(nextAttempt)) return;
  retryTimer = setTimeout(
    () => {
      retryTimer = null;
      void flushPostHogLifecycleOutbox();
    },
    Math.max(0, nextAttempt - now)
  );
}

export function flushPostHogLifecycleOutbox(): Promise<void> {
  if (flushPromise) return flushPromise;
  const ownerUid = auth.currentUser?.uid;
  if (!ownerUid) return Promise.resolve();

  flushPromise = (async () => {
    const storage = getLifecycleOutboxStorage();
    for (const entry of dueLifecycleEvents(ownerUid, storage)) {
      if (await deliver(entry)) {
        removeLifecycleEvent(entry.envelope.eventId, storage);
      } else {
        deferLifecycleEvent(entry.envelope.eventId, storage);
      }
    }
  })().finally(() => {
    flushPromise = null;
    scheduleNextFlush(ownerUid);
  });
  return flushPromise;
}

/** Install wake-up hooks once; safe to call during every app bootstrap. */
export function initializePostHogLifecycleReporter(): void {
  if (!browser || initialized) return;
  initialized = true;
  window.addEventListener("online", () => {
    void flushPostHogLifecycleOutbox();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void flushPostHogLifecycleOutbox();
    }
  });
  onAuthStateChanged(auth, (user) => {
    if (user) void flushPostHogLifecycleOutbox();
  });
}

/**
 * Persist a completed product milestone before attempting delivery. The UUID,
 * timestamp, and replay session survive retries and browser restarts, while
 * ownerUid prevents a later account on the device from claiming the event.
 */
export async function reportPostHogLifecycleEvent(
  input: LifecycleEventInput
): Promise<void> {
  initializePostHogLifecycleReporter();
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const ownerUid = auth.currentUser?.uid;
  if (!ownerUid) {
    throw new Error("Lifecycle event has no authenticated owner");
  }

  const envelope: LifecycleEventEnvelope = {
    ...input,
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  } as LifecycleEventEnvelope;
  const sessionId = await getCurrentPostHogSessionId().catch(() => null);
  enqueueLifecycleEvent({ ownerUid, envelope, sessionId });
  await flushPostHogLifecycleOutbox();
}
