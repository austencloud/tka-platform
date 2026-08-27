<!--
  SelectionFooterBar.svelte - Sticky footer in My Props drawer.
  Shows selected prop context plus the current step's bounded actions.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";

  interface Props {
    selectedProps: PropType[];
    saving: boolean;
    primaryLabel: string;
    primaryDisabled?: boolean;
    onprimary: () => void;
    onback?: () => void;
  }

  let {
    selectedProps,
    saving,
    primaryLabel,
    primaryDisabled = false,
    onprimary,
    onback,
  }: Props = $props();

  const count = $derived(selectedProps.length);
</script>

<div class="selection-footer">
  <div class="selected-chips">
    {#each selectedProps as prop (prop)}
      <span class="chip-image" aria-hidden="true">
        <PropCompositionPreview
          propType={prop}
          size={24}
          useSavedOverrides={false}
        />
      </span>
    {/each}
    <span class="chip-count">
      {count === 0
        ? "Select at least one prop"
        : `${count} ${count === 1 ? "prop" : "props"} selected`}
    </span>
  </div>

  <div class="footer-actions">
    {#if onback}
      <PanelButton variant="secondary" onclick={onback} disabled={saving}>
        Back
      </PanelButton>
    {/if}
    <PanelButton
      variant="primary"
      onclick={onprimary}
      ariaBusy={saving}
      disabled={saving || primaryDisabled}
    >
      {saving ? "Saving…" : primaryLabel}
    </PanelButton>
  </div>
</div>

<style>
  .selection-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .selected-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    scrollbar-width: none;
  }

  .selected-chips::-webkit-scrollbar {
    display: none;
  }

  .chip-image {
    display: grid;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    place-items: center;
  }

  .chip-image :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }

  .chip-count {
    font-size: max(0.875rem, var(--font-size-min, 0.875rem));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .footer-actions :global(.panel-btn) {
    min-width: 7rem;
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    .chip-image {
      display: none;
    }

    .footer-actions :global(.panel-btn) {
      min-width: 5.5rem;
      padding-inline: 0.75rem;
    }
  }

  @media (min-width: 2300px) and (min-height: 45rem) {
    .selection-footer {
      gap: 1.25rem;
      padding: 1.25rem 2rem;
    }

    .selected-chips {
      gap: 0.5rem;
    }

    .chip-image {
      width: 3rem;
      height: 3rem;
    }

    .chip-count,
    .footer-actions :global(.panel-btn) {
      font-size: 1.5rem;
    }

    .footer-actions :global(.panel-btn) {
      min-height: 4.5rem;
      padding: 1rem 2rem;
    }
  }
</style>
