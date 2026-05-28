import type { DeckRelease, DeckReleaseCard, StepCountWeight } from "../../domain/models/DeckRelease";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption } from "../../services/deck-composer";

type Step = "configure" | "review" | "released";

const STORAGE_KEY = "deckReleaser.session";

interface PersistedSession {
  step: Step;
  viewingDeckNumber: number | null;
  deckMode: "loop" | "tnd";
  totalCards: number;
  notes: string;
}

function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(s: PersistedSession) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

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
  tndFamilies = $state<TnDFamilyOption[]>([]);
  tndTurnPatterns = $state<TnDTurnPatternOption[]>([]);
  deckMode = $state<"loop" | "tnd">("loop");
  selectedTnDFamilies = $state<Set<string>>(new Set());
  selectedTnDTurnPatterns = $state<Set<string>>(new Set());
  viewingRelease = $state<DeckRelease | null>(null);
  isReleasing = $state(false);
  isLoadingSequences = $state(false);
  isLoadingPools = $state(true);
  drawGeneration = 0;
  poolsLoaded = false;

  constructor() {
    const saved = loadSession();
    if (saved) {
      this.step = saved.step;
      this.deckMode = saved.deckMode;
      this.totalCards = saved.totalCards;
      this.notes = saved.notes;
    }
  }

  persist() {
    saveSession({
      step: this.step,
      viewingDeckNumber: this.viewingRelease?.deckNumber ?? null,
      deckMode: this.deckMode,
      totalCards: this.totalCards,
      notes: this.notes,
    });
  }

  get savedViewingDeckNumber(): number | null {
    return loadSession()?.viewingDeckNumber ?? null;
  }

  reset() {
    this.cards = [];
    this.sequences = [];
    this.releasedNumber = null;
    this.viewingRelease = null;
    this.step = "configure";
    this.persist();
  }
}

export const releaserState = new DeckReleaserState();
