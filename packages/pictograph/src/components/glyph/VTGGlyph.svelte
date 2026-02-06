<!--
VTGGlyph.svelte - VTG mode labels (SS, SO, TS, TO)

Renders Vulcan Tech Gospel timing labels in bottom-right of pictograph.
Only shown for Type1 letters.
-->
<script lang="ts">
  import { LetterType, getLetterType, type Letter } from "@tka/types";

  let {
    letter = null,
    vtgMode = null,
    visible = true,
    previewMode = false,
    onToggle = undefined,
  } = $props<{
    letter?: Letter | string | null;
    vtgMode?: string | null;
    visible?: boolean;
    previewMode?: boolean;
    onToggle?: () => void;
  }>();

  // Only show VTG for Type1 letters
  const isType1 = $derived.by(() => {
    if (!letter) return false;
    try {
      const lt = getLetterType(letter as Letter);
      return lt === LetterType.TYPE1;
    } catch {
      return false;
    }
  });

  const shouldRender = $derived(isType1 && vtgMode !== null && vtgMode !== undefined);

  // Display labels for VTG modes
  const LABELS: Record<string, string> = {
    SS: "SS",
    SO: "SO",
    TS: "TS",
    TO: "TO",
    "split-same": "SS",
    "split-opp": "SO",
    "tog-same": "TS",
    "tog-opp": "TO",
  };

  const displayLabel = $derived(vtgMode ? (LABELS[vtgMode] ?? vtgMode) : "");
</script>

{#if shouldRender}
  <g
    class="vtg-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": `VTG mode: ${displayLabel}. Toggle visibility`,
        }
      : {}}
  >
    <text
      x="895"
      y="920"
      font-size="48"
      font-weight="600"
      font-family="Arial, sans-serif"
      text-anchor="end"
      fill="#888888"
      class="vtg-text"
    >
      {displayLabel}
    </text>
  </g>
{/if}

<style>
  .vtg-glyph {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .vtg-glyph.visible {
    opacity: 1;
  }

  .vtg-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .vtg-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .vtg-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  .vtg-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }
</style>
