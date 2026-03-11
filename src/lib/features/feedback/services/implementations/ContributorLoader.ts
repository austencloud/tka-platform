/**
 * ContributorLoader
 *
 * Firestore operations for managing developer contributors
 * who can be credited on changelog entries.
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  documentId,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { IContributorLoader } from "../contracts/IContributorLoader";
import type { Contributor } from "../../domain/models/contributor-models";

const CONTRIBUTORS_COLLECTION = "contributors";

/** Firestore `in` queries cap out at 30 items per clause */
const FIRESTORE_IN_LIMIT = 30;

export class ContributorLoader implements IContributorLoader {
  async getAll(): Promise<Contributor[]> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, CONTRIBUTORS_COLLECTION),
      orderBy("displayName", "asc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return this.mapDocToContributor(docSnap.id, data);
    });
  }

  async getById(id: string): Promise<Contributor | null> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, CONTRIBUTORS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToContributor(docSnap.id, docSnap.data());
  }

  async getByIds(ids: string[]): Promise<Contributor[]> {
    if (ids.length === 0) {
      return [];
    }

    const firestore = await getFirestoreInstance();
    const unique = [...new Set(ids)];

    // Firestore `in` queries accept at most 30 values per clause,
    // so we chunk and merge results.
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += FIRESTORE_IN_LIMIT) {
      chunks.push(unique.slice(i, i + FIRESTORE_IN_LIMIT));
    }

    const results: Contributor[] = [];

    for (const chunk of chunks) {
      const q = query(
        collection(firestore, CONTRIBUTORS_COLLECTION),
        where(documentId(), "in", chunk)
      );

      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        results.push(this.mapDocToContributor(docSnap.id, docSnap.data()));
      }
    }

    return results;
  }

  async add(contributor: Omit<Contributor, "id">): Promise<string> {
    const firestore = await getFirestoreInstance();
    const docRef = await addDoc(
      collection(firestore, CONTRIBUTORS_COLLECTION),
      {
        displayName: contributor.displayName,
        avatarUrl: contributor.avatarUrl,
        ...(contributor.userId ? { userId: contributor.userId } : {}),
      }
    );

    return docRef.id;
  }

  async update(
    id: string,
    data: Partial<Omit<Contributor, "id">>
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, CONTRIBUTORS_COLLECTION, id);
    await updateDoc(docRef, { ...data });
  }

  async delete(id: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, CONTRIBUTORS_COLLECTION, id);
    await deleteDoc(docRef);
  }

  private mapDocToContributor(
    id: string,
    data: Record<string, unknown>
  ): Contributor {
    const contributor: Contributor = {
      id,
      displayName: data["displayName"] as string,
      avatarUrl: data["avatarUrl"] as string,
    };

    const userId = data["userId"] as string | undefined;
    if (userId) {
      contributor.userId = userId;
    }

    return contributor;
  }
}
