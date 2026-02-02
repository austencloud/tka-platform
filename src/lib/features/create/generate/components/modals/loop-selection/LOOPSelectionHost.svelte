<!--
LOOPSelectionHost.svelte - Orchestrator for responsive LOOP selection modal

Detects viewport dimensions and renders the appropriate layout variant:
- 4K/Ultrawide (≥1400px, ≥700px): Side-by-side modal
- Desktop (≥768px, ≥500px): Tabbed modal
- Mobile (≥400px): Bottom drawer
- Tiny (<400px): Step-by-step wizard
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import type { LOOPSelectionLayout } from "../../../shared/domain/models/loop-selection-types";
  import { detectLOOPLayout } from "../../../shared/services/implementations/LOOPLayoutDetector";
  import LOOPSelectionSideBySide from "./LOOPSelectionSideBySide.svelte";
  import LOOPSelectionTabbed from "./LOOPSelectionTabbed.svelte";
  import LOOPSelectionDrawer from "./LOOPSelectionDrawer.svelte";
  import LOOPSelectionWizard from "./LOOPSelectionWizard.svelte";

  interface Props {
    isOpen: boolean;
    selectedComponents: Set<LOOPComponent>;
    onToggleComponent: (component: LOOPComponent) => void;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { isOpen, selectedComponents, onToggleComponent, onConfirm, onClose }: Props =
    $props();

  let layout = $state<LOOPSelectionLayout>("drawer");
  let mounted = $state(false);

  onMount(() => {
    mounted = true;
    updateLayout();

    // Listen for resize events
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  function updateLayout() {
    if (typeof window === "undefined") return;
    const config = detectLOOPLayout(window.innerWidth, window.innerHeight);
    layout = config.layout;
  }

  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  function handleResize() {
    // Debounce resize events
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(updateLayout, 100);
  }

  // Re-detect layout when modal opens (in case viewport changed while closed)
  $effect(() => {
    if (isOpen && mounted) {
      updateLayout();
    }
  });
</script>

{#if mounted}
  {#if layout === "side-by-side"}
    <LOOPSelectionSideBySide
      {isOpen}
      {selectedComponents}
      {onToggleComponent}
      {onConfirm}
      {onClose}
    />
  {:else if layout === "tabbed"}
    <LOOPSelectionTabbed
      {isOpen}
      {selectedComponents}
      {onToggleComponent}
      {onConfirm}
      {onClose}
    />
  {:else if layout === "wizard"}
    <LOOPSelectionWizard
      {isOpen}
      {selectedComponents}
      {onToggleComponent}
      {onConfirm}
      {onClose}
    />
  {:else}
    <LOOPSelectionDrawer
      {isOpen}
      {selectedComponents}
      {onToggleComponent}
      {onConfirm}
      {onClose}
    />
  {/if}
{/if}
