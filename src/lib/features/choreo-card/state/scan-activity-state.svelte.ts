// src/lib/features/choreo-card/state/scan-activity-state.svelte.ts
/**
 * Scan Activity state.
 *
 * Holds the live list of codes sorted by most-recent scan activity, plus
 * derived stats for the header and minimap panels. Subscribes to Firestore
 * for incremental updates and maintains a ring buffer of the last 100 scan
 * events for the minimap recents list.
 */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { decodeSequenceFromQR } from "$lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface CodeEntry {
  code: string;
  word: string;
  ownerId: string | null;
  createdAt: string;
  encoded: string;
  scanCount: number;
  lastScannedAt: string | null;
  lastCity: string | null;
  lastCountry: string | null;
  decoded: SequenceData | null;
  integrityOk: boolean;
  integrityReason?: string;
}

export interface ScanEventRow {
  code: string;
  timestamp: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  deviceId: string | null;
  userId: string | null;
}

/** A scan pin for GlobalUserMap's scanMarkers prop. */
export interface ScanMapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  styleClass: "pin" | "pin-new";
}

function toFiniteOrNull(val: unknown): number | null {
  const n = typeof val === "string" ? Number.parseFloat(val) : (val as number);
  return Number.isFinite(n) ? (n as number) : null;
}

/**
 * Build scan-origin pins from recent events. Pure so it can be unit-tested
 * without the reactive singleton. Only events with finite lat/lng are plotted;
 * the newest located event becomes the pulsing "pin-new". `wordFor` resolves a
 * human label for a code (falls back to the code itself).
 */
export function buildScanMapPins(
  events: ScanEventRow[],
  wordFor?: (code: string) => string | undefined
): ScanMapPin[] {
  const pins: ScanMapPin[] = [];
  events.forEach((e, i) => {
    if (e.lat === null || e.lng === null) return;
    const place = e.city ?? e.country ?? "";
    pins.push({
      id: `${e.code}-${e.timestamp}`,
      lat: e.lat,
      lng: e.lng,
      label: `${wordFor?.(e.code) || e.code}${place ? ` · ${place}` : ""}`,
      styleClass: i === 0 ? "pin-new" : "pin",
    });
  });
  return pins;
}

function toISOString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (typeof (val as { toDate?: unknown }).toDate === "function")
    return (val as { toDate: () => Date }).toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

class ScanActivityState {
  codes = $state<CodeEntry[]>([]);
  recentEvents = $state<ScanEventRow[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  scope = $state<"mine" | "all">("mine");

  private unsubCodes: Unsubscribe | null = null;
  private unsubEvents: Unsubscribe | null = null;
  private byCode = new Map<string, CodeEntry>();
  private decodeCache = new Map<
    string,
    { decoded: SequenceData | null; reason?: string }
  >();
  private authorCache = new Map<string, { displayName: string; avatarUrl?: string }>();
  private authorInflight = new Map<string, Promise<{ displayName: string; avatarUrl?: string }>>();

  /**
   * Scan-origin pins for GlobalUserMap — recent events that carry finite
   * coordinates. Events without lat/lng (pre-Cloudflare-headers, dev/localhost)
   * are excluded here and surfaced only as a count, never plotted at a fake
   * position. Newest located scan renders as the pulsing "pin-new".
   */
  mapPins = $derived(
    buildScanMapPins(this.recentEvents, (code) => this.byCode.get(code)?.word)
  );

  locatedCount = $derived(this.mapPins.length);

  async subscribe(currentUserId: string | null, isAdmin: boolean): Promise<void> {
    this.loading = true;
    this.error = null;
    this.teardown();

    const firestore = await getFirestoreInstance();

    const codesRef = collection(firestore, "shortcodes");
    const codesQ =
      this.scope === "mine" && currentUserId
        ? query(codesRef, where("ownerId", "==", currentUserId))
        : query(codesRef);

    try {
      const initial = await getDocsFromServer(codesQ);
      for (const doc of initial.docs) {
        this.ingestCodeDoc(doc.id, doc.data());
      }
      this.resort();
      this.loading = false;

      this.unsubCodes = onSnapshot(
        codesQ,
        { includeMetadataChanges: false },
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "added" || change.type === "modified") {
              this.ingestCodeDoc(change.doc.id, change.doc.data());
            } else if (change.type === "removed") {
              this.byCode.delete(change.doc.id);
            }
          }
          this.resort();
        },
        (err) => {
          this.error = err.message;
        }
      );

      // The scanEvents collectionGroup is admin-only (firestore.rules). Reading
      // it before the admin claim resolves surfaces a "Missing or insufficient
      // permissions" error. Only subscribe for confirmed admins; non-admins get
      // an empty live feed instead of a red error.
      if (!isAdmin) return;

      const eventsQ = query(
        collectionGroup(firestore, "scanEvents"),
        orderBy("timestamp", "desc"),
        limit(100)
      );

      this.unsubEvents = onSnapshot(
        eventsQ,
        (snap) => {
          const rows: ScanEventRow[] = [];
          for (const d of snap.docs) {
            const path = d.ref.path;
            const match = path.match(/^shortcodes\/([^/]+)\/scanEvents\//);
            const code = match?.[1] ?? "?";
            const data = d.data();
            rows.push({
              code,
              timestamp: toISOString(data.timestamp) ?? "",
              city: data.city ?? null,
              country: data.country ?? null,
              lat: toFiniteOrNull(data.lat),
              lng: toFiniteOrNull(data.lng),
              deviceId: data.deviceId ?? null,
              userId: data.userId ?? null,
            });
          }
          this.recentEvents = rows;
        },
        (err) => {
          this.error = err.message;
        }
      );
    } catch (err) {
      this.error = (err as Error).message;
      this.loading = false;
    }
  }

  teardown(): void {
    this.unsubCodes?.();
    this.unsubEvents?.();
    this.unsubCodes = null;
    this.unsubEvents = null;
    this.byCode.clear();
    this.codes = [];
    this.recentEvents = [];
  }

  private ingestCodeDoc(
    code: string,
    data: DocumentData,
  ): void {
    const encoded: string = data.encoded ?? "";
    const entry: CodeEntry = {
      code,
      word: data.sequence ?? "",
      ownerId: data.ownerId ?? null,
      createdAt: toISOString(data.createdAt) ?? "",
      encoded,
      scanCount: Number(data.scanCount ?? 0),
      lastScannedAt: toISOString(data.lastScannedAt) ?? null,
      lastCity: data.lastCity ?? null,
      lastCountry: data.lastCountry ?? null,
      decoded: null,
      integrityOk: true,
    };
    this.byCode.set(code, entry);

    if (!encoded) {
      entry.integrityOk = false;
      entry.integrityReason = "no encoded blob";
      return;
    }

    const cached = this.decodeCache.get(encoded);
    if (cached) {
      entry.decoded = cached.decoded;
      entry.integrityOk = cached.decoded !== null;
      entry.integrityReason = cached.reason;
      return;
    }

    void this.decodeAsync(entry, encoded);
  }

  private async decodeAsync(
    entry: CodeEntry,
    encoded: string,
  ): Promise<void> {
    try {
      const decoded = await decodeSequenceFromQR(encoded);
      const enriched = await this.enrichDecoded(decoded, entry);
      this.decodeCache.set(encoded, { decoded: enriched });
      const current = this.byCode.get(entry.code);
      if (current?.encoded === encoded) {
        current.decoded = enriched;
        current.integrityOk = true;
        this.resort();
      }
    } catch (err) {
      const reason = (err as Error).message;
      this.decodeCache.set(encoded, { decoded: null, reason });
      const current = this.byCode.get(entry.code);
      if (current?.encoded === encoded) {
        current.decoded = null;
        current.integrityOk = false;
        current.integrityReason = reason;
        this.resort();
      }
    }
  }

  /**
   * Merge metadata from the shortcode doc + user profile onto the decoded
   * sequence. The encoded blob itself carries steps only - word, author, and
   * owner id live on the shortcode doc / user profile.
   */
  private async enrichDecoded(
    decoded: SequenceData,
    entry: CodeEntry
  ): Promise<SequenceData> {
    const author = entry.ownerId
      ? await this.lookupAuthor(entry.ownerId)
      : null;
    return {
      ...decoded,
      word: entry.word || decoded.word,
      name: entry.word || decoded.name,
      ownerId: entry.ownerId ?? decoded.ownerId,
      author: author?.displayName ?? decoded.author,
      displayName: entry.word || decoded.displayName,
    } as SequenceData;
  }

  private async lookupAuthor(
    ownerId: string
  ): Promise<{ displayName: string; avatarUrl?: string }> {
    const cached = this.authorCache.get(ownerId);
    if (cached) return cached;
    const inflight = this.authorInflight.get(ownerId);
    if (inflight) return inflight;

    const p = (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const snap = await getDoc(doc(firestore, "users", ownerId));
        const data = snap.data() ?? {};
        const result = {
          displayName: (data["displayName"] as string) ?? "Unknown",
          avatarUrl: data["photoURL"] as string | undefined,
        };
        this.authorCache.set(ownerId, result);
        return result;
      } catch {
        const fallback = { displayName: "Unknown" };
        this.authorCache.set(ownerId, fallback);
        return fallback;
      } finally {
        this.authorInflight.delete(ownerId);
      }
    })();
    this.authorInflight.set(ownerId, p);
    return p;
  }

  private resort(): void {
    const arr = Array.from(this.byCode.values());
    arr.sort((a, b) => {
      const ta = a.lastScannedAt ?? a.createdAt;
      const tb = b.lastScannedAt ?? b.createdAt;
      return tb.localeCompare(ta);
    });
    this.codes = arr;
  }
}

export const scanActivityState = new ScanActivityState();
