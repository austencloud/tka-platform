import { Timestamp } from "firebase/firestore";

/**
 * Safely converts a Firestore Timestamp (or plain {seconds, nanoseconds} object)
 * to a JS Date. Firestore SDK sometimes returns plain objects instead of
 * Timestamp instances depending on how the data was read.
 */
export function toDate(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  const record = ts as Record<string, unknown> | null | undefined;
  if (typeof record?.toDate === 'function') return (record as { toDate: () => Date }).toDate();
  if (record?.seconds != null) return new Timestamp(record.seconds as number, (record.nanoseconds as number) ?? 0).toDate();
  return new Date(ts as string | number | Date);
}
