<!--
  PropTypeSelector.svelte

  Horizontal strip of prop type buttons grouped by family.
  Shows bookmark icon on props with a user-defined default.
-->
<script lang="ts">
  import type { FirePointEditorState } from "../state/fire-point-editor-state.svelte";

  interface Props {
    editorState: FirePointEditorState;
  }

  const { editorState }: Props = $props();

  interface PropFamily {
    label: string;
    types: string[];
  }

  const PROP_FAMILIES: PropFamily[] = [
    { label: "Staff", types: ["staff", "bigstaff", "simple_staff", "staff_v2"] },
    { label: "Club", types: ["club", "bigclub"] },
    { label: "Fan", types: ["fan", "bigfan"] },
    { label: "Triad", types: ["triad", "bigtriad"] },
    { label: "Hoop", types: ["minihoop", "bighoop"] },
    { label: "Buugeng", types: ["buugeng", "bigbuugeng", "fractalgeng", "trigeng"] },
    { label: "Triquetra", types: ["triquetra", "triquetra2"] },
    { label: "Sword", types: ["sword"] },
    { label: "Chicken", types: ["chicken", "bigchicken"] },
    { label: "Guitar", types: ["guitar", "ukulele"] },
    { label: "Doublestar", types: ["doublestar", "bigdoublestar"] },
    { label: "Eightrings", types: ["eightrings", "bigeightrings"] },
    { label: "Quiad", types: ["quiad"] },
    { label: "Torch", types: ["torch", "bigtorch"] },
    { label: "Poi", types: ["poi"] },
    { label: "Hand", types: ["hand"] },
  ];

  let defaultTypes = $derived(editorState.getUserDefaultTypes());

  function displayName(propType: string): string {
    return propType.replace(/_/g, " ");
  }
</script>

<div class="prop-selector themed-scrollbar">
  {#each PROP_FAMILIES as family (family.label)}
    <div class="family-group">
      <span class="family-label">{family.label}</span>
      <div class="family-buttons">
        {#each family.types as propType (propType)}
          <button
            class="prop-btn"
            class:active={editorState.selectedPropType === propType}
            class:has-default={defaultTypes.includes(propType)}
            onclick={() => editorState.selectPropType(propType)}
            aria-pressed={editorState.selectedPropType === propType}
            aria-label={defaultTypes.includes(propType)
              ? `Select ${displayName(propType)} (has saved default)`
              : `Select ${displayName(propType)}`}
            title={defaultTypes.includes(propType)
              ? `${displayName(propType)} (default set)`
              : displayName(propType)}
          >
            <span class="prop-name">{displayName(propType)}</span>
            {#if defaultTypes.includes(propType)}
              <i class="fas fa-bookmark default-icon" aria-label="Has saved default"></i>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .prop-selector {
    display: flex;
    gap: var(--spacing-md, 16px);
    padding: 10px var(--spacing-md, 16px);
    overflow-x: auto;
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .family-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .family-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    padding-left: 4px;
  }

  .family-buttons {
    display: flex;
    gap: 4px;
  }

  .prop-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .prop-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-btn.active {
    background: color-mix(in srgb, var(--flame-orange, #f97316) 15%, transparent);
    border-color: color-mix(in srgb, var(--flame-orange, #f97316) 50%, transparent);
    color: var(--flame-orange, #f97316);
  }

  .prop-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .prop-name {
    text-transform: capitalize;
  }

  .default-icon {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-success, #22c55e);
    flex-shrink: 0;
  }

  .prop-btn.has-default {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 25%, transparent);
  }

  .prop-btn.has-default:not(.active):hover {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-btn {
      transition: none;
    }
  }
</style>
