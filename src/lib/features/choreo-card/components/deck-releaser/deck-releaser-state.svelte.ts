import type { DeckRelease, DeckReleaseCard, StepCountWeight } from "../../domain/models/DeckRelease";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption } from "../../services/deck-composer";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

type Step = "configure" | "review" | "released";

const STORAGE_KEY = "deckReleaser.session";

interface PersistedSession {
  step: Step;
  viewingDeckNumber: number | null;
  deckMode: "loop" | "tnd";
  totalCards: number;
  notes: string;
  name: string;
  description: string;
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
  name = $state("");
  description = $state("");
  // When viewing a released deck, these pin the render to the deck's release-time
  // visual settings so the content-hash cache key matches what was cached. Null
  // while composing a fresh deck (follow live settings).
  themeOverride = $state<string | null>(null);
  bluePropOverride = $state<PropType | null>(null);
  redPropOverride = $state<PropType | null>(null);
  get theme() {
    return this.themeOverride ?? settingsService.settings.backgroundType ?? "cosmic";
  }
  get bluePropType(): PropType {
    return this.bluePropOverride ?? settingsService.settings.bluePropType ?? PropType.STAFF;
  }
  get redPropType(): PropType {
    return this.redPropOverride ?? settingsService.settings.redPropType ?? PropType.STAFF;
  }
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
      this.name = saved.name ?? "";
      this.description = saved.description ?? "";
    }
  }

  persist() {
    saveSession({
      step: this.step,
      viewingDeckNumber: this.viewingRelease?.deckNumber ?? null,
      deckMode: this.deckMode,
      totalCards: this.totalCards,
      notes: this.notes,
      name: this.name,
      description: this.description,
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
    this.name = "";
    this.description = "";
    this.themeOverride = null;
    this.bluePropOverride = null;
    this.redPropOverride = null;
    this.step = "configure";
    this.persist();
  }
}

export const releaserState = new DeckReleaserState();
