import { collection, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { IDeckLoader } from "../contracts/IDeckLoader";
import type { Deck } from "../../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  getSystemDecksPath,
  getSystemDeckSequencesPath,
} from "$lib/features/library/data/firestore-paths";

export class DeckLoader implements IDeckLoader {
  async loadDecks(): Promise<Deck[]> {
    const db = await getFirestoreInstance();
    const decksRef = collection(db, getSystemDecksPath());
    const snapshot = await getDocs(decksRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Deck);
  }

  async loadDeckSequences(deckId: string): Promise<SequenceData[]> {
    const db = await getFirestoreInstance();
    const seqRef = collection(db, getSystemDeckSequencesPath(deckId));
    const snapshot = await getDocs(seqRef);
    return snapshot.docs.map((d) =>
      createSequenceData({ id: d.id, ...d.data() })
    );
  }
}
