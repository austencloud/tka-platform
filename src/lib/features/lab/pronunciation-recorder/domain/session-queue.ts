// src/lib/features/lab/pronunciation-recorder/domain/session-queue.ts
/** How far down a failed word is reinserted, in words. */
export const REQUEUE_DISTANCE = 8;
/** Attempts before a word is retired to the end-of-session report. */
export const MAX_ATTEMPTS = 3;

export interface SessionQueue {
  readonly current: string | null;
  readonly next: string | null;
  readonly completed: number;
  readonly remaining: number;
  readonly retired: readonly string[];
  accept(): void;
  requeue(): void;
}

/**
 * The word order, and what happens when a read fails.
 *
 * Failure never interrupts: the word goes back into the list further down and
 * the session moves on, which is what makes "press start and talk" literally
 * true. Three failures retire it to a report he reads afterwards.
 */
export function createSessionQueue(words: readonly string[]): SessionQueue {
  const pending = [...words];
  const attempts = new Map<string, number>();
  const retired: string[] = [];
  let completed = 0;

  return {
    get current() {
      return pending[0] ?? null;
    },
    get next() {
      return pending[1] ?? null;
    },
    get completed() {
      return completed;
    },
    get remaining() {
      return pending.length;
    },
    get retired() {
      return retired;
    },

    accept() {
      if (pending.length === 0) return;
      pending.shift();
      completed++;
    },

    requeue() {
      const word = pending.shift();
      if (word === undefined) return;

      const attempted = (attempts.get(word) ?? 0) + 1;
      attempts.set(word, attempted);
      if (attempted >= MAX_ATTEMPTS) {
        retired.push(word);
        return;
      }

      pending.splice(Math.min(REQUEUE_DISTANCE - 1, pending.length), 0, word);
    },
  };
}
