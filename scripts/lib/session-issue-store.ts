/**
 * Firestore I/O for the session triage register. All judgment lives in
 * src/lib/server/analytics/session-issue-register.ts; this file only reads
 * and writes.
 */
import { initFirestore, getAdminAuth } from "./firestore-provider.js";
import type { SessionIssue } from "../../src/lib/server/analytics/session-issue-register.js";

const ISSUES = "sessionIssues";
const META_COLLECTION = "sessionTriageMeta";
const META_ID = "state";

export interface TriageMeta {
  reviewedThrough: string;
  reviewedSessionIds: string[];
  /** uid -> human-readable alias, e.g. "nina". Hand-editable. */
  aliases: Record<string, string>;
}

/** Default look-back on a first run, when no watermark exists yet. */
const DEFAULT_LOOKBACK_DAYS = 14;

function defaultMeta(): TriageMeta {
  return {
    reviewedThrough: new Date(
      Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
    reviewedSessionIds: [],
    aliases: {},
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getDb(): Promise<any> {
  const { db } = (await initFirestore()) as any;
  return db;
}

export async function loadMeta(): Promise<TriageMeta> {
  const db = await getDb();
  const snap = await db.collection(META_COLLECTION).doc(META_ID).get();
  if (!snap.exists) return defaultMeta();
  return { ...defaultMeta(), ...(snap.data() as Partial<TriageMeta>) };
}

export async function saveMeta(meta: TriageMeta): Promise<void> {
  const db = await getDb();
  await db.collection(META_COLLECTION).doc(META_ID).set(meta, { merge: true });
}

export async function loadIssues(): Promise<SessionIssue[]> {
  const db = await getDb();
  const snap = await db.collection(ISSUES).get();
  return snap.docs.map((d: any) => ({ ...(d.data() as SessionIssue), id: d.id }));
}

export async function saveIssue(issue: SessionIssue): Promise<void> {
  const db = await getDb();
  const { id, ...rest } = issue;
  await db.collection(ISSUES).doc(id).set(rest, { merge: true });
}

export async function deleteIssue(id: string): Promise<void> {
  const db = await getDb();
  await db.collection(ISSUES).doc(id).delete();
}

/** Next sequential id, e.g. ISS-004. */
export async function nextIssueId(): Promise<string> {
  const issues = await loadIssues();
  const max = issues.reduce((m, i) => {
    const n = Number(i.id.replace("ISS-", ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `ISS-${String(max + 1).padStart(3, "0")}`;
}

/**
 * uid -> display name via Firebase Auth, falling back to a stable coined alias
 * for guests. A hand-set alias always wins. Never stores or returns email.
 */
export async function resolveDisplayNames(
  uids: readonly string[],
  aliases: Record<string, string>
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const auth = await getAdminAuth();

  for (const uid of uids) {
    if (aliases[uid]) {
      out[uid] = aliases[uid];
      continue;
    }
    let name: string | null = null;
    if (auth) {
      try {
        const rec = await (auth as any).getUser(uid);
        name = rec.displayName ?? null;
      } catch {
        name = null; // guest, anonymous, or deleted account
      }
    }
    out[uid] = name ?? `guest-${uid.slice(0, 4).toLowerCase()}`;
  }
  return out;
}
