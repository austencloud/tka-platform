import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  getDeckReleaseCounterPath,
  getDeckReleaseManifestPath,
} from "$lib/shared/library/data/firestore-paths";
import type { DeckRelease, DeckReleaseCard } from "../domain/models/DeckRelease";

export async function getNextDeckNumber(): Promise<number> {
  const db = await getFirestoreInstance();
  const counterRef = doc(db, getDeckReleaseCounterPath());
  const snap = await getDoc(counterRef);
  return snap.exists() ? (snap.data().next as number) : 1;
}

export async function releaseDeck(
  cards: DeckReleaseCard[],
  theme: string,
  notes: string,
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
      theme,
      cardCount: cards.length,
      notes,
      sequences: cards,
      stepCountDistribution: distribution,
    };

    const manifestRef = doc(db, getDeckReleaseManifestPath(deckNumber));
    tx.set(manifestRef, manifest);
    tx.set(counterRef, { next: deckNumber + 1 }, { merge: true });

    return manifest;
  });

  return release;
}

export async function getDeckRelease(deckNumber: number): Promise<DeckRelease | null> {
  const db = await getFirestoreInstance();
  const manifestRef = doc(db, getDeckReleaseManifestPath(deckNumber));
  const snap = await getDoc(manifestRef);
  return snap.exists() ? (snap.data() as DeckRelease) : null;
}
