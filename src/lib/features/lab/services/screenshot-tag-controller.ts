/**
 * ScreenshotTagController
 *
 * Delegates tag CRUD to FirebaseTagPersistence from @austencloud/media-tagging-firebase.
 * Screenshot-specific tag assignment (tagIds on screenshot docs) uses direct Firestore
 * operations because TKA screenshots use a `tagIds` field rather than the shared
 * MediaItem `tags` field.
 *
 * Tags:        users/{userId}/screenshotTags/{tagId}
 * Screenshots: users/{userId}/screenshots/{docId}  (tagIds[] field)
 */

import type { MediaTag, TagColor } from "@austencloud/media-tagging-types";
import {
  FirebaseTagPersistence,
  type FirebaseTagPersistenceConfig,
} from "@austencloud/media-tagging-firebase";
import {
  getFirestoreInstance,
  getAuthSync,
} from "$lib/shared/auth/firebase";

export class ScreenshotTagController {
  private persistence: FirebaseTagPersistence | null = null;

  private getUserId(): string {
    const auth = getAuthSync();
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Not authenticated");
    return userId;
  }

  /**
   * Lazily initialize FirebaseTagPersistence with user-scoped collection paths.
   * This must be async because getFirestoreInstance() returns a Promise.
   */
  private async getPersistence(): Promise<FirebaseTagPersistence> {
    if (this.persistence) return this.persistence;

    const userId = this.getUserId();
    const db = await getFirestoreInstance();

    const config: FirebaseTagPersistenceConfig = {
      firestore: db,
      collectionPaths: {
        tags: `users/${userId}/screenshotTags`,
        items: `users/${userId}/screenshots`,
      },
    };

    this.persistence = new FirebaseTagPersistence(config);
    return this.persistence;
  }

  /**
   * Helper to get Firestore module + instance for screenshot-specific operations.
   * Tag CRUD goes through FirebaseTagPersistence; screenshot tag assignment
   * needs direct Firestore access because we use `tagIds` not `tags`.
   */
  private async getDb() {
    const db = await getFirestoreInstance();
    const m = await import("firebase/firestore");
    return { db, ...m };
  }

  private screenshotsPath(userId: string): string {
    return `users/${userId}/screenshots`;
  }

  // ─── Tag CRUD (delegated to shared package) ─────────────────────────────

  async loadTags(): Promise<MediaTag[]> {
    const persistence = await this.getPersistence();
    return persistence.tags.getAll();
  }

  subscribeTags(callback: (tags: MediaTag[]) => void): () => void {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async (attempt = 0) => {
      if (cancelled) return;

      const userId = this.getUserId();
      const {
        db,
        collection,
        onSnapshot,
        orderBy,
        query,
      } = await this.getDb();

      const q = query(
        collection(db, `users/${userId}/screenshotTags`),
        orderBy("name", "asc")
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tags = snapshot.docs.map((doc) => this.docToTag(doc));
          callback(tags);
        },
        (error) => {
          // Firestore credential propagation can race with onSnapshot setup.
          // Retry after a delay to let the auth token settle.
          if (error.code === "permission-denied" && attempt < 3) {
            unsubscribe?.();
            unsubscribe = null;
            setTimeout(() => {
              setup(attempt + 1).catch(() => {});
            }, 1000 * (attempt + 1));
          } else {
            console.warn("[ScreenshotTagController] Tag snapshot listener error:", error.message);
          }
        }
      );
    };

    setup().catch((err) => {
      console.warn("[ScreenshotTagController] Failed to set up tag subscription:", err instanceof Error ? err.message : err);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }

  async createTag(
    name: string,
    color: TagColor,
    category: string
  ): Promise<void> {
    const persistence = await this.getPersistence();
    await persistence.tags.add({
      name: name.trim(),
      color,
      category,
      parentId: null,
      path: [],
      depth: 0,
      aliases: [],
    });
  }

  async deleteTag(tagId: string): Promise<void> {
    const persistence = await this.getPersistence();
    const userId = this.getUserId();

    // Delete the tag document via shared package
    await persistence.tags.delete(tagId);

    // Remove the tagId from all screenshots that have it
    // (Uses direct Firestore because screenshots use `tagIds` not `tags`)
    const {
      db,
      collection,
      getDocs,
      query,
      where,
      writeBatch,
      arrayRemove,
    } = await this.getDb();

    const screenshotsRef = collection(db, this.screenshotsPath(userId));
    const q = query(
      screenshotsRef,
      where("tagIds", "array-contains", tagId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.size > 0) {
      const batch = writeBatch(db);
      for (const docSnap of snapshot.docs) {
        batch.update(docSnap.ref, { tagIds: arrayRemove(tagId) });
      }
      await batch.commit();
    }
  }

  // ─── Screenshot tag assignment (TKA-specific, uses tagIds field) ────────

  async addTagToScreenshots(
    tagId: string,
    screenshotIds: string[]
  ): Promise<void> {
    const userId = this.getUserId();
    const { db, doc, writeBatch, arrayUnion } = await this.getDb();

    const batch = writeBatch(db);
    for (const ssId of screenshotIds) {
      const ref = doc(db, this.screenshotsPath(userId), ssId);
      batch.update(ref, { tagIds: arrayUnion(tagId) });
    }
    await batch.commit();
  }

  async removeTagFromScreenshots(
    tagId: string,
    screenshotIds: string[]
  ): Promise<void> {
    const userId = this.getUserId();
    const { db, doc, writeBatch, arrayRemove } = await this.getDb();

    const batch = writeBatch(db);
    for (const ssId of screenshotIds) {
      const ref = doc(db, this.screenshotsPath(userId), ssId);
      batch.update(ref, { tagIds: arrayRemove(tagId) });
    }
    await batch.commit();
  }

  async toggleTagOnScreenshot(
    tagId: string,
    screenshotId: string
  ): Promise<void> {
    const userId = this.getUserId();
    const { db, doc, getDoc, updateDoc, arrayUnion, arrayRemove } =
      await this.getDb();

    const ref = doc(db, this.screenshotsPath(userId), screenshotId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const tagIds: string[] = snap.data().tagIds ?? [];
    if (tagIds.includes(tagId)) {
      await updateDoc(ref, { tagIds: arrayRemove(tagId) });
    } else {
      await updateDoc(ref, { tagIds: arrayUnion(tagId) });
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private docToTag(docSnap: { id: string; data: () => any }): MediaTag {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      name: (d.name as string) ?? "",
      color: (d.color as TagColor) ?? "gray",
      category: (d.category as string) ?? "content",
      parentId: (d.parentId as string | null) ?? null,
      path: (d.path as string[]) ?? [],
      depth: (d.depth as number) ?? 0,
      aliases: (d.aliases as string[]) ?? [],
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
      updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
    };
  }
}
