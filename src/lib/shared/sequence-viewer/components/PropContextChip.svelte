<!--
PropContextChip - Shows which prop config is active and lets the user switch.

Shows nothing when:
- No creatorIntent on the sequence
- Creator's props match the viewer's props
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const {
    creatorDisplayName,
    creatorBlueProp,
    creatorRedProp,
    viewerBlueProp,
    viewerRedProp,
    source,
    onSwitch,
  } = $props<{
    creatorDisplayName: string;
    creatorBlueProp: PropType;
    creatorRedProp: PropType;
    viewerBlueProp: PropType;
    viewerRedProp: PropType;
    source: "creator-intent" | "viewer-settings";
    onSwitch: () => void;
  }>();

  // Only show if props differ
  const propsDiffer = $derived(
    creatorBlueProp !== viewerBlueProp || creatorRedProp !== viewerRedProp
  );

  // Format prop name for display (e.g., "STAFF" → "staves", "FAN" → "fans")
  function formatPropName(blue: PropType, red: PropType): string {
    if (blue === red) {
      return pluralizeProp(blue);
    }
    return `${pluralizeProp(blue)} / ${pluralizeProp(red)}`;
  }

  function pluralizeProp(prop: PropType): string {
    const name = String(prop).toLowerCase();
    if (name === "staff") return "staves";
    if (name === "fan") return "fans";
    if (name === "club") return "clubs";
    if (name === "poi") return "poi";
    if (name === "buugeng") return "buugeng";
    return name + "s";
  }

  const creatorPropLabel = $derived(formatPropName(creatorBlueProp, creatorRedProp));
  const viewerPropLabel = $derived(formatPropName(viewerBlueProp, viewerRedProp));
</script>

{#if propsDiffer}
  <div class="prop-context-chip">
    {#if source === "creator-intent"}
      <span class="chip-text">
        {creatorDisplayName} saved this with {creatorPropLabel}. Displaying as {creatorPropLabel}.
      </span>
      <button class="chip-switch" onclick={onSwitch}>
        Show with my {viewerPropLabel}
      </button>
    {:else}
      <span class="chip-text">
        You're viewing with {viewerPropLabel}. {creatorDisplayName} saved this with {creatorPropLabel}.
      </span>
      <button class="chip-switch" onclick={onSwitch}>
        Show as intended
      </button>
    {/if}
  </div>
{/if}

<style>
  .prop-context-chip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .chip-text {
    flex: 1;
    min-width: 0;
  }

  .chip-switch {
    background: none;
    border: 1px solid var(--theme-accent, #6366f1);
    color: var(--theme-accent, #6366f1);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .chip-switch:hover {
    background: var(--theme-accent, #6366f1);
    color: white;
  }
</style>
