<!--
OptionSectionHeader.svelte - Header for an option section

Single responsibility: Display the section type label (e.g., "Type 1 - Dual-Shift")
-->
<script lang="ts">
  import { LetterTypeTextPainter } from "../services/LetterTypeTextPainter";

  interface Props {
    letterType: string;
    darkMode?: boolean;
  }

  const { letterType, darkMode = false }: Props = $props();

  const TYPE_DESCRIPTIONS: Record<
    string,
    { typeName: string; description: string }
  > = {
    Type1: { typeName: "Type 1", description: "Dual-Shift" },
    Type2: { typeName: "Type 2", description: "Shift" },
    Type3: { typeName: "Type 3", description: "Cross-Shift" },
    Type4: { typeName: "Type 4", description: "Dash" },
    Type5: { typeName: "Type 5", description: "Dual-Dash" },
    Type6: { typeName: "Type 6", description: "Static" },
  };

  const typeInfo = $derived(
    TYPE_DESCRIPTIONS[letterType] || {
      typeName: "Type ?",
      description: "Unknown",
    }
  );

  const formattedText = $derived(
    LetterTypeTextPainter.formatSectionHeader(
      typeInfo.typeName,
      typeInfo.description
    )
  );
</script>

<div class="section-header">
  <div class="header-layout">
    <div class="stretch"></div>
    <div class="type-label" class:dark-mode={darkMode}>
      <span class="label-text">
        {@html formattedText}
      </span>
    </div>
    <div class="stretch"></div>
  </div>
</div>

<style>
  .section-header {
    width: 100%;
  }

  .header-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    margin-top: 8px;
    width: 100%;
  }

  .stretch {
    flex: 1;
  }

  .type-label {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 6px;
    font-weight: 600;
    font-size: var(--font-size-base);
    min-width: 160px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: background 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out;
  }

  .type-label.dark-mode {
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .label-text {
    display: block;
    color: #000000;
    transition: color 150ms ease-out;
  }

  .dark-mode .label-text {
    color: #ffffff;
  }

  @media (max-height: 800px) {
    .type-label {
      font-size: var(--font-size-sm);
      padding: 4px;
      min-width: 140px;
    }
  }

  @media (max-height: 700px) {
    .type-label {
      font-size: var(--font-size-compact);
      padding: 3px;
      min-width: 120px;
    }
  }
</style>
