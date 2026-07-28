<!--
  LibraryModeInfo.svelte

  Displays creator attribution for sequences in Library mode.
  Shows the creator's display name with a subtle "by" prefix.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
  }: {
    sequence: SequenceData | null;
  } = $props();

  // A LOOP's word repeats by construction (e.g. OΛ-TΛ-OΛ-TΛ-…), and TKA canon
  // always shows the smallest form — so the resolved name goes through the
  // simplifier before a visitor sees it.
  let sequenceName = $derived(
    simplifyRepeatedWord(
      sequence?.displayName ||
        sequence?.intendedWord ||
        sequence?.word ||
        sequence?.name ||
        ""
    ) || t("landing_spinner_untitled")
  );
  let stepCount = $derived(sequence?.steps.length ?? 0);
</script>

{#if sequence}
  <div class="library-info" in:fade={{ duration: motionDuration(200) }}>
    <span class="sequence-name">{sequenceName}</span>
    <span class="separator" aria-hidden="true">·</span>
    <span class="step-count"
      >{t("landing_infinite_steps", { count: stepCount })}</span
    >
  </div>
{/if}

<style>
  .library-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    min-height: 2rem;
    font-size: var(--font-size-min, 0.875rem);
  }

  .sequence-name {
    max-width: min(60vw, 42rem);
    overflow: hidden;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .separator,
  .step-count {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .step-count {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .library-info {
      gap: 0.4rem;
      font-size: var(--font-size-compact, 0.75rem);
    }

    .sequence-name {
      max-width: 62vw;
    }
  }

</style>
