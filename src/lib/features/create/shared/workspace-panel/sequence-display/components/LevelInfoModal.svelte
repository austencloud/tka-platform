<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";
  import type { DifficultyAnalysis } from "$lib/features/browse/sequences/display/services/contracts/ISequenceDifficultyCalculator";
  import LevelProgressionRow from "./LevelProgressionRow.svelte";

  interface Props {
    open: boolean;
    analysis: DifficultyAnalysis;
    onclose: () => void;
  }

  let { open, analysis, onclose }: Props = $props();

  const levelName = $derived(LEVEL_METADATA[analysis.level as LevelNumber]?.name ?? "");
  const iconColor = $derived(
    analysis.level === 3 ? "#b8860b" : analysis.level === 2 ? "#a8a8a8" : "#6366f1",
  );

  const progression = $derived.by(() => {
    const L2 = LEVEL_METADATA[2].accent;
    const L3 = LEVEL_METADATA[3].accent;
    switch (analysis.level) {
      case 1:
        return {
          lead: "This sequence uses only base motions.",
          parts: [
            { text: "Add ", emph: null },
            { text: "whole turns", emph: L2 },
            { text: " to reach Level 2. Add ", emph: null },
            { text: "half turns or floats", emph: L3 },
            { text: " to reach Level 3.", emph: null },
          ],
        };
      case 2:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "whole turns", emph: L2 },
            { text: " — that's Level 2. Add ", emph: null },
            { text: "half turns or floats", emph: L3 },
            { text: " to reach Level 3.", emph: null },
          ],
        };
      case 3:
      default:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "half turns or floats", emph: L3 },
            { text: " — that's Level 3, the full vocabulary.", emph: null },
          ],
        };
    }
  });
</script>

<BaseModal {open} {onclose} size="md">
  <ModalHeader
    title="Level {analysis.level}"
    subtitle={levelName}
    icon="fa-layer-group"
    {iconColor}
    onClose={onclose}
  />
  <div class="body">
    <LevelProgressionRow currentLevel={analysis.level as LevelNumber} />
    <p class="progression">
      {progression.lead}{#each progression.parts as part, i (i)}{#if part.emph}<strong style="color: {part.emph};">{part.text}</strong>{:else}{part.text}{/if}{/each}
    </p>
  </div>
</BaseModal>

<style>
  .body {
    container-type: inline-size;
    padding-bottom: 18px;
  }

  .progression {
    padding: 0 22px 4px;
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--theme-text, #c5c9d2);
  }
</style>
