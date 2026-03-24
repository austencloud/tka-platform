import { Timestamp } from "firebase/firestore";

/**
 * Safely converts a Firestore Timestamp (or plain {seconds, nanoseconds} object)
 * to a JS Date. Firestore SDK sometimes returns plain objects instead of
 * Timestamp instances depending on how the data was read.
 */
export function toDate(ts: any): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts?.toDate) return ts.toDate();
  if (ts?.seconds != null) return new Timestamp(ts.seconds, ts.nanoseconds ?? 0).toDate();
  return new Date(ts);
}
