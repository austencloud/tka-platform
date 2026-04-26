<script lang="ts">
  import SectionIndexSidebar from "$lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte";
  import type { BrowseEngine } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
    activeSection?: string;
    onScrollToSection: (title: string) => void;
  }

  const { engine, activeSection, onScrollToSection }: Props = $props();
</script>

{#if engine.sections.length > 1}
  <SectionIndexSidebar
    sections={engine.sections as import("$lib/features/browse/shared/domain/models/browse-models").SequenceSection[]}
    {onScrollToSection}
    {activeSection}
  />
{/if}
