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
          `${k}: ${v === 2 ? "½" : v === 4 ? "¼" : v}`
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
                  aria-label="Confirm designation: {candidate.description}"
                >
                  <FontAwesomeIcon icon="check" size="0.85em" />
                </button>
              {/if}
              {#if onDenyCandidate}
                <button
                  class="candidate-btn deny"
                  onclick={() => onDenyCandidate(i)}
                  aria-label="Deny designation: {candidate.description}"
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
      color-mix(in srgb, var(--semantic-warning) 12%, transparent) 0%,
      color-mix(in srgb, var(--semantic-warning) 6%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 25%, transparent);
    border-radius: 10px;
    margin-bottom: var(--spacing-xs);
  }

  .candidates-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--semantic-warning);
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
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    transition: var(--transition-micro);
  }

  .candidate-card:hover {
    background: var(--theme-card-hover-bg);
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
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .candidate-btn.confirm {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    color: var(--semantic-success);
  }

  .candidate-btn.confirm:hover {
    background: color-mix(in srgb, var(--semantic-success) 35%, transparent);
    transform: scale(1.05);
  }

  .candidate-btn.deny {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    color: var(--semantic-error);
  }

  .candidate-btn.deny:hover {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    transform: scale(1.05);
  }

  .confirm-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-radius: 8px;
    color: var(--semantic-success);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .confirm-all-btn:hover {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
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
      color-mix(in srgb, var(--semantic-warning) 15%, transparent) 0%,
      color-mix(in srgb, var(--semantic-warning) 8%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 30%, transparent);
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
    color: var(--semantic-warning);
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
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-radius: 6px;
    color: var(--semantic-success);
    font-size: var(--font-size-xs);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .confirm-btn:hover {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
  }
</style>
