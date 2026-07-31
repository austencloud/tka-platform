/**
 * Orders Firestore writes for one sequence so a background save cannot land
 * after a permanent delete and silently recreate the document.
 *
 * Deletion intent remains set for the browser session. An explicit user save
 * clears it; background retry never does.
 */

const mutationTails = new Map<string, Promise<void>>();
const deletionIntents = new Set<string>();
const durableDeletionIntents = new Set<string>();
const DELETION_INTENTS_KEY = "tka-sequence-deletion-intents:v1";
let durableIntentsLoaded = false;

function loadDurableDeletionIntents(): void {
  if (durableIntentsLoaded || typeof window === "undefined") return;
  durableIntentsLoaded = true;
  try {
    const stored = JSON.parse(
      localStorage.getItem(DELETION_INTENTS_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(stored)) return;
    for (const sequenceId of stored) {
      if (typeof sequenceId !== "string" || sequenceId.length === 0) continue;
      durableDeletionIntents.add(sequenceId);
      deletionIntents.add(sequenceId);
    }
  } catch {
    // A blocked or malformed localStorage record cannot weaken this session's
    // in-memory ordering guard.
  }
}

function persistDurableDeletionIntents(): void {
  if (typeof window === "undefined") return;
  try {
    if (durableDeletionIntents.size === 0) {
      localStorage.removeItem(DELETION_INTENTS_KEY);
    } else {
      localStorage.setItem(
        DELETION_INTENTS_KEY,
        JSON.stringify([...durableDeletionIntents])
      );
    }
  } catch {
    // The repository still surfaces a failed local purge. Persistence here is
    // defense against a reload, not permission to report success.
  }
}

function settled(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => undefined,
    () => undefined
  );
}

export function isSequenceDeletionIntended(sequenceId: string): boolean {
  loadDurableDeletionIntents();
  return deletionIntents.has(sequenceId);
}

export function clearSequenceDeletionIntent(sequenceId: string): void {
  loadDurableDeletionIntents();
  deletionIntents.delete(sequenceId);
  durableDeletionIntents.delete(sequenceId);
  persistDurableDeletionIntents();
}

export function markSequenceLocalDeletionComplete(
  sequenceIds: readonly string[]
): void {
  loadDurableDeletionIntents();
  for (const sequenceId of sequenceIds) {
    durableDeletionIntents.delete(sequenceId);
  }
  persistDurableDeletionIntents();
}

export async function runSequencePersistenceMutation<T>(
  sequenceId: string,
  mutation: () => Promise<T>
): Promise<T> {
  const previous = mutationTails.get(sequenceId) ?? Promise.resolve();
  const current = previous.then(mutation, mutation);
  const tail = settled(current);
  mutationTails.set(sequenceId, tail);

  try {
    return await current;
  } finally {
    if (mutationTails.get(sequenceId) === tail) {
      mutationTails.delete(sequenceId);
    }
  }
}

export async function runSequencePermanentDeletion<T>(
  sequenceIds: readonly string[],
  deletion: () => Promise<T>
): Promise<T> {
  const ids = [...new Set(sequenceIds.filter(Boolean))];
  loadDurableDeletionIntents();
  for (const sequenceId of ids) {
    deletionIntents.add(sequenceId);
    durableDeletionIntents.add(sequenceId);
  }
  persistDurableDeletionIntents();

  const pendingWrites = ids.map(
    (sequenceId) => mutationTails.get(sequenceId) ?? Promise.resolve()
  );
  const current = Promise.all(pendingWrites.map(settled)).then(deletion);
  const tail = settled(current);
  for (const sequenceId of ids) mutationTails.set(sequenceId, tail);

  try {
    return await current;
  } finally {
    for (const sequenceId of ids) {
      if (mutationTails.get(sequenceId) === tail) {
        mutationTails.delete(sequenceId);
      }
    }
  }
}
