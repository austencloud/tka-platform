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
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { container } from "$lib/shared/di";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

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
  deviceId: string | null;
  userId: string | null;
}

class ScanActivityState {
  codes = $state<CodeEntry[]>([]);
  recentEvents = $state<ScanEventRow[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  scope = $state<"mine" | "all">("mine");
  searchQuery = $state("");

  private unsubCodes: Unsubscribe | null = null;
  private unsubEvents: Unsubscribe | null = null;
  private byCode = new Map<string, CodeEntry>();
  private decodeCache = new Map<
    string,
    { decoded: SequenceData | null; reason?: string }
  >();

  filtered = $derived.by(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.codes;
    return this.codes.filter(
      (c) => c.word.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  async subscribe(currentUserId: string | null): Promise<void> {
    this.loading = true;
    this.error = null;
    this.teardown();

    const firestore = await getFirestoreInstance();
    const encoder = container.items.sequenceEncoder as ISequenceEncoder;

    const codesRef = collection(firestore, "shortcodes");
    const codesQ =
      this.scope === "mine" && currentUserId
        ? query(codesRef, where("ownerId", "==", currentUserId))
        : query(codesRef);

    try {
      const initial = await getDocsFromServer(codesQ);
      for (const doc of initial.docs) {
        this.ingestCodeDoc(doc.id, doc.data(), encoder);
      }
      this.resort();
      this.loading = false;

      this.unsubCodes = onSnapshot(
        codesQ,
        { includeMetadataChanges: false },
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "added" || change.type === "modified") {
              this.ingestCodeDoc(change.doc.id, change.doc.data(), encoder);
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
              timestamp: data.timestamp ?? "",
              city: data.city ?? null,
              country: data.country ?? null,
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
    encoder: ISequenceEncoder
  ): void {
    const encoded: string = data.encoded ?? "";
    const entry: CodeEntry = {
      code,
      word: data.sequence ?? "",
      ownerId: data.ownerId ?? null,
      createdAt: data.createdAt ?? "",
      encoded,
      scanCount: Number(data.scanCount ?? 0),
      lastScannedAt: data.lastScannedAt ?? null,
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

    void this.decodeAsync(entry, encoded, encoder);
  }

  private async decodeAsync(
    entry: CodeEntry,
    encoded: string,
    encoder: ISequenceEncoder
  ): Promise<void> {
    try {
      const decoded = await encoder.decodeFromQR(encoded);
      this.decodeCache.set(encoded, { decoded });
      const current = this.byCode.get(entry.code);
      if (current && current.encoded === encoded) {
        current.decoded = decoded;
        current.integrityOk = true;
        this.resort();
      }
    } catch (err) {
      const reason = (err as Error).message;
      this.decodeCache.set(encoded, { decoded: null, reason });
      const current = this.byCode.get(entry.code);
      if (current && current.encoded === encoded) {
        current.decoded = null;
        current.integrityOk = false;
        current.integrityReason = reason;
        this.resort();
      }
    }
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
