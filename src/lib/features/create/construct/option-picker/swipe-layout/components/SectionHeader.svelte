<!--
SectionHeader.svelte - Header for option picker sections

Single responsibility: Display section header with colored letter type label.
Uses LetterTypeTextPainter for consistent text formatting.
-->
<script lang="ts">
  import { LetterTypeTextPainter } from "../../utils/letter-type-text-painter";

  const { letterType = "mixed", darkMode = false } = $props<{
    letterType?: string;
    darkMode?: boolean;
  }>();

  // Type descriptions mapping
  const typeDescriptions: Record<
    string,
    { description: string; typeName: string }
  > = {
    Type1: { description: "Dual-Shift", typeName: "Type 1" },
    Type2: { description: "Shift", typeName: "Type 2" },
    Type3: { description: "Cross-Shift", typeName: "Type 3" },
    Type4: { description: "Dash", typeName: "Type 4" },
    Type5: { description: "Dual-Dash", typeName: "Type 5" },
    Type6: { description: "Static", typeName: "Type 6" },
    mixed: { description: "All Types", typeName: "Options" },
    "Types 4-6": { description: "Dash Types", typeName: "Types 4-6" },
  };

  const typeInfo = $derived(() => {
    return (
      typeDescriptions[letterType] || {
        description: "All Types",
        typeName: "Options",
      }
    );
  });

  // Generate colored header text
  const buttonText = $derived(
    LetterTypeTextPainter.formatSectionHeader(
      typeInfo().typeName,
      typeInfo().description
    )
  );
</script>

<div class="section-header">
  <div class="header-layout">
    <div class="stretch"></div>
    <div class="type-label" class:dark-mode={darkMode}>
      <span class="label-text">
        {@html buttonText}
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
    padding: 6px 6px;
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

  /* Responsive sizing */
  @media (max-height: 800px) {
    .type-label {
      font-size: var(--font-size-sm);
      padding: 4px 4px;
      min-width: 140px;
    }
  }

  @media (max-height: 700px) {
    .type-label {
      font-size: var(--font-size-compact);
      padding: 3px 3px;
      min-width: 120px;
    }
  }

  @media (max-height: 600px) {
    .type-label {
      font-size: var(--font-size-compact);
      padding: 2px 2px;
      min-width: 100px;
    }
  }

  .label-text {
    display: block;
    color: #000000;
    transition: color 150ms ease-out;
  }

  .dark-mode .label-text {
    color: #ffffff;
  }
</style>
