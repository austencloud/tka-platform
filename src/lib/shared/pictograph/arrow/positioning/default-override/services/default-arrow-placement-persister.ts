import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
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
} from "../domain/default-arrow-placement";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("DefaultArrowPlacementPersister");

const COLLECTION_NAME = "default_arrow_adjustments";
const HISTORY_COLLECTION_NAME = "default_arrow_adjustment_history";

/** The single field the selected-arrow history query filters on. */
function buildEntryKey(
  gridMode: string,
  propType: string,
  motionType: string,
  placementKey: string,
  turns: string,
): string {
  return `${generateDefaultDocId(gridMode, propType, motionType)}|${placementKey}|${turns}`;
}

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
    prevValue: PlacementValue | null = null,
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
      this.appendHistory(
        gridMode, propType, motionType, placementKey, turns,
        "save", value, prevValue, userEmail,
      );
    } catch (error) {
      logger.error(`Failed to save default ${id} ${placementKey}/${turns}:`, error);
      throw error;
    }
  }

  /**
   * Append an immutable audit record. Fire-and-forget — never blocks or fails
   * the save/delete it records. Mirrors the global persister's appendHistory.
   */
  private async appendHistory(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
    action: "save" | "delete",
    newValue: PlacementValue | null,
    prevValue: PlacementValue | null,
    userEmail: string,
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const historyDoc = doc(collection(firestore, HISTORY_COLLECTION_NAME));
      await setDoc(historyDoc, {
        gridMode,
        propType,
        motionType,
        placementKey,
        turns,
        entryKey: buildEntryKey(gridMode, propType, motionType, placementKey, turns),
        action,
        newX: newValue ? newValue[0] : null,
        newY: newValue ? newValue[1] : null,
        prevX: prevValue ? prevValue[0] : null,
        prevY: prevValue ? prevValue[1] : null,
        timestamp: serverTimestamp(),
        updatedBy: userEmail,
      });
    } catch (error) {
      logger.warn("Failed to write default placement history:", error);
    }
  }

  /** Remove a single base value (revert that key/turns to the JSON baseline). */
  async deleteValue(
    gridMode: string,
    propType: string,
    motionType: string,
    placementKey: string,
    turns: string,
    userEmail: string = "unknown",
    prevValue: PlacementValue | null = null,
  ): Promise<void> {
    const id = generateDefaultDocId(gridMode, propType, motionType);
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, id);
      // FieldPath, not a dotted string: the `turns` segment ("1.5") contains a dot.
      await updateDoc(docRef, new FieldPath("placements", placementKey, turns), deleteField());
      logger.success(`Deleted default ${id} ${placementKey}/${turns}`);
      this.appendHistory(
        gridMode, propType, motionType, placementKey, turns,
        "delete", null, prevValue, userEmail,
      );
    } catch (error) {
      // Already at JSON baseline: no Firestore doc/field to remove. `updateDoc`
      // on a nonexistent doc throws not-found — that's a successful no-op here,
      // not a failure. Swallow it; rethrow anything else. No history row: nothing
      // changed.
      const code = (error as { code?: string })?.code;
      const msg = error instanceof Error ? error.message : String(error);
      if (code === "not-found" || msg.includes("No document to update")) {
        logger.info(`No default override to delete for ${id} ${placementKey}/${turns} (already at baseline)`);
        return;
      }
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
