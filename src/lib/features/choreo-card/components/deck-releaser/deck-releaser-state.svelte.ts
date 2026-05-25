import type { DeckReleaseCard, StepCountWeight } from "../../domain/models/DeckRelease";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { CatalogSourceSummary, VtgFamilyOption } from "../../services/deck-composer";

type Step = "configure" | "review" | "released";

class DeckReleaserState {
  step = $state<Step>("configure");
  cards = $state<DeckReleaseCard[]>([]);
  sequences = $state<SequenceData[]>([]);
  weights = $state<StepCountWeight[]>([]);
  totalCards = $state(52);
  notes = $state("Fire Drums 2026");
  theme = $state(
    typeof window !== "undefined"
      ? localStorage.getItem("cardPreview.theme") ?? "cosmic"
      : "cosmic"
  );
  nextDeckNumber = $state(1);
  releasedNumber = $state<number | null>(null);
  sourceSummaries = $state<CatalogSourceSummary[]>([]);
  selectedSliceTypes = $state<Set<"halved" | "quartered">>(new Set(["quartered"]));
  vtgFamilies = $state<VtgFamilyOption[]>([]);
  deckMode = $state<"loop" | "vtg">("loop");
  selectedVtgFamilies = $state<Set<string>>(new Set());
  isReleasing = $state(false);
  isLoadingSequences = $state(false);
  isLoadingPools = $state(true);
  drawGeneration = 0;
  poolsLoaded = false;

  reset() {
    this.cards = [];
    this.sequences = [];
    this.releasedNumber = null;
    this.step = "configure";
  }
}

export const releaserState = new DeckReleaserState();
