<script lang="ts">
  /**
   * Designations Panel
   *
   * Unified display for all designation types (whole, section, beat pair).
   * This is the "what you're building" panel - the single source of truth.
   * Supports multiple candidate designations with individual confirm/deny.
   */
  import type {
    LOOPDesignation,
    CandidateDesignation,
    StepPairGroups,
  } from "../../domain/models/label-models";
  import type { SectionDesignation } from "../../domain/models/section-models";
  import type { StepPairRelationship } from "../../domain/models/steppair-models";
  import type { PolyrhythmicLOOPResult } from "../../services/implementations/PolyrhythmicDetector";
  import type {
    CompoundPattern,
    AxisAlternatingPattern,
  } from "../../services/contracts/ILOOPDetector";
  import { onDestroy } from "svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import StepPairAnalysisDisplay from "../shared/StepPairAnalysisDisplay.svelte";
  import CandidatesSection from "./designations/CandidatesSection.svelte";
  import PolyrhythmicDisplay from "./designations/PolyrhythmicDisplay.svelte";
  import CompoundPatternDisplay from "./designations/CompoundPatternDisplay.svelte";
  import DesignationsList from "./designations/DesignationsList.svelte";
  import ActionButtons from "./designations/ActionButtons.svelte";
  import DeleteConfirmSection from "./designations/DeleteConfirmSection.svelte";

  interface Props {
    wholeDesignations: LOOPDesignation[];
    sectionDesignations: SectionDesignation[];
    stepPairDesignations: StepPairRelationship[];
    isFreeform: boolean;
    isModular?: boolean;
    isPolyrhythmic?: boolean;
    polyrhythmic?: PolyrhythmicLOOPResult | null;
    compoundPattern?: CompoundPattern | null;
    isAxisAlternating?: boolean;
    axisAlternatingPattern?: AxisAlternatingPattern | null;
    needsVerification?: boolean;
    verifiedToast?: boolean;
    autoDetectedDesignations?: LOOPDesignation[];
    candidateDesignations?: CandidateDesignation[];
    autoDetectedBeatPairs?: StepPairRelationship[];
    autoDetectedBeatPairGroups?: StepPairGroups;
    onRemoveWholeDesignation: (index: number) => void;
    onRemoveSectionDesignation: (index: number) => void;
    onRemoveStepPairDesignation: (index: number) => void;
    onSetFreeform: () => void;
    onMarkUnknown: () => void;
    onSaveAndNext: () => void;
    onConfirmAutoLabel?: () => void;
    onConfirmCandidate?: (index: number) => void;
    onDenyCandidate?: (index: number) => void;
    onConfirmAllCandidates?: () => void;
    onDeleteSequence?: () => Promise<void>;
    canSave: boolean;
    sequenceWord?: string;
  }

  let {
    wholeDesignations,
    sectionDesignations,
    stepPairDesignations,
    isFreeform,
    isModular = false,
    isPolyrhythmic = false,
    polyrhythmic = null,
    compoundPattern = null,
    isAxisAlternating = false,
    axisAlternatingPattern = null,
    needsVerification = false,
    verifiedToast = false,
    autoDetectedDesignations = [],
    candidateDesignations = [],
    autoDetectedBeatPairs = [],
    autoDetectedBeatPairGroups = {},
    onRemoveWholeDesignation,
    onRemoveSectionDesignation,
    onRemoveStepPairDesignation,
    onSetFreeform,
    onMarkUnknown,
    onSaveAndNext,
    onConfirmAutoLabel,
    onConfirmCandidate,
    onDenyCandidate,
    onConfirmAllCandidates,
    onDeleteSequence,
    canSave,
    sequenceWord = "",
  }: Props = $props();

  // Copy detection info to clipboard for debugging
  let copySuccess = $state(false);
  let copySuccessTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (copySuccessTimer) clearTimeout(copySuccessTimer);
  });

  async function copyDetectionInfo() {
    const detectionInfo = {
      candidateDesignations,
      autoDetectedDesignations,
      stepPairs: autoDetectedBeatPairs,
      stepPairGroups: autoDetectedBeatPairGroups,
      isFreeform,
      isModular,
      isPolyrhythmic,
      polyrhythmic,
      compoundPattern,
      wholeDesignations,
      sectionDesignations,
      stepPairDesignations,
    };

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(detectionInfo, null, 2)
      );
      copySuccess = true;
      if (copySuccessTimer) clearTimeout(copySuccessTimer);
      copySuccessTimer = setTimeout(() => {
        copySuccess = false;
        copySuccessTimer = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy detection info:", err);
    }
  }

  // Check if there are multiple unconfirmed candidates
  const hasMultipleCandidates = $derived(candidateDesignations.length > 1);

  // Filter to show only pending candidates (not yet confirmed or denied)
  const pendingCandidates = $derived(
    candidateDesignations.filter((c) => !c.confirmed && !c.denied)
  );
</script>

<div class="designations-panel">
  <div class="panel-header">
    <h3 class="panel-title">Designations</h3>
    <button
      class="copy-btn"
      class:success={copySuccess}
      onclick={copyDetectionInfo}
      aria-label="Copy detection info to clipboard"
    >
      <FontAwesomeIcon icon={copySuccess ? "check" : "copy"} size="0.85em" />
    </button>
  </div>

  <!-- Verified confirmation toast -->
  {#if verifiedToast}
    <div class="verified-toast" role="status" aria-live="polite">
      <FontAwesomeIcon icon="circle-check" size="1em" />
      <span>Verified</span>
    </div>
  {/if}

  <!-- Candidate verification section -->
  <CandidatesSection
    {needsVerification}
    {candidateDesignations}
    {pendingCandidates}
    {hasMultipleCandidates}
    {autoDetectedDesignations}
    {onConfirmAutoLabel}
    {onConfirmCandidate}
    {onDenyCandidate}
    {onConfirmAllCandidates}
  />

  <!-- Auto-detected step-pair analysis (hide for polyrhythmic - spatial transforms don't apply) -->
  {#if autoDetectedBeatPairs.length > 0 && !isPolyrhythmic}
    <StepPairAnalysisDisplay
      stepPairs={autoDetectedBeatPairs}
      stepPairGroups={autoDetectedBeatPairGroups}
      collapsed={false}
      {isAxisAlternating}
      {axisAlternatingPattern}
    />
  {/if}

  <!-- Compound pattern display -->
  {#if compoundPattern}
    <CompoundPatternDisplay {compoundPattern} />
  {/if}

  <!-- Polyrhythmic detection results -->
  {#if isPolyrhythmic && polyrhythmic}
    <PolyrhythmicDisplay {polyrhythmic} />
  {/if}

  <!-- Confirmed designations list -->
  <DesignationsList
    {wholeDesignations}
    {sectionDesignations}
    {stepPairDesignations}
    {isFreeform}
    {isModular}
    {isAxisAlternating}
    {axisAlternatingPattern}
    {onRemoveWholeDesignation}
    {onRemoveSectionDesignation}
    {onRemoveStepPairDesignation}
  />

  <!-- Action buttons -->
  <ActionButtons
    {isFreeform}
    {canSave}
    {onSetFreeform}
    {onMarkUnknown}
    {onSaveAndNext}
  />

  <!-- Delete sequence section -->
  {#if onDeleteSequence}
    <DeleteConfirmSection {sequenceWord} {onDeleteSequence} />
  {/if}
</div>

<style>
  .designations-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--surface-glass);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .panel-title {
    margin: 0;
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .verified-toast {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-success) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-radius: 8px;
    color: var(--semantic-success);
    font-size: var(--font-size-sm);
    font-weight: 600;
    animation: toast-in 0.3s ease-out;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .copy-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--foreground);
    border-color: var(--theme-stroke-strong);
  }

  .copy-btn.success {
    background: color-mix(in srgb, var(--semantic-success) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 40%, transparent);
    color: var(--semantic-success);
  }
</style>
