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
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  const state = galleryGeneratorState;

  /** Format prop type for display (e.g., "staff" -> "Staff") */
  function formatPropName(prop: PropType): string {
    return prop.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  type StyleMode = "dark" | "light";
  const styleOptions: { value: StyleMode; label: string }[] = $derived([
    { value: "dark", label: t("gallery_gen_dark") },
    { value: "light", label: t("gallery_gen_light") },
  ]);
</script>

<div class="settings-panel">
  <div class="setting-row">
    <span class="setting-label">{t('gallery_gen_style')}</span>
    <div class="style-control" class:disabled={state.isRendering}>
      <SegmentedControl
        options={styleOptions}
        value={state.lightMode ? "light" : "dark"}
        onchange={(v) => state.setLightMode(v === "light")}
        color="accent"
        size="sm"
      />
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
    background: var(--theme-panel-bg, #18181b);
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
    color: var(--theme-text-tertiary, #71717a);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .style-control {
    min-width: 140px;
  }

  .style-control.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .prop-select {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--theme-card-bg, #27272a);
    border: 1px solid var(--theme-stroke, #3f3f46);
    border-radius: 6px;
    color: var(--theme-text, #e4e4e7);
    cursor: pointer;
    min-width: 160px;
  }

  .prop-select:hover:not(:disabled) {
    border-color: var(--theme-text-tertiary, #52525b);
  }

  .prop-select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .prop-select option {
    background: var(--theme-card-bg, #27272a);
    color: var(--theme-text, #e4e4e7);
  }

  .output-info {
    margin-left: auto;
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--theme-text-tertiary, #52525b);
  }

  .output-path {
    color: var(--theme-text-tertiary, #71717a);
    font-family: monospace;
  }
</style>
