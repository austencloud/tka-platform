<script lang="ts">
  /**
   * Compound Pattern Display
   *
   * Shows compound pattern analysis with transformation intervals.
   */
  import type { CompoundPattern } from "../../../services/ILOOPDetector";
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
      color-mix(in srgb, var(--semantic-info) 12%, transparent) 0%,
      color-mix(in srgb, var(--primary-color) 6%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-info) 25%, transparent);
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
    background: var(--theme-card-bg);
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
    background: color-mix(in srgb, var(--primary-color) 30%, transparent);
    color: color-mix(in srgb, var(--primary-color) 65%, white);
  }

  .interval-badge.halved {
    background: color-mix(in srgb, var(--semantic-info) 30%, transparent);
    color: var(--semantic-info-text);
  }

  .interval-label {
    font-size: var(--font-size-sm);
    color: var(--foreground);
    text-transform: capitalize;
  }
</style>
