/**
 * Short Code Manager Implementation
 *
 * Manages short codes for QR code URLs using Firebase Firestore.
 * Short codes are 4-character base36 uppercase strings (auto-bumping
 * to 5/6) that map to encoded sequence data for compact QR codes.
 *
 * Firebase collection: shortcodes
 *
 * Domain: QR - URL Shortening
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  type SequenceData,
  createSequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import {
  encodeSequenceForQR,
  isInlineEncoded,
  decodeSequenceFromQR,
} from "$lib/shared/navigation/services/sequence-encoder";
import type { PublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/services/implementations/PublicSequenceHashMatcher";
import type { ShortCodeRecord, CreateShortCodeResult, ShortCodeURLOptions } from "./types";

const SHORTCODES_COLLECTION = "shortcodes";
const MIN_CODE_LENGTH = 4;

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Shape of a short code record from Firestore or the static snapshot */
interface ShortCodeData {
  sequence: string;
  sequenceId?: string;
  ownerId?: string;
  encoderHash?: string;
  createdAt: string;
  createdBy: string;
  scanCount: number;
  sequenceData?: Record<string, unknown>;
  /** Self-contained "s~..." blob from SequenceEncoder.encodeForQR.
   *  When present, the resolver can decode the sequence without any
   *  cross-collection lookups - the primary path for static snapshot fallback. */
  encoded?: string;
}

export class ShortCodeManager {
  private firestore: Firestore | null = null;
  private staticSnapshotCache: Map<string, ShortCodeData> | null = null;
  /** In-flight single-flight cache keyed by encoderHash (or fallback id when
   *  a sequence has no steps). Prevents simultaneous calls for the same
   *  sequence - e.g. QRCodeGenerator and SequenceViewerOverlayState both
   *  requesting a shortcode for the current sequence at the same time -
   *  from racing past the `findExistingCodeByHash` check and writing two
   *  docs with identical encoderHash. Observed live 2026-04-19: same hash,
   *  1ms apart, two codes. The cache reduces Firestore pressure even when
   *  no race is present (second caller just returns the first's promise). */
  private readonly inflightByKey = new Map<string, Promise<CreateShortCodeResult>>();

  constructor(
    private readonly browseLoader: PublicSequencesLoader,
    private readonly hashMatcher?: PublicSequenceHashMatcher
  ) {}

  /**
   * Initialize Firestore instance (called lazily)
   */
  private async ensureFirestore(): Promise<Firestore> {
    if (!this.firestore) {
      this.firestore = await getFirestoreInstance();
    }
    return this.firestore;
  }

  /**
   * Generate a random short code
   */
  private codeLength = MIN_CODE_LENGTH;

  private generateCode(): string {
    let code = "";
    for (let i = 0; i < this.codeLength; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
  }

  /**
   * Get the base URL for short code URLs
   */
  private getBaseUrl(): string {
    return "HTTPS://TKA.RUN";
  }

  /**
   * Build URL with optional prop type query params.
   * Props are encoded as single characters (bp=S for blue staff, rp=F for red fan).
   */
  private buildUrlWithOptions(baseUrl: string, code: string, options?: ShortCodeURLOptions): string {
    let url = `${baseUrl}/${code}`;

    const params = new URLSearchParams();
    if (options?.bluePropType) {
      params.set("bp", options.bluePropType);
    }
    if (options?.redPropType) {
      params.set("rp", options.redPropType);
    }
    if (options?.viewMode) {
      params.set("vm", options.viewMode);
    }

    const query = params.toString();
    if (query) {
      url += `?${query}`;
    }

    return url;
  }

  async createShortCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult> {
    // Compute encoderHash for content-based dedup. Two sequences with the
    // same motions always produce the same hash, regardless of word or owner.
    // Falls back to word-based lookup for sequences without steps (legacy).
    let encoderHash: string | undefined;
    if (this.hashMatcher && sequence.steps && sequence.steps.length > 0) {
      try {
        encoderHash = await this.hashMatcher.computeEncoderHash(sequence);
      } catch {
        // Fall through to word-based
      }
    }

    const fallbackId = sequence.word || sequence.name || sequence.id;
    if (!encoderHash && !fallbackId) {
      throw new Error("Sequence must have steps, word, name, or id for short code generation");
    }

    // Single-flight dedup key. Two concurrent calls in the same tab for the
    // same sequence will share one Firestore round-trip and one promise.
    // Scope: options?.embedSequenceData affects the doc shape, so calls
    // with different embed flags MUST NOT share a promise (otherwise one
    // caller gets a doc shaped for the other's use case).
    const embedScope = options?.embedSequenceData ? "embed" : "lean";
    const dedupKey = `${embedScope}:${encoderHash ?? `w:${fallbackId}`}`;

    const inflight = this.inflightByKey.get(dedupKey);
    if (inflight) return inflight;

    const promise = this.createShortCodeInternal(
      sequence,
      options,
      encoderHash,
      fallbackId
    );
    this.inflightByKey.set(dedupKey, promise);
    try {
      return await promise;
    } finally {
      this.inflightByKey.delete(dedupKey);
    }
  }

  private async createShortCodeInternal(
    sequence: SequenceData,
    options: ShortCodeURLOptions | undefined,
    encoderHash: string | undefined,
    fallbackId: string | undefined
  ): Promise<CreateShortCodeResult> {
    const firestore = await this.ensureFirestore();

    // Check if this sequence already has a short code (by hash or word).
    // This is the legacy-dedup path - it catches codes created before the
    // single-flight cache existed, and codes written by OTHER tabs/devices.
    const existingCode = encoderHash
      ? await this.findExistingCodeByHash(encoderHash)
      : await this.findExistingCode(fallbackId!);
    if (existingCode) {
      // Backfill ownerId and sequenceId on legacy records that lack them.
      // Without these, the resolver can't load unpublished sequences directly.
      if (sequence.ownerId || sequence.id) {
        const existingRef = doc(firestore, SHORTCODES_COLLECTION, existingCode);
        const existingSnap = await getDoc(existingRef);
        if (existingSnap.exists()) {
          const existingData = existingSnap.data();
          const updates: Record<string, unknown> = {};
          if (!existingData.ownerId && sequence.ownerId) updates.ownerId = sequence.ownerId;
          if (!existingData.sequenceId && sequence.id) updates.sequenceId = sequence.id;
          if (Object.keys(updates).length > 0) {
            await updateDoc(existingRef, updates).catch(() => {});
          }
        }
      }
      return {
        code: existingCode,
        url: this.buildUrlWithOptions(this.getBaseUrl(), existingCode, options),
        isNew: false,
      };
    }

    // Build the full record once. Encoding is expensive - don't redo it per
    // collision-retry attempt.
    const record: Record<string, unknown> = {
      sequence: fallbackId || "",
      createdAt: new Date().toISOString(),
      createdBy: "system",
      scanCount: 0,
      sequenceName: sequence.word || sequence.name || "",
    };
    if (sequence.id) record.sequenceId = sequence.id;
    if (sequence.ownerId) record.ownerId = sequence.ownerId;
    if (encoderHash) record.encoderHash = encoderHash;
    if (options?.deckId) record.deckId = options.deckId;
    if (options?.deckName) record.deckName = options.deckName;

    const shouldEmbed = options?.embedSequenceData || !sequence.ownerId;
    if (shouldEmbed && sequence.steps && sequence.steps.length > 0) {
      const seqData: Record<string, unknown> = { steps: sequence.steps };
      if (sequence.word != null) seqData.word = sequence.word;
      if (sequence.startPosition != null) seqData.startPosition = sequence.startPosition;
      if (sequence.gridMode != null) seqData.gridMode = sequence.gridMode;
      if (sequence.isCircular != null) seqData.isCircular = sequence.isCircular;
      if (sequence.loopType != null) seqData.loopType = sequence.loopType;
      record.sequenceData = JSON.parse(JSON.stringify(seqData));
    }

    if (sequence.steps && sequence.steps.length > 0) {
      record.encoded = await encodeSequenceForQR(sequence);
    }

    if (!record.encoded && !record.sequenceData) {
      throw new Error(
        `[ShortCode] Refusing to create a shortcode without encoded blob or embedded sequenceData - would produce an unresolvable zombie document.`
      );
    }

    // Allocate a unique code. The `getDoc → setDoc` sequence used to race:
    // two tabs could both observe "doc doesn't exist" for the SAME random
    // code (astronomically rare) OR, more importantly, both observe "hash
    // doesn't exist" and each write their own code. runTransaction
    // serializes the check-and-write so at most one writer wins per doc
    // path. Cross-tab hash races are still theoretically possible but the
    // loser reads their code back on next createShortCode via the legacy
    // findExistingCodeByHash path above.
    const maxAttemptsPerLength = 10;
    const maxCodeLength = MIN_CODE_LENGTH + 2;

    while (this.codeLength <= maxCodeLength) {
      for (let attempts = 0; attempts < maxAttemptsPerLength; attempts++) {
        const code = this.generateCode();
        const docRef = doc(firestore, SHORTCODES_COLLECTION, code);

        try {
          await runTransaction(firestore, async (tx) => {
            const snap = await tx.get(docRef);
            if (snap.exists()) {
              throw new Error("__CODE_COLLISION__");
            }
            tx.set(docRef, record);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "__CODE_COLLISION__") continue;
          throw err;
        }

        return {
          code,
          url: this.buildUrlWithOptions(this.getBaseUrl(), code, options),
          isNew: true,
        };
      }

      this.codeLength++;
      console.warn(`[ShortCode] Exhausted ${maxAttemptsPerLength} attempts at length ${this.codeLength - 1}, bumping to ${this.codeLength}`);
    }

    throw new Error("Failed to generate unique short code after exhausting all length tiers");
  }

  /**
   * Create an offline-capable code for a sequence.
   * Embeds all sequence data in the URL, no Firebase lookup needed.
   */
  async createOfflineCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult> {
    const code = await encodeSequenceForQR(sequence);
    return {
      code,
      url: this.buildUrlWithOptions(this.getBaseUrl(), code, options),
      isNew: true, // Offline codes are always "new" (not stored)
    };
  }

  /**
   * Find an existing short code by word/name (legacy fallback)
   */
  private async findExistingCode(encoded: string): Promise<string | null> {
    const firestore = await this.ensureFirestore();
    const q = query(
      collection(firestore, SHORTCODES_COLLECTION),
      where("sequence", "==", encoded)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0]!.id;
    }

    return null;
  }

  /**
   * Find an existing short code by encoderHash (content-addressed)
   */
  private async findExistingCodeByHash(hash: string): Promise<string | null> {
    const firestore = await this.ensureFirestore();
    const q = query(
      collection(firestore, SHORTCODES_COLLECTION),
      where("encoderHash", "==", hash)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0]!.id;
    }

    return null;
  }

  async resolveShortCode(code: string): Promise<SequenceData | null> {
    // Check if this is an inline-encoded offline code (s~...)
    if (isInlineEncoded(code)) {
      try {
        // Decode directly - no Firebase needed, works offline!
        return await decodeSequenceFromQR(code);
      } catch (error) {
        console.error("Failed to decode inline sequence:", error);
        return null;
      }
    }

    // Try Firebase first, fall back to static snapshot if Firebase is unreachable.
    // The static snapshot is a JSON file generated by scripts/export-static-snapshot.cjs
    // and deployed with the site. If Firebase ever shuts down, every QR code still works.
    let data: ShortCodeData | null = null;
    try {
      data = await this.resolveFromFirestore(code);
    } catch (error) {
      console.warn(`[ShortCode] Firebase unavailable for "${code}", trying static fallback:`, error);
    }

    if (!data) {
      data = await this.resolveFromStaticSnapshot(code);
    }

    if (!data) {
      console.error(`[ShortCode] ✗ Code "${code}" not found in Firebase or static snapshot`);
      return null;
    }

    return this.hydrateFromRecord(code, data);
  }

  /**
   * Look up a short code record from Firestore (primary path).
   * Returns null if the document doesn't exist. Throws on network/auth errors
   * so the caller can fall back to the static snapshot.
   */
  private async resolveFromFirestore(code: string): Promise<ShortCodeData | null> {
    const firestore = await this.ensureFirestore();
    const docRef = doc(firestore, SHORTCODES_COLLECTION, code);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data() as ShortCodeData;
  }

  /**
   * Look up a short code from the static JSON snapshot. Two-layer fallback:
   *
   *   1. R2 CDN (`snapshots/shortcodes-v2.json`) - published daily by the
   *      `snapshotShortCodes` Cloud Function. Freshest source; skinny
   *      `{_id, encoded}` records which is exactly what Strategy 0 of
   *      `hydrateFromRecord` consumes.
   *   2. Site-bundled `/data/snapshots/shortcodes.json` - generated by
   *      `scripts/export-static-snapshot.cjs` and committed to git. Ships
   *      with the build, so it works even if R2 is unreachable (or the
   *      user is offline and the service worker already cached the site).
   *
   * Either layer alone is a valid "Firestore died" fallback. Having both
   * means the freshness/availability tradeoffs stack instead of competing.
   */
  private async resolveFromStaticSnapshot(code: string): Promise<ShortCodeData | null> {
    if (!this.staticSnapshotCache) {
      this.staticSnapshotCache = await this.loadStaticSnapshot();
    }

    return this.staticSnapshotCache?.get(code) ?? null;
  }

  private async loadStaticSnapshot(): Promise<Map<string, ShortCodeData> | null> {
    const sources: { label: string; url: string }[] = [
      {
        label: "R2 CDN (daily)",
        url: "https://pub-f5505ed75927471cb198c54336317370.r2.dev/snapshots/shortcodes-v2.json",
      },
      {
        label: "git-committed snapshot",
        url: "/data/snapshots/shortcodes.json",
      },
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source.url);
        if (!response.ok) {
          console.warn(
            `[ShortCode] ${source.label} unavailable (${response.status})`
          );
          continue;
        }
        const envelope = await response.json();
        const map = new Map<string, ShortCodeData>();
        for (const doc of envelope.documents || []) {
          if (doc._id) {
            map.set(doc._id, doc as ShortCodeData);
          }
        }
        return map;
      } catch (error) {
        console.warn(`[ShortCode] Failed to load ${source.label}:`, error);
      }
    }

    return null;
  }

  /**
   * Given a short code record (from Firebase or static snapshot), resolve it
   * to full sequence data using the same multi-strategy approach.
   */
  private async hydrateFromRecord(code: string, data: ShortCodeData): Promise<SequenceData | null> {
    // Strategy 0: Self-contained encoded blob (zero Firestore dependency).
    // Preferred path - fastest, and the only strategy that survives a full
    // Firestore outage when resolving from the static snapshot.
    if (data.encoded) {
      try {
        const decoded = await decodeSequenceFromQR(data.encoded);
        return { ...decoded, id: code } as SequenceData;
      } catch (err) {
        // encoded blob failed to decode — fall through to other strategies
      }
    }

    // Strategy 1: Public index lookup by stored word + sequenceId
    try {
      const fullSequence = await this.browseLoader.loadFullSequenceData(
        data.sequence,
        data.sequenceId
      );
      if (fullSequence) {
        return fullSequence;
      }
    } catch (err) {
      // Public index lookup failed — fall through
    }

    // Strategy 2: The stored word may be expanded (e.g., "AAKEAAKEAAKEAAKE").
    // Try using sequenceId as the word - it often matches the simplified form.
    if (data.sequenceId && data.sequenceId !== data.sequence) {
      try {
        const byId = await this.browseLoader.loadFullSequenceData(
          data.sequenceId,
          data.sequenceId
        );
        if (byId) {
          return byId;
        }
      } catch (err) {
        // sequenceId-as-word lookup failed — fall through
      }
    }

    // Strategy 3: Direct Firestore load (requires ownerId + sequenceId)
    if (data.ownerId && data.sequenceId) {
      try {
        const firestore = await this.ensureFirestore();
        const directRef = doc(firestore, `users/${data.ownerId}/sequences/${data.sequenceId}`);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          const seqData = directSnap.data();
          return {
            ...seqData,
            id: directSnap.id,
            ownerId: data.ownerId,
          } as SequenceData;
        }
        // Direct Firestore doc not found — fall through
      } catch (error) {
        console.error(`[ShortCode] ✗ Direct Firestore load failed:`, error);
      }
    } else {
      // Skipping direct load — missing ownerId or sequenceId
    }

    // Strategy 4: Embedded sequence data (deck sequences without ownerId).
    // When a shortcode was created for a deck sequence, the essential fields
    // were stored inline so we can hydrate without searching deck collections.
    if (data.sequenceData) {
      return createSequenceData({ id: code, ...data.sequenceData });
    }

    console.error(`[ShortCode] ✗ ALL strategies failed for code "${code}". Record:`, JSON.stringify(data));

    return null;
  }

  async incrementScanCount(code: string): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      const docRef = doc(firestore, SHORTCODES_COLLECTION, code);

      // Write three things atomically:
      //   - scanCount (canonical total)
      //   - lastScannedAt (for "most recent scan" stat)
      //   - dailyScans.YYYY-MM-DD += 1 (rolled-up sparkline bucket)
      //
      // The dailyScans map lives on the parent doc so the admin
      // dashboard can render 30-day sparklines for the top-50 codes
      // without fan-out reads into each code's scanEvents subcollection.
      // Map size is bounded - a year of daily keys is ~5 KB, well
      // under Firestore's 1 MB doc limit.
      const today = new Date().toISOString().slice(0, 10);
      await updateDoc(docRef, {
        scanCount: increment(1),
        lastScannedAt: new Date().toISOString(),
        [`dailyScans.${today}`]: increment(1),
      });
    } catch (error) {
      // Log but don't throw - analytics shouldn't break the user experience
      console.error("Failed to increment scan count:", error);
    }
  }

  async getAnalytics(code: string): Promise<ShortCodeRecord | null> {
    const firestore = await this.ensureFirestore();
    const docRef = doc(firestore, SHORTCODES_COLLECTION, code);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as {
      sequence: string;
      createdAt: string;
      createdBy: string;
      scanCount: number;
      sequenceName?: string;
    };

    return {
      sequence: data.sequence,
      createdAt: new Date(data.createdAt),
      createdBy: data.createdBy,
      scanCount: data.scanCount,
      sequenceName: data.sequenceName,
    };
  }

  async logScanEvent(
    code: string,
    event: {
      printId: string | null;
      country: string | null;
      city: string | null;
      userAgent: string;
      screenWidth: number;
      screenHeight: number;
      referrer: string | null;
      userId: string | null;
      deviceId: string;
    }
  ): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      const eventsRef = collection(firestore, SHORTCODES_COLLECTION, code, "scanEvents");
      await addDoc(eventsRef, {
        ...event,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log scan event:", error);
    }
  }
}
