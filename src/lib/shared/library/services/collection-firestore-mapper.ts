/**
 * Shared Firestore mapping utilities for collection-related services.
 *
 * Converts raw Firestore documents into typed domain models and handles
 * batched sequence fetching (chunked to Firestore's 30-item 'in' query limit).
 */

import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import { LibrarySequenceDocSchema } from "$lib/shared/library/domain/library-schemas";

/**
 * Error class for collection operations
 */
export class CollectionError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_OPERATION"
      | "SYSTEM_COLLECTION"
      | "NETWORK",
    public collectionId?: string
  ) {
    super(message);
    this.name = "CollectionError";
  }
}
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";

/**
 * Get the current user ID or throw if not authenticated
 */
export function getAuthenticatedUserId(): string {
  const userId = authState.effectiveUserId;
  if (!userId) {
    throw new CollectionError("User not authenticated", "UNAUTHORIZED");
  }
  return userId;
}

/**
 * Convert Firestore timestamp to Date
 */
export function toDate(timestamp: unknown): Date {
  if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date();
}

/**
 * Map Firestore document to LibraryCollection
 */
export function mapDocToCollection(
  data: DocumentData,
  id: string
): LibraryCollection {
  return {
    id,
    name: data["name"] ?? "",
    description: data["description"],
    ownerId: data["ownerId"] ?? "",
    sequenceIds: data["sequenceIds"] ?? [],
    sequenceCount: data["sequenceCount"] ?? 0,
    coverImageUrl: data["coverImageUrl"],
    color: data["color"],
    icon: data["icon"] ?? "fa-folder",
    isPublic: data["isPublic"] ?? false,
    sortOrder: data["sortOrder"] ?? 0,
    systemType: data["systemType"],
    createdAt: toDate(data["createdAt"]),
    updatedAt: toDate(data["updatedAt"]),
  };
}

/**
 * Map Firestore document to LibrarySequence (simplified)
 */
export function mapDocToSequence(
  data: DocumentData,
  id: string
): LibrarySequence {
  return {
    ...data,
    id,
    createdAt: toDate(data["createdAt"]),
    updatedAt: toDate(data["updatedAt"]),
  } as LibrarySequence;
}

const BATCH_SIZE = 30; // Firestore 'in' query limit

/**
 * Batch fetch sequences by IDs to avoid N+1 query pattern.
 * Firestore 'in' queries are limited to 30 items, so we chunk.
 */
export async function batchFetchSequences(
  firestore: Firestore,
  userId: string,
  sequenceIds: readonly string[],
  filterPublic = false
): Promise<LibrarySequence[]> {
  if (sequenceIds.length === 0) {
    return [];
  }

  // Client cap is 500 members/collection, but nothing in the rules enforces it.
  // When another user opens a hostile PUBLIC collection, an oversized
  // sequenceIds array would fan out into one `in` read per 30 ids against the
  // viewer's quota. Cap the work; legitimate collections never exceed 500.
  const MAX_FETCH = 500;
  const ids =
    sequenceIds.length > MAX_FETCH ? sequenceIds.slice(0, MAX_FETCH) : sequenceIds;
  if (sequenceIds.length > MAX_FETCH) {
    console.warn(
      `[collection-firestore-mapper] sequenceIds length ${sequenceIds.length} exceeds ${MAX_FETCH}; capping the fetch.`
    );
  }

  const sequences: LibrarySequence[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const sequencesRef = collection(firestore, `users/${userId}/sequences`);
    const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
    const batchSnapshot = await getDocs(batchQuery);

    for (const docSnap of batchSnapshot.docs) {
      const data = docSnap.data();
      if (filterPublic && data["visibility"] !== "public") {
        continue;
      }
      sequences.push(mapDocToSequence(data, docSnap.id));
    }
  }

  return sequences;
}

/**
 * Fetch sequences from the public index by ID.
 * Used when a sequence ID doesn't resolve in the user's own library,
 * e.g. when they've favorited someone else's public sequence.
 */
export async function batchFetchPublicSequences(
  firestore: Firestore,
  sequenceIds: string[]
): Promise<LibrarySequence[]> {
  const results: LibrarySequence[] = [];

  for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
    const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
    const publicRef = collection(firestore, "publicSequences");
    const q = query(publicRef, where(documentId(), "in", chunk));
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      // Public-index docs are untrusted input - validate the shape before
      // mapping. The schema also converts Firestore Timestamps to Dates and
      // fills count defaults (forkCount/viewCount/starCount -> 0).
      const parsed = LibrarySequenceDocSchema.safeParse({
        id: docSnap.id,
        ...docSnap.data(),
      });
      if (!parsed.success) {
        console.warn(
          `[collection-firestore-mapper] Validation failed for publicSequences/${docSnap.id}, skipping:`,
          parsed.error.issues
        );
        continue;
      }

      const sequence = mapDocToSequence(parsed.data as DocumentData, docSnap.id);
      results.push({
        ...sequence,
        source: "imported",
        visibility: "public",
        collectionIds: [],
        sequenceTags: [],
        tagIds: [],
      });
    }
  }

  return results;
}
