import {
  LifecycleEventEnvelopeSchema,
  type LifecycleEventEnvelope,
} from "../domain/lifecycle-event";

const STORAGE_KEY = "tka:analytics:lifecycle-outbox:v1";
const MAX_ENTRIES = 50;
const ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_RETRY_MS = 60 * 60 * 1_000;

export interface LifecycleOutboxEntry {
  ownerUid: string;
  envelope: LifecycleEventEnvelope;
  sessionId: string | null;
  attempts: number;
  nextAttemptAt: number;
  expiresAt: number;
}

export interface LifecycleOutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let memoryValue: string | null = null;
const memoryStorage: LifecycleOutboxStorage = {
  getItem: () => memoryValue,
  setItem: (_key, value) => {
    memoryValue = value;
  },
};

export function getLifecycleOutboxStorage(): LifecycleOutboxStorage {
  return typeof localStorage === "undefined" ? memoryStorage : localStorage;
}

function isEntry(value: unknown): value is LifecycleOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LifecycleOutboxEntry>;
  return (
    typeof entry.ownerUid === "string" &&
    entry.ownerUid.length > 0 &&
    LifecycleEventEnvelopeSchema.safeParse(entry.envelope).success &&
    (entry.sessionId === null || typeof entry.sessionId === "string") &&
    typeof entry.attempts === "number" &&
    typeof entry.nextAttemptAt === "number" &&
    typeof entry.expiresAt === "number"
  );
}

export function readLifecycleOutbox(
  storage: LifecycleOutboxStorage = getLifecycleOutboxStorage(),
  now = Date.now()
): LifecycleOutboxEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).filter((entry) => entry.expiresAt > now);
  } catch {
    return [];
  }
}

function writeLifecycleOutbox(
  entries: LifecycleOutboxEntry[],
  storage: LifecycleOutboxStorage
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

export function enqueueLifecycleEvent(
  input: Omit<LifecycleOutboxEntry, "attempts" | "nextAttemptAt" | "expiresAt">,
  storage: LifecycleOutboxStorage = getLifecycleOutboxStorage(),
  now = Date.now()
): void {
  const entries = readLifecycleOutbox(storage, now).filter(
    (entry) => entry.envelope.eventId !== input.envelope.eventId
  );
  entries.push({
    ...input,
    attempts: 0,
    nextAttemptAt: now,
    expiresAt: now + ENTRY_TTL_MS,
  });
  writeLifecycleOutbox(entries, storage);
}

export function dueLifecycleEvents(
  ownerUid: string,
  storage: LifecycleOutboxStorage = getLifecycleOutboxStorage(),
  now = Date.now()
): LifecycleOutboxEntry[] {
  return readLifecycleOutbox(storage, now).filter(
    (entry) => entry.ownerUid === ownerUid && entry.nextAttemptAt <= now
  );
}

export function removeLifecycleEvent(
  eventId: string,
  storage: LifecycleOutboxStorage = getLifecycleOutboxStorage(),
  now = Date.now()
): void {
  writeLifecycleOutbox(
    readLifecycleOutbox(storage, now).filter(
      (entry) => entry.envelope.eventId !== eventId
    ),
    storage
  );
}

export function deferLifecycleEvent(
  eventId: string,
  storage: LifecycleOutboxStorage = getLifecycleOutboxStorage(),
  now = Date.now()
): void {
  const entries = readLifecycleOutbox(storage, now).map((entry) => {
    if (entry.envelope.eventId !== eventId) return entry;
    const attempts = entry.attempts + 1;
    return {
      ...entry,
      attempts,
      nextAttemptAt:
        now + Math.min(5_000 * Math.pow(2, attempts - 1), MAX_RETRY_MS),
    };
  });
  writeLifecycleOutbox(entries, storage);
}

export function resetLifecycleOutboxForTests(): void {
  memoryValue = null;
}
