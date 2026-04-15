/**
 * TagManager - Tag Management Implementation
 *
 * Firestore-based service for managing user-defined tags.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/isPermissionDeniedError";
import type { ITagManager } from "../contracts/ITagManager";
import type { LibraryTag, CreateTagOptions } from "../../domain/models/Tag";
import { createTag } from "../../domain/models/Tag";
import { getUserTagsPath, getUserTagPath } from "../../data/firestore-paths";

/**
 * Error class for tag operations
 */
export class TagError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "UNAUTHORIZED" | "INVALID_DATA" | "NETWORK",
    public tagId?: string
  ) {
    super(message);
    this.name = "TagError";
  }
}

export class TagManager implements ITagManager {
  /**
   * Get the current user ID or throw if not authenticated
   */
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new TagError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Convert Firestore timestamp to Date
   */
  private toDate(timestamp: unknown): Date {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  /**
   * Map Firestore document to LibraryTag
   */
  private mapDocToTag(doc: DocumentData, id: string): LibraryTag {
    const data = doc;
    return {
      id,
      name: data["name"],
      ownerId: data["ownerId"],
      color: data["color"],
      icon: data["icon"],
      useCount: data["useCount"] ?? 0,
      createdAt: this.toDate(data["createdAt"]),
    };
  }

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  async createTag(
    name: string,
    options: CreateTagOptions = {}
  ): Promise<LibraryTag> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const normalizedName = this.normalizeTagName(name);

      // Check for duplicate
      const existing = await this.findTagByName(normalizedName);
      if (existing) {
        return existing;
      }

      const tagId = crypto.randomUUID();
      const tagData = createTag(normalizedName, userId, options);

      // Remove undefined values for Firebase
      const cleanTagData = Object.fromEntries(
        Object.entries(tagData).filter(([_, v]) => v !== undefined)
      );

      await setDoc(doc(firestore, getUserTagPath(userId, tagId)), {
        ...cleanTagData,
        createdAt: serverTimestamp(),
      });

      return {
        id: tagId,
        ...tagData,
      };
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to create tag:", error);
      toast.error("Failed to create tag.");
      throw error;
    }
  }

  async getTag(tagId: string): Promise<LibraryTag | null> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const docRef = doc(firestore, getUserTagPath(userId, tagId));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.mapDocToTag(docSnap.data(), tagId);
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to get tag:", error);
      toast.error("Failed to load tag.");
      return null;
    }
  }

  async getAllTags(): Promise<LibraryTag[]> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const tagsRef = collection(firestore, getUserTagsPath(userId));
      const q = query(tagsRef, orderBy("name", "asc"));

      const snapshot = await getDocs(q);
      const tags: LibraryTag[] = [];

      snapshot.forEach((doc) => {
        tags.push(this.mapDocToTag(doc.data(), doc.id));
      });

      return tags;
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to get all tags:", error);
      toast.error("Failed to load tags.");
      return [];
    }
  }

  async updateTag(
    tagId: string,
    updates: Partial<Pick<LibraryTag, "name" | "color" | "icon">>
  ): Promise<LibraryTag> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const docRef = doc(firestore, getUserTagPath(userId, tagId));

      // Get existing
      const existing = await this.getTag(tagId);
      if (!existing) {
        throw new TagError("Tag not found", "NOT_FOUND", tagId);
      }

      // Normalize name if updating
      const normalizedUpdates = {
        ...updates,
        name: updates.name ? this.normalizeTagName(updates.name) : undefined,
      };

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(normalizedUpdates).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(docRef, cleanUpdates);

      return {
        ...existing,
        ...cleanUpdates,
      } as LibraryTag;
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to update tag:", error);
      toast.error("Failed to update tag.");
      throw error;
    }
  }

  async deleteTag(tagId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const existing = await this.getTag(tagId);

      if (!existing) {
        return; // Already deleted
      }

      await deleteDoc(doc(firestore, getUserTagPath(userId, tagId)));
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to delete tag:", error);
      toast.error("Failed to delete tag.");
      throw error;
    }
  }

  // ============================================================
  // TAG NORMALIZATION & DEDUPLICATION
  // ============================================================

  normalizeTagName(name: string): string {
    return name.trim().toLowerCase();
  }

  async findTagByName(name: string): Promise<LibraryTag | null> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const normalizedName = this.normalizeTagName(name);
      const tagsRef = collection(firestore, getUserTagsPath(userId));
      const q = query(tagsRef, where("name", "==", normalizedName));

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const firstDoc = snapshot.docs[0];
      if (!firstDoc) {
        return null;
      }

      return this.mapDocToTag(firstDoc.data(), firstDoc.id);
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to find tag by name:", error);
      return null;
    }
  }

  // ============================================================
  // USE COUNT MANAGEMENT
  // ============================================================

  async incrementUseCount(tagId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const docRef = doc(firestore, getUserTagPath(userId, tagId));

      await updateDoc(docRef, {
        useCount: increment(1),
      });
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to increment use count:", error);
      // Silent failure - don't show toast for counter updates
    }
  }

  async decrementUseCount(tagId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const docRef = doc(firestore, getUserTagPath(userId, tagId));

      await updateDoc(docRef, {
        useCount: increment(-1),
      });
    } catch (error) {
      if (error instanceof TagError) throw error;
      console.error("[TagManager] Failed to decrement use count:", error);
      // Silent failure - don't show toast for counter updates
    }
  }

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  subscribeToTags(callback: (tags: LibraryTag[]) => void): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    // Initialize subscription asynchronously
    getFirestoreInstance()
      .then((firestore) => {
        const tagsRef = collection(firestore, getUserTagsPath(userId));
        const q = query(tagsRef, orderBy("name", "asc"));

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const tags: LibraryTag[] = [];
            snapshot.forEach((doc) => {
              tags.push(this.mapDocToTag(doc.data(), doc.id));
            });
            callback(tags);
          },
          (error) => {
            // Expected on sign-out; tags belong to the user and become unreadable.
            if (isPermissionDeniedError(error)) return;
            console.error("[TagManager] Subscription error:", error);
            toast.error("Lost connection to tags. Please refresh.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "[TagManager] Failed to initialize tag subscription:",
          error
        );
        toast.error("Failed to connect to tags.");
      });

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }
}
