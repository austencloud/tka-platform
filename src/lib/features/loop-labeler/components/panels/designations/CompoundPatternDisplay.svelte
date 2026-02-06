<script lang="ts">
  /**
   * Compound Pattern Display
   *
   * Shows compound pattern analysis with transformation intervals.
   */
  import type { CompoundPattern } from "../../../services/contracts/ILOOPDetector";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    compoundPattern: CompoundPattern;
  }

  let { compoundPattern }: Props = $props();
</script>

<div class="compound-section">
  <div class="compound-header">
    <FontAwesomeIcon icon="layer-group" size="1em" />
    <span>Compound Pattern</span>
  </div>
  <div class="compound-description">{compoundPattern.description}</div>
  <div class="compound-details">
    <div class="interval-row">
      <span class="interval-badge quartered">¼</span>
      <span class="interval-label"
        >{compoundPattern.quarteredTransformations.join(" + ")}</span
      >
    </div>
    <div class="interval-row">
      <span class="interval-badge halved">½</span>
      <span class="interval-label"
        >{compoundPattern.halvedTransformations.join(" + ")}</span
      >
    </div>
  </div>
</div>

<style>
  .compound-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.12) 0%,
      rgba(99, 102, 241, 0.06) 100%
    );
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 10px;
    margin-bottom: var(--spacing-xs);
  }

  .compound-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--semantic-info);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .compound-description {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--foreground);
    padding-left: 1.5em;
  }

  .compound-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 1.5em;
  }

  .interval-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
  }

  .interval-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    font-weight: 700;
    font-size: var(--font-size-compact);
  }

  .interval-badge.quartered {
    background: rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
  }

  .interval-badge.halved {
    background: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .interval-label {
    font-size: var(--font-size-sm);
    color: var(--foreground);
    text-transform: capitalize;
  }
</style>
