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
  setDoc,
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
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import {
  encodeSequenceForQR,
  isInlineEncoded,
  decodeSequenceFromQR,
} from "$lib/shared/navigation/services/sequence-encoder";
import type { PublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/services/public-sequence-hash-matcher";
import type { ShortCodeRecord, CreateShortCodeResult, ShortCodeURLOptions, ImportResolution } from "./types";
import { ShortCodeCache, SHORT_CODE_CACHE_SCHEMA } from "./short-code-cache";

const SHORTCODES_COLLECTION = "shortcodes";
/** Content-addressed index: shortcodeHashes/{encoderHash} → { code }.
 *  Written atomically with each new code doc; makes one-code-per-hash a
 *  transactional invariant instead of a best-effort pre-check query. */
const HASH_INDEX_COLLECTION = "shortcodeHashes";
const MIN_CODE_LENGTH = 4;

/** Firestore `in` query operand cap. Batch reads chunk to this. */
const FIRESTORE_IN_LIMIT = 30;

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
  /** The sequence's word as printed on the card. Newer records carry it;
   *  without it an imported copy would be nameless ("Shared Sequence"). */
  sequenceName?: string;
  sequenceData?: Record<string, unknown>;
  /** Self-contained "s~..." blob from SequenceEncoder.encodeForQR.
   *  When present, the resolver can decode the sequence without any
   *  cross-collection lookups - the primary path for static snapshot fallback. */
  encoded?: string;
}

/**
 * The word to stamp on a sequence imported from this record's encoded blob.
 * Prefers the explicit sequenceName; older records stored the word in
 * `sequence` — but oldest records stored the ENCODED BLOB there, so anything
 * containing encoding separators ("|") or compression prefixes (":") is not a
 * word and yields "" (the import keeps its decoded placeholder name).
 */
function importedWord(data: ShortCodeData): string {
  const candidate = data.sequenceName || data.sequence || "";
  if (!candidate || candidate.includes("|") || candidate.includes(":")) return "";
  return candidate;
}

export class ShortCodeManager {
  private firestore: Firestore | null = null;
  private staticSnapshotCache: Map<string, ShortCodeData> | null = null;
  /** In-flight single-flight cache keyed by BARE encoderHash (or `w:{id}`
   *  fallback). Every concurrent caller for the same sequence shares ONE
   *  allocation regardless of options/embed flags — the shared result is the
   *  CODE; each caller derives its own URL from its own options. (The old key
   *  included embedScope, which put the two page-load callers — overlay state
   *  and QR generator — in different scopes and let them race straight past
   *  each other: 1,044 duplicate docs by 2026-07-05.) */
  private readonly inflightByKey = new Map<
    string,
    Promise<{ code: string; isNew: boolean }>
  >();

  constructor(
    private readonly browseLoader: PublicSequencesLoader,
    private readonly hashMatcher?: PublicSequenceHashMatcher,
    private readonly codeCache: ShortCodeCache = new ShortCodeCache()
  ) {}

  /**
   * Cache key for a sequence's resolved code. Keyed by content hash (or word
   * fallback) ONLY — the code never varies with URL options, and URLs are
   * derived per caller. deckId/deckName/bp/rp/vm affect the stored record or
   * the URL, never the code.
   */
  private buildCacheKey(hashOrWord: string): string {
    return `${SHORT_CODE_CACHE_SCHEMA}:${hashOrWord}`;
  }

  /**
   * Compute the content hash for a sequence (or null when the matcher is
   * absent / the sequence has no steps). Same logic `createShortCode` uses.
   */
  private async tryComputeHash(
    sequence: SequenceData
  ): Promise<string | undefined> {
    if (this.hashMatcher && sequence.steps && sequence.steps.length > 0) {
      try {
        return await this.hashMatcher.computeEncoderHash(sequence);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

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
   * Generate a random short code of the given length.
   *
   * Length is a per-call parameter (not instance state) so a collision-bump in
   * one createShortCode call can't permanently raise the code length for every
   * future call on the same instance. Concurrent calls each escalate their own
   * local length independently.
   */
  private generateCode(codeLength: number): string {
    let code = "";
    for (let i = 0; i < codeLength; i++) {
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
    // Short codes are a signed-in-only operation — every caller gates on auth
    // before reaching here (guests get no QR at all). There is no guest
    // short-circuit anymore: the dense self-contained "s~..." QR it minted was
    // unscannable, so guests simply get nothing rather than a bad code.

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

    const allocKey = encoderHash ?? `w:${fallbackId}`;

    // Persistent-cache short-circuit. A sequence's code is global + content-
    // addressed, so once resolved it never changes — read it locally and skip
    // the Firestore round-trip entirely. This is the cold-deck speed fix:
    // ~380ms/card network query → memory/IDB read.
    const cacheKey = this.buildCacheKey(allocKey);
    const cached = await this.codeCache.get(cacheKey);
    if (cached) {
      return {
        code: cached.code,
        url: this.buildUrlWithOptions(this.getBaseUrl(), cached.code, options),
        isNew: false,
      };
    }

    let inflight = this.inflightByKey.get(allocKey);
    if (!inflight) {
      inflight = this.allocateCode(sequence, options, encoderHash, fallbackId)
        .then((result) => {
          // Write through the persistent cache so the next render (this
          // session or future) skips Firestore.
          void this.codeCache.set(cacheKey, { code: result.code });
          return result;
        })
        .finally(() => this.inflightByKey.delete(allocKey));
      this.inflightByKey.set(allocKey, inflight);
    }

    const { code, isNew } = await inflight;
    return {
      code,
      url: this.buildUrlWithOptions(this.getBaseUrl(), code, options),
      isNew,
    };
  }

  /**
   * Batch-resolve every sequence's short code for a deck render in as few
   * Firestore reads as possible, populating the persistent cache. Turns the
   * first cold view of a fresh deck from N serial round-trips into ~⌈N/30⌉.
   *
   * Best-effort: anything not resolved here (no existing code, or the batch
   * failed) falls through to per-card `createShortCode` at render time, which
   * still creates + caches it. Never throws — a deck render must not block on
   * code resolution.
   */
  async resolveCodesForDeck(
    sequences: SequenceData[],
    options?: ShortCodeURLOptions,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (sequences.length === 0) return;

    try {
      // 1. Compute the content hash + cache key for every sequence.
      const items = await Promise.all(
        sequences.map(async (seq) => {
          const hash = await this.tryComputeHash(seq);
          const fallbackId = seq.word || seq.name || seq.id;
          const hashOrWord = hash ?? `w:${fallbackId ?? ""}`;
          return {
            hash,
            cacheKey: this.buildCacheKey(hashOrWord),
          };
        })
      );

      // 2. Skip anything already cached.
      const cacheHits = await this.codeCache.getMany(items.map((i) => i.cacheKey));
      const misses = items.filter((i) => !cacheHits.has(i.cacheKey));

      // 3. Only hash-bearing misses can be batch-queried. Dedup hashes —
      //    repeated sequences across a deck share one operand.
      const missHashes = [
        ...new Set(misses.map((i) => i.hash).filter((h): h is string => !!h)),
      ];
      if (missHashes.length === 0) return;

      onProgress?.(0, missHashes.length);
      const firestore = await this.ensureFirestore();
      const hashToCode = new Map<string, { code: string; createdAt: string }>();

      // 4. Chunked `in` queries (Firestore caps the `in` list at 30).
      for (let i = 0; i < missHashes.length; i += FIRESTORE_IN_LIMIT) {
        const chunk = missHashes.slice(i, i + FIRESTORE_IN_LIMIT);
        const snap = await getDocs(
          query(
            collection(firestore, SHORTCODES_COLLECTION),
            where("encoderHash", "in", chunk)
          )
        );
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as ShortCodeData;
          const hash = data.encoderHash;
          if (!hash) continue;
          const prev = hashToCode.get(hash);
          // Legacy duplicate groups: keep the OLDEST doc per hash so batch
          // resolution converges on the same canonical code as single lookups.
          if (!prev || (data.createdAt ?? "") < prev.createdAt) {
            hashToCode.set(hash, { code: docSnap.id, createdAt: data.createdAt ?? "" });
          }
        }
        onProgress?.(Math.min(i + FIRESTORE_IN_LIMIT, missHashes.length), missHashes.length);
      }

      // 5. Populate the cache for every miss whose code already exists.
      await Promise.all(
        misses.map((item) => {
          if (!item.hash) return Promise.resolve();
          const winner = hashToCode.get(item.hash);
          if (!winner) return Promise.resolve(); // genuinely new — created at render
          return this.codeCache.set(item.cacheKey, { code: winner.code });
        })
      );
    } catch (error) {
      // Best-effort: never block a deck render on pre-resolution.
      console.warn("[ShortCode] resolveCodesForDeck failed (falling back to per-card):", error);
    }
  }

  private async allocateCode(
    sequence: SequenceData,
    options: ShortCodeURLOptions | undefined,
    encoderHash: string | undefined,
    fallbackId: string | undefined
  ): Promise<{ code: string; isNew: boolean }> {
    const firestore = await this.ensureFirestore();

    // Check if this sequence already has a short code (by hash or word).
    // Catches codes created before the hash index existed and codes written
    // by other tabs/devices whose index doc hasn't been healed yet.
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
            // Best-effort backfill — a failure (e.g. permission-denied for the
            // current user) must not block returning the existing code. But it
            // does degrade direct-load resolution of unpublished sequences, so
            // surface it instead of swallowing silently.
            await updateDoc(existingRef, updates).catch((error) => {
              console.warn(
                `[ShortCode] Failed to backfill ownerId/sequenceId on "${existingCode}":`,
                error
              );
            });
          }
        }
      }
      return { code: existingCode, isNew: false };
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
    // Persist the deck's prop so the doc is self-describing (the scan URL also
    // carries ?bp/?rp, but storing it lets resolution recover the prop even
    // when a URL is reconstructed without params).
    if (options?.bluePropType) record.bluePropType = options.bluePropType;
    if (options?.redPropType) record.redPropType = options.redPropType;

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

    // Allocate a unique code. The transaction enforces BOTH invariants
    // atomically: the code doc path is unclaimed (collision retry), and no
    // other writer has claimed this hash (index doc). Two clients racing:
    // both read a nonexistent index doc, both try to write it — Firestore's
    // serializable transactions force the loser to retry, whose re-read then
    // sees the winner and adopts its code instead of minting a duplicate.
    const maxAttemptsPerLength = 10;
    const maxCodeLength = MIN_CODE_LENGTH + 2;
    let codeLength = MIN_CODE_LENGTH;
    const indexRef = encoderHash
      ? doc(firestore, HASH_INDEX_COLLECTION, encoderHash)
      : null;

    while (codeLength <= maxCodeLength) {
      for (let attempts = 0; attempts < maxAttemptsPerLength; attempts++) {
        const code = this.generateCode(codeLength);
        const docRef = doc(firestore, SHORTCODES_COLLECTION, code);

        let adoptedCode: string | null = null;
        try {
          await runTransaction(firestore, async (tx) => {
            if (indexRef) {
              const indexSnap = await tx.get(indexRef);
              if (indexSnap.exists()) {
                adoptedCode = (indexSnap.data() as { code: string }).code;
                return;
              }
            }
            const snap = await tx.get(docRef);
            if (snap.exists()) {
              throw new Error("__CODE_COLLISION__");
            }
            tx.set(docRef, record);
            if (indexRef) {
              tx.set(indexRef, { code, createdAt: record.createdAt });
            }
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "__CODE_COLLISION__") continue;
          throw err;
        }

        if (adoptedCode) return { code: adoptedCode, isNew: false };
        return { code, isNew: true };
      }

      codeLength++;
      console.warn(
        `[ShortCode] Exhausted ${maxAttemptsPerLength} attempts at length ${codeLength - 1}, bumping to ${codeLength}`
      );
    }

    throw new Error(
      "Failed to generate unique short code after exhausting all length tiers"
    );
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
   * Find an existing short code by encoderHash (content-addressed).
   *
   * Legacy data contains duplicate groups (pre-2026-07-05 mint race), so the
   * query can return several docs. Pick the OLDEST so every client converges
   * on the same code — `docs[0]` order is arbitrary and made two browsers
   * show different codes for the same sequence.
   */
  private async findExistingCodeByHash(hash: string): Promise<string | null> {
    const firestore = await this.ensureFirestore();
    const q = query(
      collection(firestore, SHORTCODES_COLLECTION),
      where("encoderHash", "==", hash)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    let best = snapshot.docs[0]!;
    let bestCreated = (best.data() as ShortCodeData).createdAt ?? "";
    for (const d of snapshot.docs.slice(1)) {
      const created = (d.data() as ShortCodeData).createdAt ?? "";
      if (created < bestCreated) {
        best = d;
        bestCreated = created;
      }
    }

    // Lazy heal: point the hash index at the canonical code so future
    // allocations hit the transaction path directly. Fire-and-forget —
    // resolution must never block on it.
    void this.healHashIndex(hash, best.id);

    return best.id;
  }

  /** Best-effort create of the hash-index doc. The index is immutable after
   *  create (rules), so a lost race here just means another client healed it
   *  first — the warn is noise, not damage. */
  private async healHashIndex(hash: string, code: string): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      const ref = doc(firestore, HASH_INDEX_COLLECTION, hash);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { code, createdAt: new Date().toISOString() });
      }
    } catch (error) {
      console.warn(`[ShortCode] hash-index heal failed for ${hash}:`, error);
    }
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
   * Resolve a scanned card for FILING into a collection, not viewing.
   *
   * resolveShortCode prefers the self-contained encoded blob (fastest to
   * show) and returns id = code — but a collection member must be a
   * Firestore sequence doc the member-loader can find later (own or
   * public). So this resolver runs identity-first: public index, then
   * sequenceId-as-word, then direct doc load; the blob and embedded data
   * come last and are flagged docBacked: false so the caller knows to
   * import a copy before filing.
   */
  async resolveForImport(
    code: string,
    currentUserId: string | null
  ): Promise<ImportResolution | null> {
    // Self-contained payload: nothing to reference, always a copy.
    if (isInlineEncoded(code)) {
      try {
        return { sequence: await decodeSequenceFromQR(code), docBacked: false };
      } catch (error) {
        console.error("[ShortCode] Failed to decode inline sequence:", error);
        return null;
      }
    }

    let data: ShortCodeData | null = null;
    try {
      data = await this.resolveFromFirestore(code);
    } catch (error) {
      console.warn(`[ShortCode] Firebase unavailable for "${code}", trying static fallback:`, error);
    }
    if (!data) data = await this.resolveFromStaticSnapshot(code);
    if (!data) return null;

    // Strategy: public index by stored word + sequenceId.
    try {
      const bySeq = await this.browseLoader.loadFullSequenceData(data.sequence, data.sequenceId);
      if (bySeq) return { sequence: bySeq, docBacked: true };
    } catch {
      // fall through
    }

    // Strategy: sequenceId as the (simplified) word.
    if (data.sequenceId && data.sequenceId !== data.sequence) {
      try {
        const byId = await this.browseLoader.loadFullSequenceData(data.sequenceId, data.sequenceId);
        if (byId) return { sequence: byId, docBacked: true };
      } catch {
        // fall through
      }
    }

    // Strategy: direct doc load. Referenceable only when the collection
    // member-loader will find it later — the user's own doc, or a public
    // one. A foreign private doc would file as an invisible member, so it
    // feeds the copy path instead (we still use its full data).
    if (data.ownerId && data.sequenceId) {
      try {
        const firestore = await this.ensureFirestore();
        const directSnap = await getDoc(
          doc(firestore, `users/${data.ownerId}/sequences/${data.sequenceId}`)
        );
        if (directSnap.exists()) {
          const seqData = directSnap.data();
          const referenceable =
            data.ownerId === currentUserId || seqData["visibility"] === "public";
          return {
            sequence: { ...seqData, id: directSnap.id, ownerId: data.ownerId } as SequenceData,
            docBacked: referenceable,
          };
        }
      } catch (error) {
        console.error(`[ShortCode] Direct load failed for "${code}":`, error);
      }
    }

    // Self-contained fallbacks — data exists but no referenceable doc.
    if (data.encoded) {
      try {
        const decoded = await decodeSequenceFromQR(data.encoded);
        // The blob carries motion only — decoding names it "Shared Sequence"
        // with an empty word. The record knows what the card actually says
        // (sequenceName; older records put the word in `sequence`), so stamp
        // it. Without this, the imported copy is unrecognizable in the
        // library: a card labeled "SS" instead of its word.
        const word = importedWord(data);
        return {
          sequence: {
            ...decoded,
            id: code,
            ...(word && { word, name: word }),
          } as SequenceData,
          docBacked: false,
        };
      } catch {
        // fall through
      }
    }
    if (data.sequenceData) {
      return { sequence: createSequenceData({ id: code, ...data.sequenceData }), docBacked: false };
    }

    console.error(`[ShortCode] ✗ resolveForImport: all strategies failed for "${code}"`);
    return null;
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
      lat?: number | null;
      lng?: number | null;
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

  /**
   * Write the PII-free public journey projection for a scan. Separate from
   * logScanEvent (which is admin-only and carries deviceId/userAgent/referrer)
   * so the scanner-facing journey can be read publicly without exposing
   * fingerprinting data. Fire-and-forget — never blocks the scan UX.
   */
  async logJourneyPoint(
    code: string,
    point: {
      printId: string | null;
      lat: number | null;
      lng: number | null;
      city: string | null;
      country: string | null;
    }
  ): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      const ref = collection(firestore, SHORTCODES_COLLECTION, code, "journeyPoints");
      await addDoc(ref, {
        ...point,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log journey point:", error);
    }
  }
}
