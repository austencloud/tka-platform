<!--
CompositionBreakdown.svelte

Shows the four compositional elements of a sequence (blue hand path, red hand path,
blue solo prop, red solo prop) as tappable buttons. Each button navigates to the
matching browse view mode when tapped.

Only renders buttons for elements that exist on the sequence - if blueSoloProp or
redSoloProp is missing, those buttons are hidden.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    sequence: SequenceData;
    onNavigateToView: (
      subject: BrowseViewMode["subject"],
      granularity: BrowseViewMode["granularity"],
      color: BrowseViewMode["color"]
    ) => void;
  }

  const { sequence, onNavigateToView }: Props = $props();

  const hasBlueSolo = $derived(Boolean(sequence.blueSoloProp));
  const hasRedSolo = $derived(Boolean(sequence.redSoloProp));

  // At minimum we need compositional data to show anything
  const hasComposition = $derived(hasBlueSolo || hasRedSolo);

  interface BreakdownItem {
    label: string;
    subject: BrowseViewMode["subject"];
    granularity: BrowseViewMode["granularity"];
    color: BrowseViewMode["color"];
    icon: string;
    colorVar: string;
    visible: boolean;
  }

  const items = $derived<BreakdownItem[]>([
    {
      label: t("browse_blue_hand_path"),
      subject: "hands",
      granularity: "solo",
      color: "blue",
      icon: "fa-route",
      colorVar: "var(--prop-blue, #2e8bf0)",
      visible: hasBlueSolo,
    },
    {
      label: t("browse_red_hand_path"),
      subject: "hands",
      granularity: "solo",
      color: "red",
      icon: "fa-route",
      colorVar: "var(--prop-red, #ed1c24)",
      visible: hasRedSolo,
    },
    {
      label: t("browse_blue_solo_prop"),
      subject: "props",
      granularity: "solo",
      color: "blue",
      icon: "fa-hand-paper",
      colorVar: "var(--prop-blue, #2e8bf0)",
      visible: hasBlueSolo,
    },
    {
      label: t("browse_red_solo_prop"),
      subject: "props",
      granularity: "solo",
      color: "red",
      icon: "fa-hand-paper",
      colorVar: "var(--prop-red, #ed1c24)",
      visible: hasRedSolo,
    },
  ]);

  const visibleItems = $derived(items.filter((item) => item.visible));
</script>

{#if hasComposition && visibleItems.length > 0}
  <section class="composition-breakdown" aria-label={t("browse_composition_breakdown")}>
    <span class="section-label">{t("browse_composition_breakdown")}</span>
    <div class="breakdown-grid">
      {#each visibleItems as item (item.label)}
        <button
          class="breakdown-btn"
          style="--btn-color: {item.colorVar};"
          onclick={() => onNavigateToView(item.subject, item.granularity, item.color)}
          aria-label={item.label}
        >
          <i class="fas {item.icon}" aria-hidden="true"></i>
          <span class="btn-label">{item.label}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .composition-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .breakdown-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .breakdown-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    min-height: 44px;
    background: color-mix(in srgb, var(--btn-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--btn-color) 25%, transparent);
    border-radius: 10px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
  }

  .breakdown-btn:hover {
    background: color-mix(in srgb, var(--btn-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--btn-color) 40%, transparent);
  }

  .breakdown-btn:active {
    transform: scale(0.97);
  }

  .breakdown-btn:focus-visible {
    outline: 2px solid var(--btn-color);
    outline-offset: 2px;
  }

  .breakdown-btn i {
    color: var(--btn-color);
    font-size: 14px;
    flex-shrink: 0;
  }

  .btn-label {
    line-height: 1.2;
  }

  @media (prefers-reduced-motion: reduce) {
    .breakdown-btn {
      transition: none;
    }

    .breakdown-btn:active {
      transform: none;
    }
  }
</style>
