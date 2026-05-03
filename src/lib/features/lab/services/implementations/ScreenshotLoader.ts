/**
 * ScreenshotLoader
 *
 * Loads screenshot metadata from Firestore, replacing the manifest.json approach.
 * Supports real-time subscriptions, module filtering, and tag-based queries.
 */

import type { ScreenshotMetadata } from "../contracts/IScreenshotUploader";
import {
  getFirestoreInstance,
  getStorageInstance,
  getAuthSync,
} from "$lib/shared/auth/firebase";

export class ScreenshotLoader {
  private getUserId(): string {
    const auth = getAuthSync();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Must be authenticated to load screenshots");
    return uid;
  }

  private getCollectionPath(): string {
    return `users/${this.getUserId()}/screenshots`;
  }

  async loadAll(): Promise<ScreenshotMetadata[]> {
    const { collection, query, orderBy, getDocs, Timestamp } = await import(
      "firebase/firestore"
    );
    const firestore = await getFirestoreInstance();

    const q = query(
      collection(firestore, this.getCollectionPath()),
      orderBy("capturedAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      this.docToMetadata(doc.id, doc.data(), Timestamp)
    );
  }

  subscribeToScreenshots(
    callback: (screenshots: ScreenshotMetadata[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async (attempt = 0) => {
      if (cancelled) return;

      const { collection, query, orderBy, onSnapshot, Timestamp } =
        await import("firebase/firestore");
      const firestore = await getFirestoreInstance();

      const q = query(
        collection(firestore, this.getCollectionPath()),
        orderBy("capturedAt", "desc")
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const screenshots = snapshot.docs.map((doc) =>
            this.docToMetadata(doc.id, doc.data(), Timestamp)
          );
          callback(screenshots);
        },
        (error) => {
          // Firestore credential propagation can race with onSnapshot setup.
          // Retry after a delay to let the auth token settle.
          if (error.code === "permission-denied" && attempt < 3) {
            unsubscribe?.();
            unsubscribe = null;
            setTimeout(() => setup(attempt + 1), 1000 * (attempt + 1));
          } else {
            console.warn("[ScreenshotLoader] Snapshot listener error:", error.message);
            onError?.(new Error(error.message));
          }
        }
      );
    };

    setup().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[ScreenshotLoader] Failed to set up subscription:", msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }

  async loadByModule(module: string): Promise<ScreenshotMetadata[]> {
    const { collection, query, where, orderBy, getDocs, Timestamp } =
      await import("firebase/firestore");
    const firestore = await getFirestoreInstance();

    const q = query(
      collection(firestore, this.getCollectionPath()),
      where("module", "==", module),
      orderBy("capturedAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      this.docToMetadata(doc.id, doc.data(), Timestamp)
    );
  }

  async loadByTags(tagIds: string[]): Promise<ScreenshotMetadata[]> {
    if (tagIds.length === 0) return this.loadAll();

    const { collection, query, where, orderBy, getDocs, Timestamp } =
      await import("firebase/firestore");
    const firestore = await getFirestoreInstance();

    // Firestore array-contains-any supports up to 30 values
    const q = query(
      collection(firestore, this.getCollectionPath()),
      where("tagIds", "array-contains-any", tagIds.slice(0, 30)),
      orderBy("capturedAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) =>
      this.docToMetadata(doc.id, doc.data(), Timestamp)
    );
  }

  async deleteScreenshot(id: string): Promise<void> {
    const { doc, getDoc, deleteDoc } = await import("firebase/firestore");
    const { ref, deleteObject } = await import("firebase/storage");
    const firestore = await getFirestoreInstance();
    const storage = await getStorageInstance();

    const docRef = doc(firestore, this.getCollectionPath(), id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Delete from Storage
      if (data.storagePath) {
        try {
          const storageRef = ref(storage, data.storagePath);
          await deleteObject(storageRef);
        } catch (err) {
          console.warn(
            `[ScreenshotLoader] Storage delete failed for ${data.storagePath}:`,
            err
          );
        }
      }
      // Delete Firestore doc
      await deleteDoc(docRef);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private docToMetadata(id: string, data: any, Timestamp: any): ScreenshotMetadata {
    return {
      id,
      filename: data.filename ?? "",
      storagePath: data.storagePath ?? "",
      downloadUrl: data.downloadUrl ?? "",
      routeLabel: data.routeLabel ?? "",
      module: data.module ?? "",
      deviceSlug: data.deviceSlug ?? "",
      deviceCategory: data.deviceCategory ?? "desktop",
      deviceName: data.deviceName ?? "",
      width: data.width ?? 0,
      height: data.height ?? 0,
      tagIds: data.tagIds ?? [],
      capturedAt:
        data.capturedAt instanceof Timestamp
          ? data.capturedAt.toDate()
          : new Date(data.capturedAt ?? Date.now()),
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt ?? Date.now()),
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt ?? Date.now()),
    };
  }
}
