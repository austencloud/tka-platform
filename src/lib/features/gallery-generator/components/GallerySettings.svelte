<!--
  Gallery Settings

  Dark/light mode toggle and prop type selector for pictograph rendering.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import {
    galleryGeneratorState,
    CORE_PROP_TYPES,
  } from "../state/gallery-generator-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const state = galleryGeneratorState;

  /** Format prop type for display (e.g., "staff" -> "Staff") */
  function formatPropName(prop: PropType): string {
    return prop.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

<div class="settings-panel">
  <div class="setting-row">
    <span class="setting-label">{t('gallery_gen_style')}</span>
    <div class="chip-group">
      <button
        class="chip"
        class:active={!state.lightMode}
        onclick={() => state.setLightMode(false)}
        disabled={state.isRendering}
      >
        {t('gallery_gen_dark')}
      </button>
      <button
        class="chip"
        class:active={state.lightMode}
        onclick={() => state.setLightMode(true)}
        disabled={state.isRendering}
      >
        {t('gallery_gen_light')}
      </button>
    </div>
  </div>

  <div class="setting-row">
    <span class="setting-label">{t('gallery_gen_prop_type')}</span>
    <select
      class="prop-select"
      value={state.selectedPropType ?? ""}
      onchange={(e) => {
        const value = e.currentTarget.value;
        state.setPropType(value ? (value as PropType) : null);
      }}
      disabled={state.isRendering}
    >
      <option value="">{t('gallery_gen_default_prop')}</option>
      {#each CORE_PROP_TYPES as prop}
        <option value={prop}>{formatPropName(prop)}</option>
      {/each}
    </select>
  </div>

  <div class="output-info">
    <span class="output-path" title={state.outputFolder}>
      → {state.outputFolder}
    </span>
    <span>240px</span>
    <span>WebP</span>
  </div>
</div>

<style>
  .settings-panel {
    background: #18181b;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .setting-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .chip-group {
    display: flex;
    gap: 0.25rem;
  }

  .chip {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    background: #27272a;
    border: none;
    border-radius: 6px;
    color: #a1a1aa;
    cursor: pointer;
    transition: all var(--duration-instant) ease;
  }

  .chip:hover:not(:disabled) {
    background: #3f3f46;
    color: #e4e4e7;
  }

  .chip.active {
    background: #f43f5e;
    color: white;
  }

  .chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .prop-select {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    min-width: 160px;
  }

  .prop-select:hover:not(:disabled) {
    border-color: #52525b;
  }

  .prop-select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .prop-select option {
    background: #27272a;
    color: #e4e4e7;
  }

  .output-info {
    margin-left: auto;
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: #52525b;
  }

  .output-path {
    color: #71717a;
    font-family: monospace;
  }
</style>
