/**
 * Ordered, session-guarded mutation queue for a user's own map location.
 *
 * This module has no Svelte import on purpose. Ordering, supersession, session
 * cancellation, and serialization are where every defect found across four
 * review rounds of the community-map design actually lived, so they are plain
 * functions that can be tested with individually controlled promises rather
 * than through a reactive wrapper.
 *
 * Two invariants carry the whole design:
 *
 * 1. **Intent numbers are stamped at the user gesture**, before any geocoding,
 *    Places lookup, or other asynchronous canonicalization. Stamping at enqueue
 *    time instead is a real bug with a concrete failure: a picker selection
 *    begins `fetchFields()`, the user then presses Remove, `fetchFields()`
 *    resolves afterward and enqueues with a *newer* number than the Remove it
 *    lost the race to, and the user is put back on the map after removing
 *    themselves. Ordering has to represent what the user did and when.
 *
 * 2. **Cancellation only covers work that has not been issued.** Once a write
 *    has been handed to Firestore it may commit, and signing out does not
 *    retract an auth token already attached to an in-flight request. The queue
 *    does not pretend otherwise; callers treat an issued write as potentially
 *    committed and reload authoritative state after a session change.
 */

export type MutationKind = "add" | "remove";

/**
 * A stamped user gesture. Created by {@link LocationMutationQueue.beginIntent}
 * at the moment the user acts, then carried through any asynchronous
 * preparation and handed back to `submit`.
 */
export interface MutationIntent {
  readonly intent: number;
  readonly kind: MutationKind;
  readonly uid: string;
  readonly generation: number;
}

export type MutationOutcome =
  /** The write was issued and Firestore accepted it. */
  | { status: "applied"; intent: number }
  /** A newer user gesture replaced this one before it could be issued. */
  | { status: "superseded"; intent: number }
  /** The uid or the session changed before this one could be issued. */
  | { status: "cancelled"; intent: number }
  /** The write was issued and failed, or preparation threw. */
  | { status: "failed"; intent: number; error: unknown };

export interface LocationMutationQueue {
  /**
   * Stamp an intent. Call this synchronously in the gesture handler, before
   * awaiting anything. It immediately supersedes every earlier unissued
   * intent, which is what makes a later gesture win a race against an earlier
   * gesture's slow canonicalization.
   */
  beginIntent(kind: MutationKind): MutationIntent;

  /**
   * Run `write` when it reaches the front of the queue, unless a newer intent
   * or a session change has made it obsolete first. Never rejects: every path
   * resolves to a {@link MutationOutcome}.
   *
   * Pass the same {@link MutationIntent} when retrying. A retry is the same
   * user decision, so it keeps its original position in the ordering; drawing
   * a fresh intent for a retry would let an automatic retry outrank a real
   * later gesture.
   */
  submit(intent: MutationIntent, write: () => Promise<void>): Promise<MutationOutcome>;

  /**
   * Bump the session generation, cancelling every intent that has not yet been
   * issued. Call on sign-out, sign-in, and uid change — the boundary is the
   * session, so signing out and back in as the same uid still cancels.
   *
   * This does not and cannot cancel a write already handed to Firestore.
   */
  invalidateSession(): void;

  /** The most recently stamped intent number. */
  readonly latestIntent: number;

  /** The current session generation. */
  readonly generation: number;
}

export interface LocationMutationQueueOptions {
  /**
   * The uid the queue considers live, read at the moment of the write. A
   * mismatch against the intent's captured uid cancels it.
   */
  getLiveUid: () => string | null;
}

export function createLocationMutationQueue(
  options: LocationMutationQueueOptions,
): LocationMutationQueue {
  const { getLiveUid } = options;

  let latestIntent = 0;
  let generation = 0;

  /**
   * Serializes execution so two writes for one user are never in flight at
   * once. Errors are swallowed into the chain itself, never into the caller's
   * result, so one failed mutation cannot stall or reject every later one.
   */
  let tail: Promise<void> = Promise.resolve();

  async function runOne(
    intent: MutationIntent,
    write: () => Promise<void>,
  ): Promise<MutationOutcome> {
    // Everything from here to the `write()` call is one synchronous run. No
    // await may be introduced between the guards and the invocation: that gap
    // is exactly where a sign-out could slip in and let a write go out under an
    // identity that is no longer current.
    if (intent.intent !== latestIntent) {
      return { status: "superseded", intent: intent.intent };
    }
    if (intent.generation !== generation || intent.uid !== getLiveUid()) {
      return { status: "cancelled", intent: intent.intent };
    }

    let issued: Promise<void>;
    try {
      issued = write();
    } catch (error) {
      // A synchronous throw from `write` itself, before any request went out.
      return { status: "failed", intent: intent.intent, error };
    }

    // Past this point the request exists. A later `invalidateSession()` cannot
    // recall it, and the outcome reflects what Firestore actually did.
    try {
      await issued;
      return { status: "applied", intent: intent.intent };
    } catch (error) {
      return { status: "failed", intent: intent.intent, error };
    }
  }

  return {
    beginIntent(kind) {
      latestIntent += 1;
      return {
        intent: latestIntent,
        kind,
        uid: getLiveUid() ?? "",
        generation,
      };
    },

    submit(intent, write) {
      const outcome = tail.then(() => runOne(intent, write));
      tail = outcome.then(
        () => undefined,
        () => undefined,
      );
      return outcome;
    },

    invalidateSession() {
      generation += 1;
    },

    get latestIntent() {
      return latestIntent;
    },

    get generation() {
      return generation;
    },
  };
}
