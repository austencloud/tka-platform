import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  FieldPath,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { firestoreList, firestoreSet } from "$lib/shared/firestore";
import {
  DefaultArrowPlacementDocSchema,
  generateDefaultDocId,
  parseDefaultDocId,
  type DefaultArrowPlacementDoc,
  type PlacementValue,
} from "../domain/DefaultArrowPlacement";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("DefaultArrowPlacementPersister");

const COLLECTION_NAME = "default_arrow_adjustments";

export class DefaultArrowPlacementPersister {
  private unsubscribe: Unsubscribe | null = null;

  async loadAll(): Promise<DefaultArrowPlacementDoc[]> {
    try {
      const docs = await firestoreList(COLLECTION_NAME, DefaultArrowPlacementDocSchema);
      logger.success(`Loaded ${docs.length} default placement docs`);
      return docs as unknown as DefaultArrowPlacementDoc[];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("permission")) {
        logger.warn("Insufficient permissions — using JSON baseline");
        return [];
      }
      logger.error("Failed to load default placement docs:", error);
      throw error;
    }
  }

  /** Merge a single base value into the {gridMode}_{propType}_{motionType} doc. */
  async saveValue(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
    userEmail: string,
  ): Promise<void> {
    const id = generateDefaultDocId(gridMode, propType, motionType);
    try {
      await firestoreSet(
        COLLECTION_NAME,
        id,
        {
          gridMode,
          propType,
          motionType,
          placements: { [placementKey]: { [turns]: value } },
          updatedBy: userEmail,
        } as Record<string, unknown>,
        { merge: true },
      );
      logger.success(`Saved default ${id} ${placementKey}/${turns} → (${value[0]}, ${value[1]})`);
    } catch (error) {
      logger.error(`Failed to save default ${id} ${placementKey}/${turns}:`, error);
      throw error;
    }
  }

  /** Remove a single base value (revert that key/turns to the JSON baseline). */
  async deleteValue(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): Promise<void> {
    const id = generateDefaultDocId(gridMode, propType, motionType);
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, id);
      // FieldPath, not a dotted string: the `turns` segment ("1.5") contains a dot.
      await updateDoc(docRef, new FieldPath("placements", placementKey, turns), deleteField());
      logger.success(`Deleted default ${id} ${placementKey}/${turns}`);
    } catch (error) {
      logger.error(`Failed to delete default ${id} ${placementKey}/${turns}:`, error);
      throw error;
    }
  }

  subscribe(onChange: (doc: DefaultArrowPlacementDoc) => void): () => void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    getFirestoreInstance()
      .then((firestoreDb) => {
        const colRef = collection(firestoreDb, COLLECTION_NAME);
        this.unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") return; // docs are never deleted wholesale
              const data = change.doc.data();
              const decoded = parseDefaultDocId(change.doc.id);
              if (decoded && data.placements) {
                onChange({
                  id: change.doc.id,
                  gridMode: data.gridMode ?? decoded.gridMode,
                  propType: data.propType ?? decoded.propType,
                  motionType: data.motionType ?? decoded.motionType,
                  placements: data.placements,
                  updatedAt: data.updatedAt,
                  updatedBy: data.updatedBy ?? "unknown",
                });
              }
            });
          },
          (error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("permission")) {
              logger.warn("Default placement subscription not accessible (permissions).");
            } else {
              logger.error("Subscription error:", error);
            }
          },
        );
      })
      .catch((error: unknown) => {
        logger.error("Failed to initialize subscription:", error);
      });

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
