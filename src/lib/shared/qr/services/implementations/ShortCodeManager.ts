/**
 * Short Code Manager Implementation
 *
 * Manages short codes for QR code URLs using Firebase Firestore.
 * Short codes are 6-character alphanumeric strings that map to
 * encoded sequence data for compact QR codes.
 *
 * Firebase collection: shortcodes
 *
 * Domain: QR - URL Shortening
 */

import {
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  type SequenceData,
  createSequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
import type { IPublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/services/contracts/IPublicSequenceHashMatcher";
import type {
  IShortCodeManager,
  ShortCodeRecord,
  CreateShortCodeResult,
  ShortCodeURLOptions,
} from "../contracts/IShortCodeManager";

const SHORTCODES_COLLECTION = "shortcodes";
const CODE_LENGTH = 6;

// Base62 alphabet for short codes (URL-safe, case-sensitive)
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

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
}

export class ShortCodeManager implements IShortCodeManager {
  private firestore: Firestore | null = null;
  private staticSnapshotCache: Map<string, ShortCodeData> | null = null;

  constructor(
    private readonly browseLoader: IBrowseLoader,
    private readonly sequenceEncoder: ISequenceEncoder,
    private readonly hashMatcher?: IPublicSequenceHashMatcher
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
  private generateCode(): string {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
  }

  /**
   * Get the base URL for short code URLs
   */
  private getBaseUrl(): string {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    // Fallback for SSR
    return "https://tkaflowarts.com";
  }

  /**
   * Build URL with optional prop type query params.
   * Props are encoded as single characters (bp=S for blue staff, rp=F for red fan).
   */
  private buildUrlWithOptions(baseUrl: string, code: string, options?: ShortCodeURLOptions): string {
    let url = `${baseUrl}/p/${code}`;

    // Add prop type query params if provided
    const params = new URLSearchParams();
    if (options?.bluePropType) {
      params.set("bp", options.bluePropType);
    }
    if (options?.redPropType) {
      params.set("rp", options.redPropType);
    }

    const query = params.toString();
    if (query) {
      url += `?${query}`;
    }

    return url;
  }

  async createShortCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult> {
    const firestore = await this.ensureFirestore();

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

    // Check if this sequence already has a short code (by hash or word)
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

    // Generate a new unique code
    let code = this.generateCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const docRef = doc(firestore, SHORTCODES_COLLECTION, code);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const record: Record<string, unknown> = {
          sequence: fallbackId || "", // Keep word for backwards compat and debugging
          createdAt: new Date().toISOString(),
          createdBy: "system",
          scanCount: 0,
          sequenceName: sequence.word || sequence.name || "",
        };
        // Only set optional fields if defined (Firestore rejects undefined values)
        if (sequence.id) record.sequenceId = sequence.id;
        if (sequence.ownerId) record.ownerId = sequence.ownerId;
        // Store encoderHash for content-based dedup
        if (encoderHash) {
          record.encoderHash = encoderHash;
        }

        // Deck sequences have no ownerId, so the resolver can't look them up
        // by owner path. Embed the essential sequence data directly in the
        // shortcode record so we can hydrate without searching deck collections.
        if (!sequence.ownerId && sequence.steps && sequence.steps.length > 0) {
          const seqData: Record<string, unknown> = {
            steps: sequence.steps,
          };
          if (sequence.word != null) seqData.word = sequence.word;
          if (sequence.startPosition != null) seqData.startPosition = sequence.startPosition;
          if (sequence.gridMode != null) seqData.gridMode = sequence.gridMode;
          if (sequence.isCircular != null) seqData.isCircular = sequence.isCircular;
          if (sequence.loopType != null) seqData.loopType = sequence.loopType;
          // JSON round-trip strips undefined values that Firestore rejects
          record.sequenceData = JSON.parse(JSON.stringify(seqData));
        }

        await setDoc(docRef, record);

        return {
          code,
          url: this.buildUrlWithOptions(this.getBaseUrl(), code, options),
          isNew: true,
        };
      }

      // Code collision, try a new one
      code = this.generateCode();
      attempts++;
    }

    throw new Error("Failed to generate unique short code after max attempts");
  }

  /**
   * Create an offline-capable code for a sequence.
   * Embeds all sequence data in the URL, no Firebase lookup needed.
   */
  async createOfflineCode(sequence: SequenceData, options?: ShortCodeURLOptions): Promise<CreateShortCodeResult> {
    const code = await this.sequenceEncoder.encodeForQR(sequence);
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
    if (this.sequenceEncoder.isInlineEncoded(code)) {
      try {
        // Decode directly - no Firebase needed, works offline!
        return await this.sequenceEncoder.decodeFromQR(code);
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
   * Look up a short code from the static JSON snapshot deployed at /data/snapshots/shortcodes.json.
   * This file is generated by scripts/export-static-snapshot.cjs and committed to git.
   * It contains every short code record, so if Firebase dies, QR codes still resolve.
   */
  private async resolveFromStaticSnapshot(code: string): Promise<ShortCodeData | null> {
    // Cache the snapshot in memory so we only fetch it once per session
    if (!this.staticSnapshotCache) {
      try {
        const response = await fetch("/data/snapshots/shortcodes.json");
        if (!response.ok) {
          console.warn(`[ShortCode] Static snapshot not available (${response.status})`);
          return null;
        }
        const envelope = await response.json();
        // Build a lookup map from the documents array for fast access
        const map = new Map<string, ShortCodeData>();
        for (const doc of envelope.documents || []) {
          if (doc._id) {
            map.set(doc._id, doc as ShortCodeData);
          }
        }
        this.staticSnapshotCache = map;
        console.log(`[ShortCode] Loaded static snapshot (${map.size} codes)`);
      } catch (error) {
        console.warn("[ShortCode] Failed to load static snapshot:", error);
        return null;
      }
    }

    return this.staticSnapshotCache.get(code) ?? null;
  }

  /**
   * Given a short code record (from Firebase or static snapshot), resolve it
   * to full sequence data using the same multi-strategy approach.
   */
  private async hydrateFromRecord(code: string, data: ShortCodeData): Promise<SequenceData | null> {
    console.log(`[ShortCode] Record for "${code}":`, {
      sequence: data.sequence,
      sequenceId: data.sequenceId ?? "MISSING",
      ownerId: data.ownerId ?? "MISSING",
    });

    // Strategy 1: Public index lookup by stored word + sequenceId
    try {
      const fullSequence = await this.browseLoader.loadFullSequenceData(
        data.sequence,
        data.sequenceId
      );
      if (fullSequence) {
        console.log(`[ShortCode] ✓ Resolved "${code}" via public index (word="${data.sequence}")`);
        return fullSequence;
      }
      console.log(`[ShortCode] ✗ Public index returned null for word="${data.sequence}", id="${data.sequenceId}"`);
    } catch (err) {
      console.log(`[ShortCode] ✗ Public index threw for word="${data.sequence}":`, err);
    }

    // Strategy 2: The stored word may be expanded (e.g., "AAKEAAKEAAKEAAKE").
    // Try using sequenceId as the word — it often matches the simplified form.
    if (data.sequenceId && data.sequenceId !== data.sequence) {
      try {
        const byId = await this.browseLoader.loadFullSequenceData(
          data.sequenceId,
          data.sequenceId
        );
        if (byId) {
          console.log(`[ShortCode] ✓ Resolved "${code}" via sequenceId-as-word="${data.sequenceId}"`);
          return byId;
        }
        console.log(`[ShortCode] ✗ sequenceId-as-word lookup returned null for "${data.sequenceId}"`);
      } catch (err) {
        console.log(`[ShortCode] ✗ sequenceId-as-word threw for "${data.sequenceId}":`, err);
      }
    }

    // Strategy 3: Direct Firestore load (requires ownerId + sequenceId)
    if (data.ownerId && data.sequenceId) {
      try {
        const firestore = await this.ensureFirestore();
        const directRef = doc(firestore, `users/${data.ownerId}/sequences/${data.sequenceId}`);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          console.log(`[ShortCode] ✓ Resolved "${code}" via direct Firestore load (owner=${data.ownerId})`);
          const seqData = directSnap.data();
          return {
            ...seqData,
            id: directSnap.id,
            ownerId: data.ownerId,
          } as SequenceData;
        }
        console.log(`[ShortCode] ✗ Direct Firestore doc not found: users/${data.ownerId}/sequences/${data.sequenceId}`);
      } catch (error) {
        console.error(`[ShortCode] ✗ Direct Firestore load failed:`, error);
      }
    } else {
      console.log(`[ShortCode] ✗ Skipping direct load — ownerId=${data.ownerId ?? "MISSING"}, sequenceId=${data.sequenceId ?? "MISSING"}`);
    }

    // Strategy 4: Embedded sequence data (deck sequences without ownerId).
    // When a shortcode was created for a deck sequence, the essential fields
    // were stored inline so we can hydrate without searching deck collections.
    if (data.sequenceData) {
      console.log(`[ShortCode] ✓ Resolved "${code}" via embedded sequence data`);
      return createSequenceData({ id: code, ...data.sequenceData });
    }

    console.error(`[ShortCode] ✗ ALL strategies failed for code "${code}". Record:`, JSON.stringify(data));

    return null;
  }

  async incrementScanCount(code: string): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      const docRef = doc(firestore, SHORTCODES_COLLECTION, code);

      await updateDoc(docRef, {
        scanCount: increment(1),
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
