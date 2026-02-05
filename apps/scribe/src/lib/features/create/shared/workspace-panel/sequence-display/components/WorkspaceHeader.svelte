<!--
  WorkspaceHeader.svelte

  Header component for the workspace panel containing:
  - Word label (center/left)
  - Settings button (top-right)

  This component provides a balanced top bar for the workspace,
  utilizing the space where the word label is displayed.
-->
<script lang="ts">
  import WordLabel from "./WordLabel.svelte";

  let {
    word = "",
    isMultiSelectMode = false,
    headerText = null,
  } = $props<{
    word?: string;
    isMultiSelectMode?: boolean;
    headerText?: string | null;
  }>();

  // Check if header text is contextual (not a sequence word)
  const createHeaderMatches = [
    "Choose Creation Mode",
    "Choose Starting Position",
    "Guided Builder",
    "Configure Your Settings",
  ];
  const createHeaderPrefixes = ["Blue Hand -", "Red Hand -"];
  const createHeaderFragments = ["Drawing", "Sequence Complete"];

  const isContextualHeader = $derived.by(() => {
    if (!headerText) return false;
    const normalized = headerText.trim();
    if (!normalized) return false;

    if (createHeaderMatches.some((phrase) => normalized === phrase)) {
      return true;
    }

    if (createHeaderPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return true;
    }

    return createHeaderFragments.some((fragment) =>
      normalized.includes(fragment)
    );
  });
</script>

{#if !isMultiSelectMode}
  <div class="workspace-header">
    <div class="header-content">
      <!-- Contextual header or Word Label -->
      <div class="word-label-wrapper">
        {#if isContextualHeader}
          <div class="contextual-header">{headerText}</div>
        {:else}
          <WordLabel {word} />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .workspace-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: var(--min-touch-target);
    z-index: 10;
    pointer-events: none; /* Allow clicks to pass through to word label */
  }

  .header-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .word-label-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .contextual-header {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
    text-align: center;
    padding: 8px 16px;
  }

  /* 🎯 LANDSLOOPE MOBILE */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .workspace-header {
      min-height: var(--min-touch-target);
    }
  }
</style>
