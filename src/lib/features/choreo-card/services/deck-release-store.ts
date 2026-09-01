import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  getDeckReleaseCounterPath,
  getDeckReleaseManifestPath,
  getDeckReleaseManifestsPath,
} from "$lib/shared/library/data/firestore-paths";
import {
  INSERT_CARD_VERSION,
  type DeckRelease,
  type DeckReleaseCard,
  type DeckRecipe,
} from "../domain/models/DeckRelease";

export async function getNextDeckNumber(): Promise<number> {
  const db = await getFirestoreInstance();
  const counterRef = doc(db, getDeckReleaseCounterPath());
  const snap = await getDoc(counterRef);
  return snap.exists() ? (snap.data().next as number) : 1;
}

export interface ReleaseMeta {
  name: string;
  description: string;
  leftPropType: string;
  rightPropType: string;
}

export async function releaseDeck(
  cards: DeckReleaseCard[],
  theme: string,
  notes: string,
  meta: ReleaseMeta,
  recipe?: DeckRecipe,
): Promise<DeckRelease> {
  const db = await getFirestoreInstance();
  const counterRef = doc(db, getDeckReleaseCounterPath());

  const release = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const deckNumber = counterSnap.exists()
      ? (counterSnap.data().next as number)
      : 1;

    const distribution: Record<number, number> = {};
    for (const card of cards) {
      distribution[card.stepCount] = (distribution[card.stepCount] ?? 0) + 1;
    }

    const manifest: DeckRelease = {
      deckNumber,
      createdAt: new Date().toISOString(),
      name: meta.name,
      description: meta.description,
      theme,
      leftPropType: meta.leftPropType,
      rightPropType: meta.rightPropType,
      cardCount: cards.length,
      notes,
      sequences: cards,
      stepCountDistribution: distribution,
      insertCard: { version: INSERT_CARD_VERSION },
      // Firestore rejects `undefined` fields — only attach recipe when present.
      ...(recipe ? { recipe } : {}),
    };

    const manifestRef = doc(db, getDeckReleaseManifestPath(deckNumber));
    tx.set(manifestRef, manifest);
    tx.set(counterRef, { next: deckNumber + 1 }, { merge: true });

    return manifest;
  });

  return release;
}

/** Patch the editable name/description of an already-released deck. */
export async function updateDeckMeta(
  deckNumber: number,
  patch: { name?: string; description?: string },
): Promise<void> {
  const db = await getFirestoreInstance();
  const manifestRef = doc(db, getDeckReleaseManifestPath(deckNumber));
  await setDoc(manifestRef, patch, { merge: true });
}

export async function getAllReleases(): Promise<DeckRelease[]> {
  const db = await getFirestoreInstance();
  const manifestsRef = collection(db, getDeckReleaseManifestsPath());
  const snapshot = await getDocs(manifestsRef);
  return snapshot.docs
    .map(d => d.data() as DeckRelease)
    .sort((a, b) => b.deckNumber - a.deckNumber);
}

/**
 * Permanently delete a released deck's manifest. The release counter is left
 * untouched — deck numbers are permanent identifiers (content hashes, scan /
 * short codes, and released-id pruning all key off them), so a freed number is
 * never reused.
 */
export async function deleteDeck(deckNumber: number): Promise<void> {
  const db = await getFirestoreInstance();
  await deleteDoc(doc(db, getDeckReleaseManifestPath(deckNumber)));
}

export async function getAllReleasedSequenceIds(): Promise<Set<string>> {
  const releases = await getAllReleases();
  const ids = new Set<string>();
  for (const release of releases) {
    for (const card of release.sequences ?? []) {
      ids.add(card.sequenceId);
    }
  }
  return ids;
}
