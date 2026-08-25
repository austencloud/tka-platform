<script lang="ts">
  import CollapsibleSection from "$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte";
  import FormationSelector from "$lib/shared/3d/components/controls/FormationSelector.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
  import SetProperties from "./SetProperties.svelte";
  import CountStepper from "./CountStepper.svelte";
  import { getStageChoreographyContext } from "../context/stage-choreography-context";
  import { resolveActiveFormationIndex } from "../domain/active-formation";
  import type { StageEditMode } from "../state/stage-edit-mode.svelte";
  import { FORMATION_PRESET_INFO } from "@austencloud/scene-3d";
  import type { FormationPreset } from "@austencloud/scene-3d";
  import type { FormationPresetId } from "../domain/stage-types";

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyContext();
  const choreography = $derived(stageState.choreography);

  const activeSetIndex = $derived(
    resolveActiveFormationIndex(
      choreography.formations,
      editMode.selectedFormationId,
      stageState.currentBeat
    )
  );

  const activeSet = $derived(
    activeSetIndex >= 0 ? choreography.formations[activeSetIndex] : undefined
  );

  const activeSetName = $derived(
    activeSet?.label ?? `Set ${activeSetIndex + 1}`
  );

  // FormationPresetId is the wider union: it also carries shapes the shared
  // selector has no button for (triangle, diamond, grid, stagger, cluster).
  // Those read as "custom" here, which is honest — the picker cannot show a
  // shape it does not offer.
  const SELECTABLE_PRESETS = new Set<string>(
    FORMATION_PRESET_INFO.map((preset) => preset.id)
  );

  // A preset reseeds the set you are looking at, so the picker shows that set's
  // own shape rather than the last shape anyone clicked.
  const activePreset = $derived.by((): FormationPreset => {
    const presetId = activeSet?.presetId;
    if (presetId && SELECTABLE_PRESETS.has(presetId)) {
      return presetId as FormationPreset;
    }
    return "custom";
  });

  function handlePresetChange(preset: FormationPreset) {
    if (!activeSet) return;
    stageState.applyPresetToFormation(
      activeSet.id,
      preset as FormationPresetId
    );
  }

  function handlePerformerClick(e: MouseEvent, performerId: string) {
    editMode.selectPerformer(performerId, e.shiftKey);
  }
</script>

<aside class="stage-sidebar" aria-label="Stage controls">
  <CollapsibleSection title="Performers" icon="fa-users" defaultOpen={true}>
    {#snippet children()}
      <div
        class="performer-buttons"
        role="group"
        aria-label="Performer selection"
      >
        {#each choreography.performers as performer}
          <button
            type="button"
            class="performer-btn"
            class:selected={editMode.multiSelectedPerformerIds.has(
              performer.id
            )}
            style="--performer-color: {performer.color}"
            onclick={(e) => handlePerformerClick(e, performer.id)}
            aria-pressed={editMode.multiSelectedPerformerIds.has(performer.id)}
            aria-label="Select performer {performer.label}"
          >
            {performer.label}
          </button>
        {/each}
      </div>
      <div class="performer-count-controls">
        <CountStepper
          value={choreography.performers.length}
          min={2}
          max={8}
          label="performers"
          onchange={(count) => stageState.setPerformerCount(count)}
        />
      </div>
    {/snippet}
  </CollapsibleSection>

  <CollapsibleSection title="Shape" icon="fa-shapes" defaultOpen={true}>
    {#snippet children()}
      <FormationSelector
        value={activePreset}
        performerCount={choreography.performers.length}
        onchange={handlePresetChange}
      />
      {#if activeSet}
        <p class="preset-target">Reseeds {activeSetName}.</p>
      {/if}
    {/snippet}
  </CollapsibleSection>

  <CollapsibleSection
    title="Environment"
    icon="fa-mountain-sun"
    defaultOpen={true}
  >
    {#snippet children()}
      <SceneSelectorPopover
        value={choreography.environmentId}
        onchange={(environmentId) =>
          stageState.setEnvironmentId(environmentId)}
      />
    {/snippet}
  </CollapsibleSection>

  {#if activeSet}
    <div class="set-section">
      <SetProperties {editMode} />
    </div>
  {/if}
</aside>

<style>
  .stage-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding: 8px;
  }

  /* A column flex child shrinks below its content before the container agrees to
     scroll, and CollapsibleSection clips its own overflow — so the sections were
     squeezed until the performer chips were cut in half and the count stepper
     disappeared entirely. Keep every section at its natural height and let the
     sidebar scroll, which is what overflow-y is there for. */
  .stage-sidebar > :global(*) {
    flex: none;
  }

  .performer-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .performer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--performer-color) 20%, transparent);
    border: 2px solid
      color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .performer-btn.selected {
    background: color-mix(in srgb, var(--performer-color) 40%, transparent);
    border-color: var(--performer-color);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--performer-color) 40%, transparent);
  }

  .performer-btn:hover:not(.selected) {
    background: color-mix(in srgb, var(--performer-color) 30%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 60%, transparent);
  }

  .performer-count-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
  }

  /* One line, always: this text names the set the picker will overwrite, and it
     sits directly above the Environment section. Wrapping would shove it. */
  .preset-target {
    overflow: hidden;
    margin: 8px 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .set-section {
    padding: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  @media (prefers-reduced-motion: reduce) {
    .performer-btn {
      transition: none;
    }
  }
</style>
