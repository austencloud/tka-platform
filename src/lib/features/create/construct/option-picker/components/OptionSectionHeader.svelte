<!--
OptionSectionHeader.svelte - Header for an option section

Single responsibility: Display the section type label (e.g., "Type 1 - Dual-Shift")

Styling: Uses CSS cascade from parent OptionPickerContent via custom properties:
  --option-header-bg, --option-header-border, --option-header-shadow, --option-header-text
-->
<script lang="ts">
  import { formatSectionHeader } from "../services/letter-type-text-painter";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    letterType: string;
  }

  const { letterType }: Props = $props();

  // Use translated descriptions
  const getTypeDescriptions = () => ({
    Type1: { typeName: "Type 1", description: t("create_type_dual_shift") },
    Type2: { typeName: "Type 2", description: t("create_type_shift") },
    Type3: { typeName: "Type 3", description: t("create_type_cross_shift") },
    Type4: { typeName: "Type 4", description: t("create_type_dash") },
    Type5: { typeName: "Type 5", description: t("create_type_dual_dash") },
    Type6: { typeName: "Type 6", description: t("create_type_static") },
  });

  const typeInfo = $derived.by(() => {
    const descriptions = getTypeDescriptions();
    return descriptions[letterType as keyof typeof descriptions] || {
      typeName: "Type ?",
      description: t("create_type_unknown"),
    };
  });

  const formattedText = $derived(
    formatSectionHeader(
      typeInfo.typeName,
      typeInfo.description
    )
  );
</script>

<div class="section-header">
  <div class="header-layout">
    <div class="stretch"></div>
    <div class="type-label">
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
    /* Use CSS variables from parent container - auto-updates with dark mode */
    background: var(--option-header-bg, rgba(255, 255, 255, 0.9));
    border: 1px solid var(--option-header-border, rgba(0, 0, 0, 0.1));
    border-radius: 8px;
    padding: 6px;
    font-weight: 600;
    font-size: var(--font-size-base);
    min-width: 160px;
    text-align: center;
    box-shadow: 0 2px 8px var(--option-header-shadow, rgba(0, 0, 0, 0.1));
    /* Transitions sync with parent dark mode toggle */
    transition:
      background var(--option-dark-transition, var(--duration-fast) ease-out),
      border-color var(--option-dark-transition, var(--duration-fast) ease-out),
      box-shadow var(--option-dark-transition, var(--duration-fast) ease-out);
  }

  .label-text {
    display: block;
    color: var(--option-header-text, #000000);
    transition: color var(--option-dark-transition, var(--duration-fast) ease-out);
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
