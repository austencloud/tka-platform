<script lang="ts">
  import type { FormationPresetId } from "../domain/stage-types";
  import type { StudioPerformerCount } from "../domain/studio-project";

  let {
    performerCount,
    formation: _formation,
    formationLabel = null,
  }: {
    performerCount: StudioPerformerCount | null;
    formation: FormationPresetId | null;
    formationLabel?: string | null;
  } = $props();

  const summary = $derived(
    performerCount === null
      ? "Choose a cast to bring the stage to life."
      : `${performerCount} ${performerCount === 1 ? "performer" : "performers"}${formationLabel ? ` · ${formationLabel}` : ""}`
  );
</script>

<div class="cast-preview" data-testid="studio-cast-preview-stub">
  <div class="canvas-shell" aria-hidden="true">
    {#each Array.from({ length: performerCount ?? 0 }) as _, index}
      <span>{index + 1}</span>
    {/each}
  </div>
  <div class="preview-summary">
    <small>Live stage preview</small>
    <strong>{summary}</strong>
  </div>
</div>

<style>
  .cast-preview {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 1rem;
    background: var(--surface-inset-deep);
  }

  .canvas-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 13rem;
    gap: 0.35rem;
  }

  .canvas-shell span {
    display: grid;
    width: 1.75rem;
    aspect-ratio: 1;
    border-radius: 999px;
    background: var(--theme-accent);
    color: var(--theme-on-accent, white);
    place-items: center;
  }

  .preview-summary {
    display: grid;
    min-height: 4.5rem;
    padding: 0.75rem 0.875rem;
    border-top: 1px solid var(--theme-stroke);
  }

  .preview-summary small {
    color: var(--theme-accent);
    text-transform: uppercase;
  }

  @container (max-width: 42rem) {
    .canvas-shell {
      min-height: 9rem;
    }

    .preview-summary {
      min-height: 0;
    }
  }
</style>
