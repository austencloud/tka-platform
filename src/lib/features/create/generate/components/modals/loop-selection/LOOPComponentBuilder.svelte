<!--
LOOPComponentBuilder.svelte - Interactive LOOP component picker with legend

Combines:
1. LOOPIconStrip (visual preview of active components)
2. LOOPComponentLegend (clickable legend for toggling)
3. LOOPExplanationPanel (text explanation)

Used in "Build Combo" mode to let users select multiple LOOP components.
-->
<script lang="ts">
  import { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import { LOOPExplanationTextGenerator } from "../../../shared/services/implementations/LOOPExplanationTextGenerator";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import LOOPComponentLegend from "./LOOPComponentLegend.svelte";
  import LOOPExplanationPanel from "../LOOPExplanationPanel.svelte";

  interface Props {
    selectedComponents: Set<LOOPComponent>;
    onToggleComponent: (component: LOOPComponent) => void;
    iconSize?: number;
    compact?: boolean;
    layout?: 'default' | 'dense';
  }

  let {
    selectedComponents,
    onToggleComponent,
    iconSize = 28,
    compact = false,
    layout = 'default',
  }: Props = $props();

  const explanationGenerator = new LOOPExplanationTextGenerator();

  // Generate explanation text based on selected components
  const explanationText = $derived(
    explanationGenerator.generateExplanationText(selectedComponents)
  );

  // Check if the current combination is implemented
  const isImplemented = $derived.by(() => {
    if (selectedComponents.size === 0) return true;
    return loopTypeResolver.isImplemented(selectedComponents);
  });
</script>

<div class="component-builder" class:compact class:dense={layout === 'dense'}>
  <div class="picker-section">
    <div class="icon-strip-container">
      <LOOPIconStrip
        activeComponents={selectedComponents}
        size={iconSize}
        darkMode={true}
      />
    </div>
    <LOOPComponentLegend
      {selectedComponents}
      onToggle={onToggleComponent}
      compact={compact}
      layout={layout === 'dense' ? 'grid' : 'list'}
    />
  </div>

  <div class="info-section">
    <LOOPExplanationPanel {explanationText} />
    {#if !isImplemented && selectedComponents.size > 0}
      <div class="coming-soon-badge">This combination is under development</div>
    {/if}
  </div>
</div>

<style>
  .component-builder {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .picker-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 16px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .compact .picker-section {
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }

  .dense .picker-section {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .icon-strip-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-height: 40px;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    width: 100%;
  }

  .coming-soon-badge {
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 20%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 60%, transparent);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--semantic-warning, #f59e0b);
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Mobile: stack vertically on small screens */
  @media (max-width: 360px) {
    .picker-section {
      flex-direction: column;
      gap: 16px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .coming-soon-badge {
      animation: none;
    }
  }
</style>
