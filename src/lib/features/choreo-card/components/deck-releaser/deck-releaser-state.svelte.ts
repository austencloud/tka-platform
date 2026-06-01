import type { DeckRelease, DeckReleaseCard, DeckRecipe, StepCountWeight } from "../../domain/models/DeckRelease";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption, TnDSeedClass } from "../../services/deck-composer";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { DEFAULT_VARIATION_CONFIG, type VariationConfig, type StartOriMode } from "../../services/deck-variation";
import type { ResolvedReversalPattern } from "../../domain/reversal-transform";
import { mintSeed, GENERATOR_VERSION } from "../../services/deck-recipe";

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
  variationConfig?: VariationConfig;
  /** @deprecated single-select — migrated to startOriModes (multi-select). */
  startOriMode?: StartOriMode;
  startOriModes?: StartOriMode[];
  gridModes?: ("diamond" | "box")[];
  reversalPattern?: ResolvedReversalPattern | null;
  /** LOOP pool slice filter. */
  sliceTypes?: ("halved" | "quartered")[];
  /** Explicit draw seed (Reroll mints a new one). */
  seed?: string;
  /** LOOP loop-type axis. */
  loopTypes?: string[];
  /** LOOP level axis. */
  levels?: number[];
  /** LOOP start-position id subset (empty ⇒ any). */
  startPositionIds?: string[];
  /** Style axes (Smooth/Mixed/Choppy · Low/Mixed/High). */
  propStyle?: "smooth" | "mixed" | "choppy";
  handStyle?: "smooth" | "mixed" | "choppy";
  dashStyle?: "low" | "mixed" | "high";
  /** Fixed sequence length. */
  selectedLength?: number;
  /** Max turn intensity (0–3). */
  turnIntensity?: number;
  /** Selected TnD family ids. */
  tndFamilyIds?: string[];
  /** Selected TnD turn-pattern ids. */
  tndTurnPatternIds?: string[];
  /** LOOP step-count weights (the per-count weight values; `available` is
   *  re-derived from the live pool on load). */
  weights?: StepCountWeight[];
  /** Composed-but-unreleased deck. Light card recipes only — sequences are
   *  re-derived on mount, never stored. Omitted while viewing a release (those
   *  re-fetch from Firestore by deck number). */
  cards?: DeckReleaseCard[];
}

// localStorage (not session): a composed draft survives a full tab/browser
// close, not just refresh + HMR, so an in-progress deck is never lost.
function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(s: PersistedSession) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
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
  brokenLoopCount = $state(0);
  variationConfig = $state<VariationConfig>({ ...DEFAULT_VARIATION_CONFIG });
  /** Selected start-orientation registers. Multi-select → full enumeration
   *  (each base card is emitted once per selected register). Never empty. */
  selectedStartOriModes = $state<Set<StartOriMode>>(new Set(["radial"]));
  /** Selected grid modes (diamond/box). Multi-select → full enumeration
   *  (each base card emitted once per selected grid mode). Never empty. */
  selectedGridModes = $state<Set<"diamond" | "box">>(new Set(["diamond"]));
  /** Deck-wide reversal pattern built in the strip (build-one-apply-all). Null
   *  → no reversal. Stamped onto every card's variation at compose time. */
  reversalPattern = $state<ResolvedReversalPattern | null>(null);
  get theme() {
    // Fire Drums 2026: every deck-releaser card BACK ships the Rainbow theme,
    // regardless of the user's current background OR a released deck's saved
    // theme. Hardcoded until per-deck back-theme selection exists. `theme` only
    // drives the back (+ info cards) — fronts are element-accent-colored — so
    // this affects backs only. Returning a fixed value also rotates the card
    // cache key, forcing stale (blue, pre-fix) cached backs to re-render fresh.
    return "rainbow";
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
  /** Explicit draw seed. Reroll mints a new one; reproduce reuses it. */
  seed = $state<string>(mintSeed());
  /** LOOP loop-type axis (multi-select; draws from any selected type). */
  selectedLoopTypes = $state<Set<string>>(new Set(["rotated"]));
  /** LOOP level axis (multi-select). */
  selectedLevels = $state<Set<number>>(new Set([1]));
  /** LOOP start-position id subset. Empty ⇒ any start position. */
  selectedStartPositionIds = $state<Set<string>>(new Set());
  /** Style axes (Smooth/Mixed/Choppy). Props drives per-card prop-reversal density
   *  (→ variationConfig.reversalFrequency, live). Hands + Dashes are stamped into
   *  the recipe as intent — the enumerated pool can't vary them yet (live-gen phase). */
  propStyle = $state<"smooth" | "mixed" | "choppy">("mixed");
  handStyle = $state<"smooth" | "mixed" | "choppy">("mixed");
  dashStyle = $state<"low" | "mixed" | "high">("mixed");
  /** Fixed sequence length — every LOOP card is generated at this step count. */
  selectedLength = $state<number>(8);
  /** Max turn intensity for live generation (generator model: 0–3 scalar). */
  turnIntensity = $state<number>(1);
  /** Live-generation progress (cards generated so far this draw). */
  drawProgress = $state(0);
  /** Per-seed grid-correct TnD classification (selection-independent). */
  tndSeedClasses = $state<TnDSeedClass[]>([]);
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
      if (saved.variationConfig) this.variationConfig = saved.variationConfig;
      if (saved.startOriModes?.length) {
        this.selectedStartOriModes = new Set(saved.startOriModes);
      } else if (saved.startOriMode) {
        // Migrate legacy single-select sessions.
        this.selectedStartOriModes = new Set([saved.startOriMode]);
      }
      if (saved.gridModes?.length) {
        this.selectedGridModes = new Set(saved.gridModes);
      }
      if (saved.reversalPattern) this.reversalPattern = saved.reversalPattern;
      // Configure-step dials: restore the user's last selections so going Back to
      // the catalog (or refreshing) shows what they had set, not defaults.
      if (saved.sliceTypes?.length) this.selectedSliceTypes = new Set(saved.sliceTypes);
      if (saved.seed) this.seed = saved.seed;
      if (saved.loopTypes?.length) this.selectedLoopTypes = new Set(saved.loopTypes);
      if (saved.levels?.length) this.selectedLevels = new Set(saved.levels);
      if (saved.startPositionIds?.length) this.selectedStartPositionIds = new Set(saved.startPositionIds);
      if (saved.propStyle) this.propStyle = saved.propStyle;
      if (saved.handStyle) this.handStyle = saved.handStyle;
      if (saved.dashStyle) this.dashStyle = saved.dashStyle;
      if (saved.selectedLength) this.selectedLength = saved.selectedLength;
      if (saved.turnIntensity != null) this.turnIntensity = saved.turnIntensity;
      if (saved.tndFamilyIds?.length) this.selectedTnDFamilies = new Set(saved.tndFamilyIds);
      if (saved.tndTurnPatternIds?.length) this.selectedTnDTurnPatterns = new Set(saved.tndTurnPatternIds);
      if (saved.weights?.length) this.weights = saved.weights;
      // Restore a composed draft so an HMR re-eval / refresh / tab reopen lands
      // back on the deck. Sequences re-derive in the tab's onMount. Skip when
      // the session was viewing a release — that path re-fetches by deck number.
      if (saved.cards?.length && saved.viewingDeckNumber == null) {
        this.cards = saved.cards;
      }
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
      variationConfig: this.variationConfig,
      startOriModes: [...this.selectedStartOriModes],
      gridModes: [...this.selectedGridModes],
      reversalPattern: this.reversalPattern,
      sliceTypes: [...this.selectedSliceTypes],
      seed: this.seed,
      loopTypes: [...this.selectedLoopTypes],
      levels: [...this.selectedLevels],
      startPositionIds: [...this.selectedStartPositionIds],
      propStyle: this.propStyle,
      handStyle: this.handStyle,
      dashStyle: this.dashStyle,
      selectedLength: this.selectedLength,
      turnIntensity: this.turnIntensity,
      tndFamilyIds: [...this.selectedTnDFamilies],
      tndTurnPatternIds: [...this.selectedTnDTurnPatterns],
      weights: this.weights,
      // Persist the draft only while composing fresh. Released-deck views re-load
      // from Firestore, so storing their cards would bloat localStorage for free.
      cards: this.viewingRelease ? undefined : this.cards,
    });
  }

  /** Toggle a register in/out of the selection. Refuses to empty the set —
   *  at least one register must always be active. Reassigns for reactivity. */
  toggleStartOriMode(mode: StartOriMode) {
    const next = new Set(this.selectedStartOriModes);
    if (next.has(mode)) {
      if (next.size === 1) return; // keep at least one
      next.delete(mode);
    } else {
      next.add(mode);
    }
    this.selectedStartOriModes = next;
    this.persist();
  }

  /** Toggle a grid mode in/out of the selection. Never empties (≥1 active). */
  toggleGridMode(mode: "diamond" | "box") {
    const next = new Set(this.selectedGridModes);
    if (next.has(mode)) {
      if (next.size === 1) return;
      next.delete(mode);
    } else {
      next.add(mode);
    }
    this.selectedGridModes = next;
    this.persist();
  }

  get savedViewingDeckNumber(): number | null {
    return loadSession()?.viewingDeckNumber ?? null;
  }

  /** Project the current dials into a frozen recipe for stamping onto a release.
   *  Mode-scoped: only the active mode's dials are emitted (plus shared transform
   *  dials). `available` is stripped from weights — it is a live pool count, not a
   *  recipe input, and a stale snapshot would mislead on reuse. */
  toRecipe(): DeckRecipe {
    const recipe: DeckRecipe = {
      deckMode: this.deckMode,
      startOriModes: [...this.selectedStartOriModes],
      gridModes: [...this.selectedGridModes],
      reversalPattern: this.reversalPattern,
    };
    if (this.deckMode === "loop") {
      recipe.weights = this.weights.map((w) => ({ stepCount: w.stepCount, weight: w.weight }));
      recipe.totalCards = this.totalCards;
      recipe.sliceTypes = [...this.selectedSliceTypes];
      recipe.variationConfig = this.variationConfig;
      recipe.seed = this.seed;
      recipe.generatorVersion = GENERATOR_VERSION;
      recipe.schemaVersion = 1;
      recipe.loopTypes = [...this.selectedLoopTypes];
      recipe.levels = [...this.selectedLevels];
      if (this.selectedStartPositionIds.size > 0) recipe.startPositionIds = [...this.selectedStartPositionIds];
      recipe.propStyle = this.propStyle;
      recipe.handStyle = this.handStyle;
      recipe.dashStyle = this.dashStyle;
      recipe.length = this.selectedLength;
      recipe.turnIntensity = this.turnIntensity;
    } else {
      recipe.tndFamilyIds = [...this.selectedTnDFamilies];
      recipe.tndTurnPatternIds = [...this.selectedTnDTurnPatterns];
    }
    return recipe;
  }

  /** Load a stamped recipe back into the configure dials and reset to a fresh,
   *  unreleased compose. Clears any composed draft / viewed release so Draw yields
   *  a brand-new deck — for LOOP a fresh random subset from the same recipe, for
   *  TnD the same deterministic enumeration. Pool `available` counts re-derive on
   *  the Configure mount, so a reused recipe self-heals against pool changes. */
  loadRecipe(recipe: DeckRecipe) {
    this.cards = [];
    this.sequences = [];
    this.releasedNumber = null;
    this.viewingRelease = null;
    this.name = "";
    this.description = "";
    this.themeOverride = null;
    this.bluePropOverride = null;
    this.redPropOverride = null;
    this.brokenLoopCount = 0;

    this.deckMode = recipe.deckMode;
    this.selectedStartOriModes = new Set(recipe.startOriModes.length ? recipe.startOriModes : ["radial"]);
    this.selectedGridModes = new Set(recipe.gridModes.length ? recipe.gridModes : ["diamond"]);
    this.reversalPattern = recipe.reversalPattern ?? null;

    if (recipe.deckMode === "loop") {
      // Restore weight values onto the live pool rows so `available` stays current.
      if (recipe.weights?.length) {
        const byStep = new Map(recipe.weights.map((w) => [w.stepCount, w.weight]));
        this.weights = this.weights.length
          ? this.weights.map((w) => ({ ...w, weight: byStep.get(w.stepCount) ?? w.weight }))
          : recipe.weights.map((w) => ({ ...w, available: 0 }));
      }
      if (recipe.totalCards != null) this.totalCards = recipe.totalCards;
      if (recipe.sliceTypes?.length) this.selectedSliceTypes = new Set(recipe.sliceTypes);
      if (recipe.variationConfig) this.variationConfig = recipe.variationConfig;
      // Seed + new axes: reproduce a stamped deck exactly. Legacy recipes (no seed)
      // mint a fresh one so they still draw; loop-type defaults to rotated (legacy pool).
      this.seed = recipe.seed ?? mintSeed();
      this.selectedLoopTypes = new Set(recipe.loopTypes?.length ? recipe.loopTypes : ["rotated"]);
      this.selectedLevels = new Set(recipe.levels?.length ? recipe.levels : [1]);
      this.selectedStartPositionIds = new Set(recipe.startPositionIds ?? []);
      if (recipe.propStyle) this.propStyle = recipe.propStyle;
      if (recipe.handStyle) this.handStyle = recipe.handStyle;
      if (recipe.dashStyle) this.dashStyle = recipe.dashStyle;
      if (recipe.length) this.selectedLength = recipe.length;
      if (recipe.turnIntensity != null) this.turnIntensity = recipe.turnIntensity;
    } else {
      this.selectedTnDFamilies = new Set(recipe.tndFamilyIds ?? []);
      this.selectedTnDTurnPatterns = new Set(recipe.tndTurnPatternIds ?? []);
    }

    this.step = "configure";
    this.persist();
  }

  /** New draw, same dials: mint a fresh seed and clear the composed draft so the
   *  next compose draws afresh. Dials (loop type, level, weights, …) untouched. */
  reroll() {
    this.seed = mintSeed();
    this.cards = [];
    this.sequences = [];
    this.persist();
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
    this.brokenLoopCount = 0;
    this.seed = mintSeed();
    this.selectedLoopTypes = new Set(["rotated"]);
    this.selectedLevels = new Set([1]);
    this.selectedStartPositionIds = new Set();
    this.step = "configure";
    this.persist();
  }
}

export const releaserState = new DeckReleaserState();
