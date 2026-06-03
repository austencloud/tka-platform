<!--
  PropSwitcher.svelte

  Compact prop source toggle for the sequence viewer.
  Lets the viewer switch between creator's intended prop and their own settings.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  interface Props {
    propSource: "intended" | "creator-favorite" | "viewer-settings" | "quick-switch";
    hasIntendedProp: boolean;
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    isOwned: boolean;
    onSourceChange: (source: "intended" | "viewer-settings" | "quick-switch") => void;
    onQuickSwitch: (blue: PropType, red: PropType, catDog: boolean) => void;
    onSetAsIntended: () => Promise<void>;
  }

  let {
    propSource,
    hasIntendedProp,
    bluePropType,
    redPropType,
    isOwned,
    onSourceChange,
    onQuickSwitch,
    onSetAsIntended,
  }: Props = $props();

  const sourceLabel = $derived.by(() => {
    switch (propSource) {
      case "intended": return "Creator's choice";
      case "creator-favorite": return "Creator's favorite";
      case "viewer-settings": return "My settings";
      case "quick-switch": return "Custom";
    }
  });

  const propLabel = $derived.by(() => {
    if (!bluePropType) return "";
    if (bluePropType === redPropType) {
      return getPropTypeDisplayInfo(bluePropType).label;
    }
    return `${getPropTypeDisplayInfo(bluePropType).label} / ${getPropTypeDisplayInfo(redPropType!).label}`;
  });

  // Quick-switch cycles through common prop types when there's nothing to toggle against
  const quickSwitchTypes: PropType[] = [
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
    PropType.BUUGENG,
    PropType.TRIAD,
    PropType.MINIHOOP,
  ];

  function handleToggle() {
    if (hasIntendedProp) {
      // Toggle between creator's intended prop and viewer's settings
      if (propSource === "intended") {
        onSourceChange("viewer-settings");
      } else {
        onSourceChange("intended");
      }
      return;
    }

    // No intended prop - cycle through prop types as a quick switcher.
    // Find current prop in the list, advance to next.
    const current = bluePropType ?? PropType.STAFF;
    const currentIndex = quickSwitchTypes.indexOf(current);
    const nextIndex = (currentIndex + 1) % quickSwitchTypes.length;
    const nextProp = quickSwitchTypes[nextIndex] ?? PropType.STAFF;
    onQuickSwitch(nextProp, nextProp, false);
  }
</script>

<div class="prop-switcher">
  <button
    type="button"
    class="prop-toggle"
    class:has-intended={hasIntendedProp}
    onclick={handleToggle}
    aria-label="Switch prop display: {sourceLabel}"
  >
    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    <span class="source-label">{sourceLabel}</span>
    {#if propLabel}
      <span class="prop-label">{propLabel}</span>
    {/if}
  </button>

  {#if isOwned && propSource === "quick-switch"}
    <button
      type="button"
      class="set-intended-btn"
      onclick={() => onSetAsIntended()}
      aria-label="Set current prop as intended for this sequence"
    >
      <i class="fas fa-thumbtack" aria-hidden="true"></i>
      Set as intended
    </button>
  {/if}
</div>

<style>
  .prop-switcher {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .prop-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .prop-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .prop-toggle.has-intended {
    border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .prop-toggle i {
    font-size: 12px;
    opacity: 0.7;
  }

  .source-label {
    font-weight: 600;
  }

  .prop-label {
    opacity: 0.6;
  }

  .set-intended-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 6px;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .set-intended-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .set-intended-btn i {
    font-size: 10px;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-toggle,
    .set-intended-btn {
      transition: none;
    }
  }
</style>
