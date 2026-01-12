/**
 * Global Arrow Adjustment Persister
 *
 * Handles Firestore persistence for global arrow adjustments.
 * Uses a top-level collection since adjustments are global (not per-user).
 *
 * Collection: global_arrow_adjustments
 * Document ID: {gridMode}|{oriKey}|{letter}|{turnsTuple}|{arrowKey}
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  generateAdjustmentKeyString,
  type GlobalArrowAdjustment,
  type GlobalArrowAdjustmentInput,
} from "../../domain/GlobalArrowAdjustment";
import type { IGlobalArrowAdjustmentPersister } from "../contracts/IGlobalArrowAdjustmentPersister";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("GlobalArrowAdjustmentPersister");

const COLLECTION_NAME = "global_arrow_adjustments";

export class GlobalArrowAdjustmentPersister
  implements IGlobalArrowAdjustmentPersister
{
  private unsubscribe: Unsubscribe | null = null;

  /**
   * Load all global adjustments from Firestore
   */
  async loadAll(): Promise<GlobalArrowAdjustment[]> {
    try {
      const firestore = await getFirestoreInstance();
      const colRef = collection(firestore, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);

      const adjustments: GlobalArrowAdjustment[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Validate required fields
        if (
          data.gridMode &&
          data.oriKey &&
          data.letter &&
          data.turnsTuple &&
          data.arrowKey &&
          typeof data.adjustmentX === "number" &&
          typeof data.adjustmentY === "number"
        ) {
          adjustments.push({
            gridMode: data.gridMode,
            oriKey: data.oriKey,
            letter: data.letter,
            turnsTuple: data.turnsTuple,
            arrowKey: data.arrowKey,
            adjustmentX: data.adjustmentX,
            adjustmentY: data.adjustmentY,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy ?? "unknown",
          });
        } else {
          logger.warn(`Invalid adjustment document: ${docSnap.id}`);
        }
      });

      logger.success(`Loaded ${adjustments.length} global adjustments`);
      return adjustments;
    } catch (error) {
      logger.error("Failed to load adjustments:", error);
      throw error;
    }
  }

  /**
   * Save a single adjustment to Firestore
   */
  async save(
    input: GlobalArrowAdjustmentInput,
    userEmail: string
  ): Promise<void> {
    const keyString = generateAdjustmentKeyString({
      gridMode: input.gridMode,
      oriKey: input.oriKey,
      letter: input.letter,
      turnsTuple: input.turnsTuple,
      arrowKey: input.arrowKey,
    });

    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, keyString);

      await setDoc(docRef, {
        gridMode: input.gridMode,
        oriKey: input.oriKey,
        letter: input.letter,
        turnsTuple: input.turnsTuple,
        arrowKey: input.arrowKey,
        adjustmentX: input.adjustmentX,
        adjustmentY: input.adjustmentY,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });

      logger.success(
        `Saved adjustment: ${keyString} → (${input.adjustmentX}, ${input.adjustmentY})`
      );
    } catch (error) {
      logger.error(`Failed to save adjustment ${keyString}:`, error);
      throw error;
    }
  }

  /**
   * Delete an adjustment from Firestore
   */
  async delete(keyString: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, keyString);
      await deleteDoc(docRef);
      logger.success(`Deleted adjustment: ${keyString}`);
    } catch (error) {
      logger.error(`Failed to delete adjustment ${keyString}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates from Firestore
   */
  subscribe(
    onAdd: (adjustment: GlobalArrowAdjustment) => void,
    onRemove: (keyString: string) => void
  ): () => void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Start async subscription
    getFirestoreInstance()
      .then((firestoreDb) => {
        const colRef = collection(firestoreDb, COLLECTION_NAME);

        this.unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              const keyString = change.doc.id;

              if (change.type === "added" || change.type === "modified") {
                if (
                  data.gridMode &&
                  data.oriKey &&
                  data.letter &&
                  data.turnsTuple &&
                  data.arrowKey &&
                  typeof data.adjustmentX === "number" &&
                  typeof data.adjustmentY === "number"
                ) {
                  onAdd({
                    gridMode: data.gridMode,
                    oriKey: data.oriKey,
                    letter: data.letter,
                    turnsTuple: data.turnsTuple,
                    arrowKey: data.arrowKey,
                    adjustmentX: data.adjustmentX,
                    adjustmentY: data.adjustmentY,
                    updatedAt: data.updatedAt,
                    updatedBy: data.updatedBy ?? "unknown",
                  });
                }
              } else if (change.type === "removed") {
                onRemove(keyString);
              }
            });
          },
          (subscriptionError: unknown) => {
            logger.error("Subscription error:", subscriptionError);
          }
        );
      })
      .catch((initError: unknown) => {
        logger.error("Failed to initialize subscription:", initError);
      });

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
