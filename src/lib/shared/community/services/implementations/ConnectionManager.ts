/**
 * ConnectionManager Implementation
 *
 * Manages user-to-user connection data:
 * - Private notes about other users
 * - Mutual follow status with timestamps
 * - Shared sequences (matching canonical signatures)
 *
 * Data stored at: users/{myId}/connections/{theirId}
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  limit as firestoreLimit,
} from "firebase/firestore";
import type { Timestamp, DocumentData } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import type { ConnectionInfo, MutualFollowInfo, SharedSequenceSummary, ConnectionDocument } from "../types";

/**
 * Firestore follow document structure
 */
interface FollowDocument {
  createdAt: Timestamp;
}

/**
 * Minimal sequence data for signature matching
 */
interface SequenceWithSignature {
  id: string;
  name: string;
  word: string;
  canonicalSignature?: string;
  thumbnails?: string[];
}

export class ConnectionManager {
  private readonly USERS_COLLECTION = "users";
  private readonly CONNECTIONS_SUBCOLLECTION = "connections";
  private readonly SEQUENCES_SUBCOLLECTION = "sequences";
  private readonly FOLLOWING_SUBCOLLECTION = "following";
  private readonly FOLLOWERS_SUBCOLLECTION = "followers";

  /**
   * Get the current user's ID or throw if not authenticated
   */
  private getCurrentUserId(): string {
    const userId = authState.user?.uid;
    if (!userId) {
      throw new Error("Must be authenticated to manage connections");
    }
    return userId;
  }

  /**
   * Get full connection info for a user
   */
  async getConnectionInfo(targetUserId: string): Promise<ConnectionInfo> {
    const currentUserId = this.getCurrentUserId();

    if (currentUserId === targetUserId) {
      throw new Error("Cannot get connection info for yourself");
    }

    // Fetch all data in parallel
    const [notes, notesMetadata, mutualFollow, sharedSequences] =
      await Promise.all([
        this.getNotes(targetUserId),
        this.getNotesMetadata(targetUserId),
        this.getMutualFollowInfo(targetUserId),
        this.getSharedSequences(targetUserId, 10),
      ]);

    return {
      notes,
      notesCreatedAt: notesMetadata?.createdAt,
      notesUpdatedAt: notesMetadata?.updatedAt,
      mutualFollow,
      sharedSequences,
      sharedSequenceCount: sharedSequences.length,
    };
  }

  /**
   * Save private notes about a user
   */
  async saveNotes(targetUserId: string, notes: string): Promise<void> {
    const currentUserId = this.getCurrentUserId();

    if (currentUserId === targetUserId) {
      throw new Error("Cannot save notes about yourself");
    }

    try {
      const firestore = await getFirestoreInstance();
      const connectionRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/${this.CONNECTIONS_SUBCOLLECTION}/${targetUserId}`
      );

      // Check if document exists to determine if we're creating or updating
      const existingDoc = await getDoc(connectionRef);

      if (existingDoc.exists()) {
        // Update existing
        await setDoc(
          connectionRef,
          {
            notes: notes.trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        // Create new
        await setDoc(connectionRef, {
          notes: notes.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("[ConnectionManager] Error saving notes:", error);
      throw new Error("Failed to save notes");
    }
  }

  /**
   * Get notes for a user
   */
  async getNotes(targetUserId: string): Promise<string> {
    const currentUserId = this.getCurrentUserId();

    if (currentUserId === targetUserId) {
      return "";
    }

    try {
      const firestore = await getFirestoreInstance();
      const connectionRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/${this.CONNECTIONS_SUBCOLLECTION}/${targetUserId}`
      );

      const connectionDoc = await getDoc(connectionRef);

      if (!connectionDoc.exists()) {
        return "";
      }

      const data = connectionDoc.data() as ConnectionDocument;
      return data.notes ?? "";
    } catch (error) {
      console.error("[ConnectionManager] Error getting notes:", error);
      return "";
    }
  }

  /**
   * Get notes metadata (timestamps)
   */
  private async getNotesMetadata(
    targetUserId: string
  ): Promise<{ createdAt?: Date; updatedAt?: Date } | null> {
    const currentUserId = this.getCurrentUserId();

    try {
      const firestore = await getFirestoreInstance();
      const connectionRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/${this.CONNECTIONS_SUBCOLLECTION}/${targetUserId}`
      );

      const connectionDoc = await getDoc(connectionRef);

      if (!connectionDoc.exists()) {
        return null;
      }

      const data = connectionDoc.data() as ConnectionDocument;
      return {
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      };
    } catch (error) {
      console.error("[ConnectionManager] Error getting notes metadata:", error);
      return null;
    }
  }

  /**
   * Get mutual follow status
   */
  async getMutualFollowInfo(targetUserId: string): Promise<MutualFollowInfo> {
    const currentUserId = this.getCurrentUserId();

    if (currentUserId === targetUserId) {
      return {
        isMutual: false,
        iFollowThem: false,
        theyFollowMe: false,
      };
    }

    try {
      const firestore = await getFirestoreInstance();

      // Check if I follow them
      const iFollowThemRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/${this.FOLLOWING_SUBCOLLECTION}/${targetUserId}`
      );

      // Check if they follow me
      const theyFollowMeRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${targetUserId}/${this.FOLLOWING_SUBCOLLECTION}/${currentUserId}`
      );

      const [iFollowThemDoc, theyFollowMeDoc] = await Promise.all([
        getDoc(iFollowThemRef),
        getDoc(theyFollowMeRef),
      ]);

      const iFollowThem = iFollowThemDoc.exists();
      const theyFollowMe = theyFollowMeDoc.exists();
      const isMutual = iFollowThem && theyFollowMe;

      // Extract timestamps
      const iFollowedAt = iFollowThem
        ? (iFollowThemDoc.data() as FollowDocument)?.createdAt?.toDate()
        : undefined;
      const theyFollowedAt = theyFollowMe
        ? (theyFollowMeDoc.data() as FollowDocument)?.createdAt?.toDate()
        : undefined;

      // Mutual since = the later of the two follow dates
      let mutualSince: Date | undefined;
      if (isMutual && iFollowedAt && theyFollowedAt) {
        mutualSince =
          iFollowedAt > theyFollowedAt ? iFollowedAt : theyFollowedAt;
      }

      return {
        isMutual,
        iFollowThem,
        theyFollowMe,
        mutualSince,
        iFollowedAt,
        theyFollowedAt,
      };
    } catch (error) {
      console.error("[ConnectionManager] Error getting follow info:", error);
      return {
        isMutual: false,
        iFollowThem: false,
        theyFollowMe: false,
      };
    }
  }

  /**
   * Find sequences we both have (matching canonical signatures)
   */
  async getSharedSequences(
    targetUserId: string,
    limit = 10
  ): Promise<SharedSequenceSummary[]> {
    const currentUserId = this.getCurrentUserId();

    if (currentUserId === targetUserId) {
      return [];
    }

    try {
      const firestore = await getFirestoreInstance();

      // Get my sequences with canonical signatures
      const mySequencesRef = collection(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/${this.SEQUENCES_SUBCOLLECTION}`
      );
      const myQuery = query(
        mySequencesRef,
        where("canonicalSignature", "!=", null),
        firestoreLimit(200) // Reasonable limit to avoid excessive reads
      );

      // Get their public sequences with canonical signatures
      const theirSequencesRef = collection(
        firestore,
        `${this.USERS_COLLECTION}/${targetUserId}/${this.SEQUENCES_SUBCOLLECTION}`
      );
      const theirQuery = query(
        theirSequencesRef,
        where("visibility", "==", "public"),
        where("canonicalSignature", "!=", null),
        firestoreLimit(200)
      );

      const [mySnapshot, theirSnapshot] = await Promise.all([
        getDocs(myQuery),
        getDocs(theirQuery),
      ]);

      // Build a map of their sequences by canonical signature
      const theirSignatureMap = new Map<string, SequenceWithSignature>();
      for (const docSnap of theirSnapshot.docs) {
        const data = docSnap.data() as DocumentData;
        if (data.canonicalSignature) {
          theirSignatureMap.set(data.canonicalSignature, {
            id: docSnap.id,
            name: data.name ?? data.word ?? "Untitled",
            word: data.word ?? "",
            canonicalSignature: data.canonicalSignature,
            thumbnails: data.thumbnails,
          });
        }
      }

      // Find matches
      const sharedSequences: SharedSequenceSummary[] = [];
      for (const docSnap of mySnapshot.docs) {
        const myData = docSnap.data() as DocumentData;
        const signature = myData.canonicalSignature;

        if (signature && theirSignatureMap.has(signature)) {
          const theirSeq = theirSignatureMap.get(signature)!;

          sharedSequences.push({
            canonicalSignature: signature,
            mySequence: {
              id: docSnap.id,
              name: myData.name ?? myData.word ?? "Untitled",
              word: myData.word ?? "",
              thumbnailUrl: myData.thumbnails?.[0],
            },
            theirSequence: {
              id: theirSeq.id,
              name: theirSeq.name,
              word: theirSeq.word,
              thumbnailUrl: theirSeq.thumbnails?.[0],
            },
          });

          if (sharedSequences.length >= limit) {
            break;
          }
        }
      }

      return sharedSequences;
    } catch (error) {
      console.error("[ConnectionManager] Error getting shared sequences:", error);
      return [];
    }
  }
}
