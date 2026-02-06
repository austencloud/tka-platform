/**
 * IndexedDB Storage Service for ML Training Data
 *
 * Stores capture sessions, frames, and annotations in the browser.
 * Provides CRUD operations and bulk export functionality.
 */

import type {
  CaptureSession,
  CapturedFrame,
  PropAnnotation,
  LabeledFrame,
  DatasetStats,
  HeadDirection,
  PropType,
} from "../domain/models";

const DB_NAME = "tka-ml-training";
const DB_VERSION = 1;

// Store names
const STORES = {
  SESSIONS: "sessions",
  FRAMES: "frames",
  ANNOTATIONS: "annotations",
  IMAGES: "images", // Binary image data
} as const;

/**
 * Opens or creates the IndexedDB database with all required stores.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Sessions store
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, {
          keyPath: "id",
        });
        sessionStore.createIndex("createdAt", "createdAt", { unique: false });
        sessionStore.createIndex("propType", "propType", { unique: false });
      }

      // Frames store
      if (!db.objectStoreNames.contains(STORES.FRAMES)) {
        const frameStore = db.createObjectStore(STORES.FRAMES, {
          keyPath: "id",
        });
        frameStore.createIndex("sessionId", "sessionId", { unique: false });
        frameStore.createIndex("status", "status", { unique: false });
        frameStore.createIndex(
          "sessionId_frameNumber",
          ["sessionId", "frameNumber"],
          { unique: true }
        );
      }

      // Annotations store
      if (!db.objectStoreNames.contains(STORES.ANNOTATIONS)) {
        const annotationStore = db.createObjectStore(STORES.ANNOTATIONS, {
          keyPath: "id",
        });
        annotationStore.createIndex("frameId", "frameId", { unique: false });
        annotationStore.createIndex("hand", "hand", { unique: false });
        annotationStore.createIndex("propType", "propType", { unique: false });
      }

      // Images store (binary blobs)
      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        db.createObjectStore(STORES.IMAGES, { keyPath: "id" });
      }
    };
  });
}

/**
 * Generic helper for IDBRequest to Promise conversion.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic helper for IDBTransaction completion.
 */
function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Transaction aborted"));
  });
}

/**
 * ML Training Storage Service
 *
 * Provides all CRUD operations for the training data pipeline.
 */
export class MLTrainingStorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database connection.
   * Safe to call multiple times - will only open once.
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    if (!this.initPromise) {
      this.initPromise = openDatabase().then((db) => {
        this.db = db;
      });
    }

    await this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Create a new capture session.
   */
  async createSession(session: CaptureSession): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.SESSIONS, "readwrite");
    const store = tx.objectStore(STORES.SESSIONS);

    await promisifyRequest(store.add(session));
    await promisifyTransaction(tx);
  }

  /**
   * Get a session by ID.
   */
  async getSession(id: string): Promise<CaptureSession | undefined> {
    const db = this.getDb();
    const tx = db.transaction(STORES.SESSIONS, "readonly");
    const store = tx.objectStore(STORES.SESSIONS);

    return promisifyRequest(store.get(id));
  }

  /**
   * Get all sessions, optionally filtered by prop type.
   */
  async getSessions(propType?: PropType): Promise<CaptureSession[]> {
    const db = this.getDb();
    const tx = db.transaction(STORES.SESSIONS, "readonly");
    const store = tx.objectStore(STORES.SESSIONS);

    if (propType) {
      const index = store.index("propType");
      return promisifyRequest(index.getAll(propType));
    }

    return promisifyRequest(store.getAll());
  }

  /**
   * Update a session.
   */
  async updateSession(session: CaptureSession): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.SESSIONS, "readwrite");
    const store = tx.objectStore(STORES.SESSIONS);

    await promisifyRequest(store.put(session));
    await promisifyTransaction(tx);
  }

  /**
   * Delete a session and all its frames/annotations/images.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const db = this.getDb();

    // Get all frames for this session
    const frames = await this.getFramesBySession(sessionId);

    // Delete in a single transaction
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.FRAMES, STORES.ANNOTATIONS, STORES.IMAGES],
      "readwrite"
    );

    // Delete session
    tx.objectStore(STORES.SESSIONS).delete(sessionId);

    // Delete frames and their images/annotations
    for (const frame of frames) {
      tx.objectStore(STORES.FRAMES).delete(frame.id);
      tx.objectStore(STORES.IMAGES).delete(frame.imageKey);

      // Delete annotations for this frame
      const annotationStore = tx.objectStore(STORES.ANNOTATIONS);
      const annotationIndex = annotationStore.index("frameId");
      const annotationRequest = annotationIndex.getAllKeys(frame.id);

      annotationRequest.onsuccess = () => {
        for (const key of annotationRequest.result) {
          annotationStore.delete(key);
        }
      };
    }

    await promisifyTransaction(tx);
  }

  // ==================== FRAME OPERATIONS ====================

  /**
   * Add a captured frame with its image data.
   */
  async addFrame(frame: CapturedFrame, imageBlob: Blob): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction([STORES.FRAMES, STORES.IMAGES], "readwrite");

    // Store frame metadata
    tx.objectStore(STORES.FRAMES).add(frame);

    // Store image data
    tx.objectStore(STORES.IMAGES).add({
      id: frame.imageKey,
      blob: imageBlob,
      createdAt: new Date(),
    });

    await promisifyTransaction(tx);
  }

  /**
   * Add multiple frames in a batch (more efficient for bulk capture).
   */
  async addFramesBatch(
    frames: Array<{ frame: CapturedFrame; imageBlob: Blob }>
  ): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction([STORES.FRAMES, STORES.IMAGES], "readwrite");
    const frameStore = tx.objectStore(STORES.FRAMES);
    const imageStore = tx.objectStore(STORES.IMAGES);

    for (const { frame, imageBlob } of frames) {
      frameStore.add(frame);
      imageStore.add({
        id: frame.imageKey,
        blob: imageBlob,
        createdAt: new Date(),
      });
    }

    await promisifyTransaction(tx);
  }

  /**
   * Get a frame by ID.
   */
  async getFrame(id: string): Promise<CapturedFrame | undefined> {
    const db = this.getDb();
    const tx = db.transaction(STORES.FRAMES, "readonly");
    const store = tx.objectStore(STORES.FRAMES);

    return promisifyRequest(store.get(id));
  }

  /**
   * Get all frames for a session.
   */
  async getFramesBySession(sessionId: string): Promise<CapturedFrame[]> {
    const db = this.getDb();
    const tx = db.transaction(STORES.FRAMES, "readonly");
    const store = tx.objectStore(STORES.FRAMES);
    const index = store.index("sessionId");

    const frames = await promisifyRequest(index.getAll(sessionId));

    // Sort by frame number
    return frames.sort((a, b) => a.frameNumber - b.frameNumber);
  }

  /**
   * Get image blob for a frame.
   */
  async getFrameImage(imageKey: string): Promise<Blob | undefined> {
    const db = this.getDb();
    const tx = db.transaction(STORES.IMAGES, "readonly");
    const store = tx.objectStore(STORES.IMAGES);

    const result = await promisifyRequest(store.get(imageKey));
    return result?.blob;
  }

  /**
   * Update frame metadata (e.g., after labeling).
   */
  async updateFrame(frame: CapturedFrame): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.FRAMES, "readwrite");
    const store = tx.objectStore(STORES.FRAMES);

    await promisifyRequest(store.put(frame));
    await promisifyTransaction(tx);
  }

  // ==================== ANNOTATION OPERATIONS ====================

  /**
   * Save an annotation for a frame.
   */
  async saveAnnotation(annotation: PropAnnotation): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.ANNOTATIONS, "readwrite");
    const store = tx.objectStore(STORES.ANNOTATIONS);

    await promisifyRequest(store.put(annotation));
    await promisifyTransaction(tx);
  }

  /**
   * Get all annotations for a frame.
   */
  async getAnnotationsForFrame(frameId: string): Promise<PropAnnotation[]> {
    const db = this.getDb();
    const tx = db.transaction(STORES.ANNOTATIONS, "readonly");
    const store = tx.objectStore(STORES.ANNOTATIONS);
    const index = store.index("frameId");

    return promisifyRequest(index.getAll(frameId));
  }

  /**
   * Delete an annotation.
   */
  async deleteAnnotation(annotationId: string): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(STORES.ANNOTATIONS, "readwrite");
    const store = tx.objectStore(STORES.ANNOTATIONS);

    await promisifyRequest(store.delete(annotationId));
    await promisifyTransaction(tx);
  }

  /**
   * Delete all annotations for a frame.
   */
  async clearAnnotationsForFrame(frameId: string): Promise<void> {
    const annotations = await this.getAnnotationsForFrame(frameId);

    const db = this.getDb();
    const tx = db.transaction(STORES.ANNOTATIONS, "readwrite");
    const store = tx.objectStore(STORES.ANNOTATIONS);

    for (const annotation of annotations) {
      store.delete(annotation.id);
    }

    await promisifyTransaction(tx);
  }

  // ==================== LABELED FRAME OPERATIONS ====================

  /**
   * Get a frame with all its annotations.
   */
  async getLabeledFrame(frameId: string): Promise<LabeledFrame | undefined> {
    const frame = await this.getFrame(frameId);
    if (!frame) return undefined;

    const annotations = await this.getAnnotationsForFrame(frameId);

    return { frame, annotations };
  }

  /**
   * Get all labeled frames for a session.
   */
  async getLabeledFramesBySession(sessionId: string): Promise<LabeledFrame[]> {
    const frames = await this.getFramesBySession(sessionId);

    const labeledFrames: LabeledFrame[] = [];
    for (const frame of frames) {
      const annotations = await this.getAnnotationsForFrame(frame.id);
      labeledFrames.push({ frame, annotations });
    }

    return labeledFrames;
  }

  // ==================== STATISTICS ====================

  /**
   * Calculate statistics for a session.
   */
  async getSessionStats(sessionId: string): Promise<DatasetStats> {
    const frames = await this.getFramesBySession(sessionId);

    const stats: DatasetStats = {
      totalFrames: frames.length,
      labeledFrames: 0,
      verifiedFrames: 0,
      annotationsByHand: { left: 0, right: 0 },
      annotationsByDirection: {} as Record<HeadDirection, number>,
      annotationsByPropType: {},
    };

    // Initialize direction counts
    const directions: HeadDirection[] = [
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SW",
      "W",
      "NW",
    ];
    for (const dir of directions) {
      stats.annotationsByDirection[dir] = 0;
    }

    for (const frame of frames) {
      if (frame.status === "labeled" || frame.status === "verified") {
        stats.labeledFrames++;
      }
      if (frame.status === "verified") {
        stats.verifiedFrames++;
      }

      const annotations = await this.getAnnotationsForFrame(frame.id);
      for (const ann of annotations) {
        stats.annotationsByHand[ann.hand]++;
        stats.annotationsByDirection[ann.headDirection]++;
        stats.annotationsByPropType[ann.propType] =
          (stats.annotationsByPropType[ann.propType] || 0) + 1;
      }
    }

    return stats;
  }

  // ==================== CLEANUP ====================

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Clear all training data (use with caution!).
   */
  async clearAllData(): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.FRAMES, STORES.ANNOTATIONS, STORES.IMAGES],
      "readwrite"
    );

    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.FRAMES).clear();
    tx.objectStore(STORES.ANNOTATIONS).clear();
    tx.objectStore(STORES.IMAGES).clear();

    await promisifyTransaction(tx);
  }
}

// Singleton instance
let storageServiceInstance: MLTrainingStorageManager | null = null;

/**
 * Get the singleton storage service instance.
 */
export function getMLTrainingStorage(): MLTrainingStorageManager {
  if (!storageServiceInstance) {
    storageServiceInstance = new MLTrainingStorageManager();
  }
  return storageServiceInstance;
}
