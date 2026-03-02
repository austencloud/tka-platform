import { collection, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { IDeckLoader } from "../contracts/IDeckLoader";
import type { Deck } from "../../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  getSystemDecksPath,
  getSystemDeckSequencesPath,
} from "$lib/features/library/data/firestore-paths";

/**
 * Derive the TKA letter from a grid position string.
 * Alpha positions → α, Beta → β, Gamma → γ
 */
function letterFromGridPosition(gridPosition: unknown): Letter | null {
  if (!gridPosition) return null;
  const pos = String(gridPosition).toLowerCase();
  if (pos.startsWith("alpha")) return Letter.ALPHA;
  if (pos.startsWith("beta")) return Letter.BETA;
  if (pos.startsWith("gamma")) return Letter.GAMMA;
  return null;
}

/**
 * Hydrate raw motion data by running through createMotionData()
 * to fill in defaults (arrowPlacementData, propPlacementData, etc.)
 */
function hydrateMotions(
  motions: PictographData["motions"] | undefined
): Partial<Record<MotionColor, MotionData>> {
  const hydrated: Partial<Record<MotionColor, MotionData>> = {};
  for (const [color, motion] of Object.entries(motions ?? {})) {
    if (motion) {
      hydrated[color as MotionColor] = createMotionData(motion);
    }
  }
  return hydrated;
}

function hydrateSteps(
  steps: readonly StepData[] | undefined
): readonly StepData[] {
  if (!steps || steps.length === 0) return [];
  return steps.map((step) => ({
    ...step,
    motions: hydrateMotions(step.motions),
  }));
}

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
    return snapshot.docs.map((d) => {
      const raw = { id: d.id, ...d.data() };
      const seq = createSequenceData(raw);

      // Hydrate startPosition: fill motion placement defaults + derive letter from grid position
      const startPosition = seq.startPosition
        ? {
            ...seq.startPosition,
            motions: hydrateMotions(seq.startPosition.motions),
            letter: seq.startPosition.letter ?? letterFromGridPosition(seq.startPosition.gridPosition),
          }
        : undefined;

      return {
        ...seq,
        steps: hydrateSteps(seq.steps),
        ...(startPosition && { startPosition }),
      };
    });
  }
}
