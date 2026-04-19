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
    switch (analysis.level) {
      case 1:
        return {
          lead: "This sequence uses only base motions. ",
          parts: [
            { text: "Add ", bold: false },
            { text: "whole turns", bold: true },
            { text: " to reach Level 2. Add ", bold: false },
            { text: "half turns or floats", bold: true },
            { text: " to reach Level 3.", bold: false },
          ],
        };
      case 2:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "whole turns", bold: true },
            { text: " — that's Level 2. Add ", bold: false },
            { text: "half turns or floats", bold: true },
            { text: " to reach Level 3.", bold: false },
          ],
        };
      case 3:
      default:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "half turns or floats", bold: true },
            { text: " — that's Level 3, the full vocabulary.", bold: false },
          ],
        };
    }
  });
</script>

<BaseModal {open} {onclose} size="lg" class="level-info-modal">
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
      {progression.lead}{#each progression.parts as part, i (i)}{#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
    </p>
  </div>
</BaseModal>

<style>
  .body {
    padding: clamp(8px, 2vw, 16px) clamp(16px, 3vw, 32px) clamp(16px, 3vw, 32px);
  }

  .progression {
    margin: clamp(12px, 2vw, 20px) 0 0;
    padding: 0 clamp(8px, 2vw, 24px);
    font-size: clamp(13px, 0.9vw + 0.5rem, 16px);
    line-height: 1.6;
    color: var(--theme-text, #c5c9d2);
    text-align: center;
  }
</style>
