<script lang="ts">
  /**
   * Candidates Section
   *
   * Displays auto-detected designation candidates for user verification.
   * Supports multiple candidates with individual confirm/deny actions.
   */
  import type {
    LOOPDesignation,
    CandidateDesignation,
  } from "../../../domain/models/label-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    needsVerification: boolean;
    candidateDesignations: CandidateDesignation[];
    pendingCandidates: CandidateDesignation[];
    hasMultipleCandidates: boolean;
    autoDetectedDesignations: LOOPDesignation[];
    onConfirmAutoLabel?: () => void;
    onConfirmCandidate?: (index: number) => void;
    onDenyCandidate?: (index: number) => void;
    onConfirmAllCandidates?: () => void;
  }

  let {
    needsVerification,
    candidateDesignations,
    pendingCandidates,
    hasMultipleCandidates,
    autoDetectedDesignations,
    onConfirmAutoLabel,
    onConfirmCandidate,
    onDenyCandidate,
    onConfirmAllCandidates,
  }: Props = $props();

  // Format intervals for display
  function formatIntervals(d: LOOPDesignation): string {
    if (!d.transformationIntervals) return "";
    const entries = Object.entries(d.transformationIntervals)
      .filter(([_, v]) => v)
      .map(
        ([k, v]) =>
          `${k}: ${v === "halved" ? "½" : v === "quartered" ? "¼" : v}`
      );
    return entries.length > 0 ? `(${entries.join(", ")})` : "";
  }

  // Get display text for auto-detected designation
  function formatAutoDetected(d: LOOPDesignation): string {
    const components = d.components?.join(" + ") || "None";
    const intervals = formatIntervals(d);
    return intervals ? `${components} ${intervals}` : components;
  }
</script>

<!-- Multiple Candidate Designations -->
{#if needsVerification && pendingCandidates.length > 0}
  <div class="candidates-section">
    <div class="candidates-header">
      <FontAwesomeIcon icon="robot" size="1em" />
      <span>
        {#if hasMultipleCandidates}
          {pendingCandidates.length} equally valid designations detected
        {:else}
          Auto-detected designation
        {/if}
      </span>
    </div>

    <div class="candidates-list">
      {#each candidateDesignations as candidate, i}
        {#if !candidate.confirmed && !candidate.denied}
          <div class="candidate-card">
            <div class="candidate-content">
              <span class="candidate-description">{candidate.description}</span>
              <span class="candidate-label">{candidate.label}</span>
            </div>
            <div class="candidate-actions">
              {#if onConfirmCandidate}
                <button
                  class="candidate-btn confirm"
                  onclick={() => onConfirmCandidate(i)}
                  title="Confirm this designation"
                >
                  <FontAwesomeIcon icon="check" size="0.85em" />
                </button>
              {/if}
              {#if onDenyCandidate}
                <button
                  class="candidate-btn deny"
                  onclick={() => onDenyCandidate(i)}
                  title="Deny this designation"
                >
                  <FontAwesomeIcon icon="xmark" size="0.85em" />
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Confirm button(s) at bottom -->
    {#if pendingCandidates.length > 0}
      {#if hasMultipleCandidates && onConfirmAllCandidates}
        <button class="confirm-all-btn" onclick={onConfirmAllCandidates}>
          <FontAwesomeIcon icon="check-double" size="0.9em" />
          Confirm All ({pendingCandidates.length})
        </button>
      {:else if onConfirmAutoLabel}
        <button class="confirm-all-btn" onclick={onConfirmAutoLabel}>
          <FontAwesomeIcon icon="check" size="0.9em" />
          Confirm
        </button>
      {/if}
    {/if}
  </div>
{/if}

<!-- Legacy: Single auto-detected designation (fallback) -->
{#if needsVerification && autoDetectedDesignations.length > 0 && candidateDesignations.length === 0}
  <div class="auto-detected-banner">
    <div class="banner-content">
      <div class="banner-header">
        <FontAwesomeIcon icon="robot" size="1em" />
        <span>Auto-detected:</span>
      </div>
      {#each autoDetectedDesignations as d}
        <span class="detected-type">{formatAutoDetected(d)}</span>
      {/each}
    </div>
    {#if onConfirmAutoLabel}
      <button class="confirm-btn" onclick={onConfirmAutoLabel}>
        <FontAwesomeIcon icon="check" size="0.9em" />
        Confirm
      </button>
    {/if}
  </div>
{/if}

<style>
  .candidates-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(
      135deg,
      rgba(234, 179, 8, 0.12) 0%,
      rgba(234, 179, 8, 0.06) 100%
    );
    border: 1px solid rgba(234, 179, 8, 0.25);
    border-radius: 10px;
    margin-bottom: var(--spacing-xs);
  }

  .candidates-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: #eab308;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .candidates-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .candidate-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    transition: var(--transition-micro);
  }

  .candidate-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong);
  }

  .candidate-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .candidate-description {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--foreground);
  }

  .candidate-label {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    font-family: var(--font-mono, monospace);
  }

  .candidate-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .candidate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .candidate-btn.confirm {
    background: rgba(34, 197, 94, 0.2);
    color: var(--semantic-success);
  }

  .candidate-btn.confirm:hover {
    background: rgba(34, 197, 94, 0.35);
    transform: scale(1.05);
  }

  .candidate-btn.deny {
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
  }

  .candidate-btn.deny:hover {
    background: rgba(239, 68, 68, 0.3);
    transform: scale(1.05);
  }

  .confirm-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 8px;
    color: var(--semantic-success);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .confirm-all-btn:hover {
    background: rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.6);
  }

  /* Auto-detected banner (legacy fallback) */
  .auto-detected-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(
      135deg,
      rgba(234, 179, 8, 0.15) 0%,
      rgba(234, 179, 8, 0.08) 100%
    );
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 8px;
    margin-bottom: var(--spacing-xs);
  }

  .banner-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .banner-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: #eab308;
    font-size: var(--font-size-sm);
  }

  .detected-type {
    font-weight: 600;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    padding-left: 1.5em;
  }

  .confirm-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 6px;
    color: var(--semantic-success);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .confirm-btn:hover {
    background: rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.6);
  }
</style>
