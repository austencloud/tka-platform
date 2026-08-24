import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  TUNNEL_COMPOSITION_VERSION,
  createDerivedTunnelPerformer,
  createIndependentTunnelPerformer,
  type TunnelComposition,
  type TunnelPerformer,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import {
  DEFAULT_CONFIG,
  configKey,
  type TunnelConfig,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import {
  TUNNEL_CREATOR_DRAFT_VERSION,
  type TunnelCreatorDraft,
  type TunnelSourceHistoryEntry,
  type TunnelSourceOrigin,
  type TunnelWorkspacePanel,
} from "../domain/tunnel-creator-draft";
import {
  DEFAULT_TUNNEL_RELATIONSHIP,
  tunnelRelationshipFromOps,
  tunnelRelationshipOps,
  updateTunnelRelationship,
  type TunnelRelationshipRule,
} from "../domain/tunnel-relationship-rule";

const INITIAL_VISIBLE_PERFORMERS = 2;
const MAX_SOURCE_HISTORY = 12;

export type TunnelCreatorMode = "separate" | "linked";
export type TunnelPickerTarget = string;

interface TunnelPerformerSlot {
  id: string;
  label: string;
  performer: TunnelPerformer | null;
  independentSequence: SequenceData | null;
  origin: TunnelSourceOrigin | null;
  previous: TunnelSourceHistoryEntry[];
  timing: TunnelPerformer["timing"];
}

export interface TunnelCreatorDependencies {
  openComposition: (composition: TunnelComposition) => void;
  initialComposition?: TunnelComposition;
  initialDraft?: TunnelCreatorDraft | null;
  initialFormation?: TunnelConfig;
  editingTunnel?: { id: string; name: string };
  now?: () => number;
  createId?: () => string;
}

/**
 * Owns Tunnel authoring state. The UI currently renders two slots, but the
 * state is an ordered stable-ID roster so later phases can expose all eight
 * without replacing the persistence or generation contracts again.
 */
export function createTunnelCreatorState(
  dependencies: TunnelCreatorDependencies
) {
  const now = dependencies.now ?? Date.now;
  const createId =
    dependencies.createId ??
    (() =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const restoredDraft = dependencies.initialComposition
    ? null
    : (dependencies.initialDraft ?? null);
  const initial =
    dependencies.initialComposition ?? restoredDraft?.composition ?? undefined;
  const compositionId = initial?.id ?? createId();
  const createdAt = initial?.createdAt ?? now();
  const restoredSources = new Map(
    (restoredDraft?.sourceStates ?? []).map((source) => [
      source.performerId,
      source,
    ])
  );

  function createSlot(
    index: number,
    performer: TunnelPerformer | null = null
  ): TunnelPerformerSlot {
    const id =
      performer?.id ??
      restoredDraft?.sourceStates[index]?.performerId ??
      `performer-${createId()}`;
    const sourceState = restoredSources.get(id);
    const independentSequence =
      sourceState?.independentSequence ??
      (performer?.source.kind === "independent"
        ? performer.source.sequence
        : null);
    const label = `Performer ${index + 1}`;

    return {
      id,
      label,
      performer: performer ? { ...performer, label } : null,
      independentSequence,
      origin:
        sourceState?.origin ??
        (performer?.source.kind === "independent" ? "picked" : null),
      previous: sourceState?.previous.map((entry) => ({ ...entry })) ?? [],
      timing: { ...(performer?.timing ?? { stepOffset: 0, speed: 1 }) },
    };
  }

  const initialSlots = (initial?.performers ?? []).map((performer, index) =>
    createSlot(index, performer)
  );
  while (initialSlots.length < INITIAL_VISIBLE_PERFORMERS) {
    initialSlots.push(createSlot(initialSlots.length));
  }

  let mode = $state<TunnelCreatorMode>(
    dependencies.initialComposition
      ? initialSlots[1]?.performer?.source.kind === "independent"
        ? "separate"
        : "linked"
      : (restoredDraft?.mode ??
          (initialSlots[1]?.performer?.source.kind === "independent"
            ? "separate"
            : "linked"))
  );
  let slots = $state<TunnelPerformerSlot[]>(initialSlots);
  let relationship = $state<TunnelRelationshipRule>({
    ...(initialSlots[1]?.performer?.source.kind === "derived"
      ? tunnelRelationshipFromOps(initialSlots[1].performer.source.transforms)
      : (restoredDraft?.relationship ?? DEFAULT_TUNNEL_RELATIONSHIP)),
  });
  let formation = $state<TunnelConfig>({
    ...(dependencies.initialFormation ?? initial?.formation ?? DEFAULT_CONFIG),
    speedOverrides: {
      ...(dependencies.initialFormation?.speedOverrides ??
        initial?.formation.speedOverrides ??
        DEFAULT_CONFIG.speedOverrides),
    },
  });
  let pickerTarget = $state<TunnelPickerTarget | null>(null);
  let opening = $state(false);
  const restoredGenerationTarget =
    restoredDraft?.workspace.generationTargetId &&
    initialSlots.some(
      (slot) => slot.id === restoredDraft.workspace.generationTargetId
    )
      ? restoredDraft.workspace.generationTargetId
      : null;
  const restoredPanel = restoredDraft?.workspace.activePanel ?? null;
  let activePanel = $state<TunnelWorkspacePanel>(
    restoredPanel === "generation" && !restoredGenerationTarget
      ? null
      : restoredPanel === "pairing" && mode !== "linked"
        ? null
        : restoredPanel
  );
  let generationTargetId = $state<string | null>(
    activePanel === "generation" ? restoredGenerationTarget : null
  );

  function currentLead(): TunnelPerformer | null {
    return slots[0]?.performer ?? null;
  }

  function currentPartner(): TunnelPerformer | null {
    return slots[1]?.performer ?? null;
  }

  function isReady(): boolean {
    const lead = currentLead();
    const partner = currentPartner();
    return (
      lead !== null &&
      partner !== null &&
      (mode === "linked" || partner.source.kind === "independent")
    );
  }

  function performerFromIndependentSource(
    slot: TunnelPerformerSlot,
    sequence: SequenceData
  ): TunnelPerformer {
    const performer = createIndependentTunnelPerformer(
      sequence,
      slots.indexOf(slot),
      slot.label
    );
    performer.id = slot.id;
    performer.timing = { ...slot.timing };
    return performer;
  }

  function linkedPerformer(
    source: TunnelPerformer,
    target: TunnelPerformerSlot
  ): TunnelPerformer {
    const performer = createDerivedTunnelPerformer(
      source.id,
      1,
      tunnelRelationshipOps(relationship),
      target.label
    );
    performer.id = target.id;
    performer.timing = { ...target.timing };
    return performer;
  }

  function rebuildLinkedPartner(): void {
    const source = slots[0]?.performer;
    const target = slots[1];
    if (!target) return;
    const performer = source ? linkedPerformer(source, target) : null;
    slots = slots.map((slot, index) =>
      index === 1 ? { ...slot, performer } : slot
    );
  }

  function replaceIndependentSequence(
    targetId: string,
    sequence: SequenceData,
    origin: TunnelSourceOrigin,
    rememberCurrent: boolean
  ): boolean {
    const slot = slots.find((candidate) => candidate.id === targetId);
    if (!slot) return false;

    const isSameSource = slot.independentSequence?.id === sequence.id;
    const slotIndex = slots.indexOf(slot);
    const previous =
      rememberCurrent && slot.independentSequence && !isSameSource
        ? [
            ...slot.previous,
            {
              sequence: slot.independentSequence,
              origin: slot.origin ?? "picked",
            },
          ].slice(-MAX_SOURCE_HISTORY)
        : slot.previous;
    const performer =
      slotIndex !== 1 || mode !== "linked"
        ? performerFromIndependentSource(slot, sequence)
        : slot.performer;

    slots = slots.map((candidate, index) =>
      index === slotIndex
        ? {
            ...candidate,
            independentSequence: sequence,
            origin,
            previous,
            performer,
          }
        : candidate
    );

    if (slots[0]?.id === targetId && mode === "linked") {
      rebuildLinkedPartner();
    } else if (slotIndex === 1 && mode === "linked") {
      rebuildLinkedPartner();
    }
    return true;
  }

  function setPerformerSequence(
    targetId: string,
    sequence: SequenceData,
    origin: TunnelSourceOrigin = "picked"
  ): boolean {
    return replaceIndependentSequence(targetId, sequence, origin, true);
  }

  function setLeadSequence(sequence: SequenceData): void {
    const targetId = slots[0]?.id;
    if (targetId) setPerformerSequence(targetId, sequence, "picked");
  }

  function setPartnerSequence(sequence: SequenceData): void {
    const targetId = slots[1]?.id;
    if (targetId) setPerformerSequence(targetId, sequence, "picked");
  }

  function restorePreviousSequence(targetId: string): boolean {
    const slot = slots.find((candidate) => candidate.id === targetId);
    const previous = slot?.previous.at(-1);
    if (!slot || !previous) return false;
    slots = slots.map((candidate) =>
      candidate.id === targetId
        ? { ...candidate, previous: candidate.previous.slice(0, -1) }
        : candidate
    );
    return replaceIndependentSequence(
      targetId,
      previous.sequence,
      previous.origin,
      false
    );
  }

  function setMode(next: TunnelCreatorMode): void {
    if (mode === next) return;
    mode = next;
    if (next === "separate" && activePanel === "pairing") {
      activePanel = null;
    }
    const target = slots[1];
    if (!target) return;

    if (next === "linked") {
      rebuildLinkedPartner();
      return;
    }

    const performer = target.independentSequence
      ? performerFromIndependentSource(target, target.independentSequence)
      : null;
    slots = slots.map((slot, index) =>
      index === 1 ? { ...slot, performer } : slot
    );
  }

  function setRelationship(patch: Partial<TunnelRelationshipRule>): void {
    relationship = updateTunnelRelationship(relationship, patch);
    if (mode === "linked") rebuildLinkedPartner();
  }

  function setPartnerTiming(patch: Partial<TunnelPerformer["timing"]>): void {
    const slot = slots[1];
    if (!slot) return;
    const timing = {
      ...slot.timing,
      ...patch,
      stepOffset: Math.max(
        0,
        Math.round(patch.stepOffset ?? slot.timing.stepOffset)
      ),
      speed: Math.max(0.25, patch.speed ?? slot.timing.speed),
    };
    const performer = slot.performer
      ? { ...slot.performer, timing: { ...timing } }
      : null;
    slots = slots.map((candidate, index) =>
      index === 1 ? { ...candidate, timing, performer } : candidate
    );
  }

  function setFormation(next: TunnelConfig): void {
    if (configKey(next) === configKey(formation)) return;
    formation = {
      ...next,
      speedOverrides: { ...next.speedOverrides },
    };
  }

  function openWorkspacePanel(
    panel: Exclude<TunnelWorkspacePanel, "generation" | null>
  ): void {
    activePanel = panel;
    generationTargetId = null;
  }

  function openGenerationPanel(targetId: string): boolean {
    if (!selectGenerationTarget(targetId)) return false;
    activePanel = "generation";
    return true;
  }

  function selectGenerationTarget(targetId: string): boolean {
    if (!slots.some((slot) => slot.id === targetId)) return false;
    generationTargetId = targetId;
    return true;
  }

  function closeWorkspacePanel(): void {
    activePanel = null;
    generationTargetId = null;
  }

  function activePerformers(): TunnelPerformer[] {
    return slots
      .map((slot) => slot.performer)
      .filter((performer): performer is TunnelPerformer => performer !== null);
  }

  function compositionWithFormation(
    nextFormation: TunnelConfig = formation
  ): TunnelComposition | null {
    const lead = currentLead();
    const partner = currentPartner();
    if (!lead || !partner || !isReady()) return null;
    const timestamp = now();
    const leadName =
      lead.source.kind === "independent"
        ? lead.source.sequence.name ||
          lead.source.sequence.word ||
          "Performer 1"
        : "Performer 1";
    const partnerName =
      partner.source.kind === "independent"
        ? partner.source.sequence.name ||
          partner.source.sequence.word ||
          "Performer 2"
        : "Linked partner";
    return {
      version: TUNNEL_COMPOSITION_VERSION,
      id: compositionId,
      name: initial?.name ?? `${leadName} + ${partnerName}`,
      performers: activePerformers(),
      formation: {
        ...nextFormation,
        speedOverrides: { ...nextFormation.speedOverrides },
      },
      createdAt,
      updatedAt: timestamp,
    };
  }

  function draftSnapshot(): TunnelCreatorDraft {
    const performers = activePerformers();
    const timestamp = now();
    const composition =
      performers.length === 0
        ? null
        : {
            version: TUNNEL_COMPOSITION_VERSION,
            id: compositionId,
            name: initial?.name ?? "Untitled tunnel",
            performers,
            formation: {
              ...formation,
              speedOverrides: { ...formation.speedOverrides },
            },
            createdAt,
            updatedAt: timestamp,
          };

    return {
      version: TUNNEL_CREATOR_DRAFT_VERSION,
      mode,
      composition,
      relationship: { ...relationship },
      sourceStates: slots.map((slot) => ({
        performerId: slot.id,
        label: slot.label,
        independentSequence: slot.independentSequence,
        origin: slot.origin,
        previous: slot.previous.map((entry) => ({ ...entry })),
      })),
      workspace: { activePanel, generationTargetId },
      editingTunnel:
        dependencies.editingTunnel ?? restoredDraft?.editingTunnel ?? null,
    };
  }

  async function openInViewer(nextFormation: TunnelConfig): Promise<void> {
    const composition = compositionWithFormation(nextFormation);
    if (!composition || opening) return;
    opening = true;
    try {
      dependencies.openComposition(composition);
    } finally {
      opening = false;
    }
  }

  return {
    get mode() {
      return mode;
    },
    get lead() {
      return currentLead();
    },
    get partner() {
      return currentPartner();
    },
    get leadSequence() {
      const lead = currentLead();
      return lead?.source.kind === "independent" ? lead.source.sequence : null;
    },
    get partnerSequence() {
      const partner = currentPartner();
      return partner?.source.kind === "independent"
        ? partner.source.sequence
        : null;
    },
    get relationship() {
      return relationship;
    },
    get relationshipOps() {
      return tunnelRelationshipOps(relationship);
    },
    get pickerTarget() {
      return pickerTarget;
    },
    get activePanel() {
      return activePanel;
    },
    get generationTargetId() {
      return generationTargetId;
    },
    get ready() {
      return isReady();
    },
    get opening() {
      return opening;
    },
    get initialFormation() {
      return formation;
    },
    get editingTunnel() {
      return dependencies.editingTunnel ?? restoredDraft?.editingTunnel ?? null;
    },
    get performerSlots() {
      return slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        performer: slot.performer,
      }));
    },
    performerIdAt(index: number) {
      return slots[index]?.id ?? null;
    },
    sourceOrigin(targetId: string) {
      return slots.find((slot) => slot.id === targetId)?.origin ?? null;
    },
    previousCount(targetId: string) {
      return slots.find((slot) => slot.id === targetId)?.previous.length ?? 0;
    },
    setMode,
    setPerformerSequence,
    setLeadSequence,
    setPartnerSequence,
    restorePreviousSequence,
    setRelationship,
    setPartnerTiming,
    setFormation,
    openWorkspacePanel,
    openGenerationPanel,
    selectGenerationTarget,
    closeWorkspacePanel,
    openPicker(target: TunnelPickerTarget) {
      if (slots.some((slot) => slot.id === target)) pickerTarget = target;
    },
    closePicker() {
      pickerTarget = null;
    },
    compositionWithFormation,
    draftSnapshot,
    openInViewer,
  };
}

export type TunnelCreatorState = ReturnType<typeof createTunnelCreatorState>;
