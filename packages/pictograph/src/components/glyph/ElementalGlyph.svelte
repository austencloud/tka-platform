<!--
ElementalGlyph.svelte - Elemental symbols (water, fire, earth, air)

Renders elemental symbols in the top-right corner.
Only shown for Type1 letters. Each VTG mode maps to an element.
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

  // Only show for Type1 letters
  const isType1 = $derived.by(() => {
    if (!letter) return false;
    try {
      const lt = getLetterType(letter as Letter);
      return lt === LetterType.TYPE1;
    } catch {
      return false;
    }
  });

  // VTG mode to element mapping
  const ELEMENT_MAP: Record<string, { symbol: string; label: string }> = {
    SS: { symbol: "🜄", label: "Water" },
    SO: { symbol: "🜂", label: "Fire" },
    TS: { symbol: "🜃", label: "Earth" },
    TO: { symbol: "🜁", label: "Air" },
    "split-same": { symbol: "🜄", label: "Water" },
    "split-opp": { symbol: "🜂", label: "Fire" },
    "tog-same": { symbol: "🜃", label: "Earth" },
    "tog-opp": { symbol: "🜁", label: "Air" },
  };

  const element = $derived(vtgMode ? ELEMENT_MAP[vtgMode] : null);
  const shouldRender = $derived(isType1 && element !== null);
</script>

{#if shouldRender && element}
  <g
    class="elemental-glyph"
    class:visible
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": `Element: ${element.label}. Toggle visibility`,
        }
      : {}}
  >
    <text
      x="895"
      y="80"
      font-size="56"
      font-weight="400"
      font-family="Arial, sans-serif"
      text-anchor="end"
      fill="#888888"
      class="element-text"
    >
      {element.symbol}
    </text>
  </g>
{/if}

<style>
  .elemental-glyph {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .elemental-glyph.visible {
    opacity: 1;
  }

  .elemental-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .elemental-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .elemental-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  .elemental-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }
</style>
