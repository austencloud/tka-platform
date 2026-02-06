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
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
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

export class ShortCodeManager implements IShortCodeManager {
  private firestore: Firestore | null = null;

  constructor(
    private readonly browseLoader: IBrowseLoader,
    private readonly sequenceEncoder: ISequenceEncoder
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
    return "https://thekineticalphabet.com";
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

    // Use sequence word/name as the unique identifier
    // This is more reliable than encoding steps (which may be empty for performance)
    const sequenceId = sequence.word || sequence.name || sequence.id;

    if (!sequenceId) {
      throw new Error("Sequence must have a word, name, or id for QR code generation");
    }

    // Check if this sequence already has a short code
    const existingCode = await this.findExistingCode(sequenceId);
    if (existingCode) {
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
        // Code is unique, save it
        const record: Omit<ShortCodeRecord, "createdAt"> & {
          createdAt: string;
        } = {
          sequence: sequenceId, // Store the sequence identifier (word/name)
          createdAt: new Date().toISOString(),
          createdBy: "system", // TODO: Use actual user ID when auth context available
          scanCount: 0,
          sequenceName: sequence.word || sequence.name,
        };

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
  createOfflineCode(sequence: SequenceData, options?: ShortCodeURLOptions): CreateShortCodeResult {
    const code = this.sequenceEncoder.encodeForQR(sequence);
    return {
      code,
      url: this.buildUrlWithOptions(this.getBaseUrl(), code, options),
      isNew: true, // Offline codes are always "new" (not stored)
    };
  }

  /**
   * Find an existing short code for an encoded sequence
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

  async resolveShortCode(code: string): Promise<SequenceData | null> {
    // Check if this is an inline-encoded offline code (s~...)
    if (this.sequenceEncoder.isInlineEncoded(code)) {
      try {
        // Decode directly - no Firebase needed, works offline!
        return this.sequenceEncoder.decodeFromQR(code);
      } catch (error) {
        console.error("Failed to decode inline sequence:", error);
        return null;
      }
    }

    // Existing Firebase lookup for traditional short codes
    const firestore = await this.ensureFirestore();
    const docRef = doc(firestore, SHORTCODES_COLLECTION, code);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as {
      sequence: string; // This is now the sequence identifier (word/name)
      createdAt: string;
      createdBy: string;
      scanCount: number;
    };

    try {
      // Load the full sequence data using the stored identifier
      const fullSequence = await this.browseLoader.loadFullSequenceData(data.sequence);
      return fullSequence;
    } catch (error) {
      console.error("Failed to load sequence from short code:", error);
      return null;
    }
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
}
