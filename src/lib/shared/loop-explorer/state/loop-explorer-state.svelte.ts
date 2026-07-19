/**
 * Loop Explorer — Reactive State (factory + context)
 *
 * Owns the picker selection, the current verified example, and the
 * bidirectional highlight link between the showcase grid and the
 * explanation pane (hover/click a relation sentence -> highlight its beat
 * pair; click a beat -> highlight its relations). One instance per
 * `LoopExplorer.svelte` mount, provided via context per the
 * state-management skill (factory returns a plain object with getter
 * accessors — no class, no module-level singleton).
 */
import { getContext, setContext } from "svelte";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import {
  evaluateChip,
  evaluateSelection,
  type ChipLegality,
  type LoopSlice,
  type SelectionLegality,
} from "../domain/legality";
import { generateVerifiedExample, type VerifiedExample } from "../services/explorer-generator";
import { buildExplanation, type LoopExplanation } from "../services/explanation-builder";

export type ExplorerStatus = "idle" | "loading" | "ready" | "empty";

export interface LoopExplorerDeps {
  generate: typeof generateVerifiedExample;
}

const defaultDeps: LoopExplorerDeps = { generate: generateVerifiedExample };

/** Default opening selection: a legal, visually representative combo. */
const DEFAULT_SELECTION: readonly LOOPComponent[] = [LOOPComponent.ROTATED];

export function createLoopExplorerState(deps: LoopExplorerDeps = defaultDeps) {
  let selected = $state<Set<LOOPComponent>>(new Set(DEFAULT_SELECTION));
  let slice = $state<LoopSlice>("halved");
  let example = $state<VerifiedExample | null>(null);
  let explanation = $state<LoopExplanation | null>(null);
  let status = $state<ExplorerStatus>("idle");
  /** 1-based beat index currently highlighted (from a beat click/hover OR a relation citation). */
  let highlightedBeat = $state<number | null>(null);
  /** Index into `explanation.citations`/`example.relations` currently highlighted. */
  let highlightedRelation = $state<number | null>(null);
  /** Race guard: a stale in-flight generation must not clobber a newer one. */
  let generationToken = 0;

  const legality = $derived<SelectionLegality>(evaluateSelection(selected));

  function chipLegality(component: LOOPComponent): ChipLegality {
    return evaluateChip(selected, component);
  }

  function toggleComponent(component: LOOPComponent): void {
    const next = new Set(selected);
    if (next.has(component)) next.delete(component);
    else next.add(component);
    selected = next;
    void refresh();
  }

  function setSlice(next: LoopSlice): void {
    if (slice === next) return;
    slice = next;
    void refresh();
  }

  async function refresh(): Promise<void> {
    const current = evaluateSelection(selected);
    if (!current.legal || !current.loopType) {
      example = null;
      explanation = null;
      status = "empty";
      return;
    }

    const token = ++generationToken;
    status = "loading";
    clearHighlight();

    const result = await deps.generate(selected, slice);

    if (token !== generationToken) return; // superseded by a newer selection/slice change

    if (!result) {
      example = null;
      explanation = null;
      status = "empty";
      return;
    }

    example = result;
    explanation = buildExplanation({
      components: selected,
      slice: result.slice,
      relations: result.relations,
      seedLength: result.seedLength,
      totalLength: result.sequence.steps.length,
    });
    status = "ready";
  }

  function hoverRelation(index: number | null): void {
    highlightedRelation = index;
    highlightedBeat = null;
  }

  function selectRelation(index: number | null): void {
    highlightedRelation = index;
    highlightedBeat = null;
  }

  function hoverBeat(beatNumber: number | null): void {
    highlightedBeat = beatNumber;
    highlightedRelation = null;
  }

  function selectBeat(beatNumber: number | null): void {
    highlightedBeat = beatNumber;
    highlightedRelation = null;
  }

  function clearHighlight(): void {
    highlightedBeat = null;
    highlightedRelation = null;
  }

  /** Relation indices touching `beatNumber` (a beat can appear as beatA or beatB). */
  function relationsForBeat(beatNumber: number): number[] {
    if (!example) return [];
    const indices: number[] = [];
    example.relations.forEach((r, i) => {
      if (r.beatA === beatNumber || r.beatB === beatNumber) indices.push(i);
    });
    return indices;
  }

  /** Beat numbers touched by the relation at `index` (empty when out of range). */
  function beatsForRelation(index: number): number[] {
    const r = example?.relations[index];
    return r ? [r.beatA, r.beatB] : [];
  }

  return {
    get selected() {
      return selected;
    },
    get slice() {
      return slice;
    },
    get example() {
      return example;
    },
    get explanation() {
      return explanation;
    },
    get status() {
      return status;
    },
    get legality() {
      return legality;
    },
    get highlightedBeat() {
      return highlightedBeat;
    },
    get highlightedRelation() {
      return highlightedRelation;
    },
    chipLegality,
    toggleComponent,
    setSlice,
    refresh,
    hoverRelation,
    selectRelation,
    hoverBeat,
    selectBeat,
    clearHighlight,
    relationsForBeat,
    beatsForRelation,
  };
}

export type LoopExplorerState = ReturnType<typeof createLoopExplorerState>;

const LOOP_EXPLORER_KEY = Symbol("loop-explorer-state");

export function setLoopExplorerContext(state: LoopExplorerState): void {
  setContext(LOOP_EXPLORER_KEY, state);
}

export function getLoopExplorerContext(): LoopExplorerState {
  const state = getContext<LoopExplorerState | undefined>(LOOP_EXPLORER_KEY);
  if (!state) {
    throw new Error(
      "getLoopExplorerContext() called outside <LoopExplorer> — mount the picker/showcase/pane as its descendants."
    );
  }
  return state;
}
