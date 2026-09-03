<!--
  Everything the lab can change, built from the app's own controls.

  Nothing here owns a choice. The character gallery is the product's
  PerformerCharacterPicker over CHARACTER_DEFINITIONS, the prop gallery is the
  canonical ScenePropPicker over the shared 3D catalog, and the library half of
  the sequence picker is SequencePickerModal. This component only arranges them
  and writes each choice into the URL.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import ScrubbableNumber from "$lib/shared/ui/components/ScrubbableNumber.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PerformerCharacterPicker from "$lib/shared/3d/components/controls/PerformerCharacterPicker.svelte";
  import ScenePropPicker from "$lib/shared/3d/components/controls/ScenePropPicker.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  import {
    isLocalOnlyCharacter,
    LAB_FIXTURES,
    labCharacterName,
    labFixture,
    labPropLabel,
    labSequenceLabel,
  } from "./lab-catalog";
  import {
    LAB_LENGTH_MAX_CM,
    LAB_LENGTH_MIN_CM,
    type LabView,
    type StaffLabState,
  } from "./lab-state.svelte";
  import { INSPECTION_VIEWS } from "./inspection-framing";

  interface Props {
    lab: StaffLabState;
    sequence: SequenceData | null;
    sequenceLoading: boolean;
    /** The length this body would choose, so Body fit can name its value. */
    bodyLengthCm: number | null;
  }

  let {
    lab,
    sequence,
    sequenceLoading,
    bodyLengthCm,
  }: Props = $props();

  let characterOpen = $state(false);
  let propOpen = $state(false);
  let libraryOpen = $state(false);
  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  const characterName = $derived(labCharacterName(lab.character));
  const propLabel = $derived(labPropLabel(lab.prop));

  /**
   * The verified fixtures plus, when one is loaded, the library sequence
   * itself. Keeping the loaded sequence in the option list is what lets a
   * single-select control stay honest: there is always exactly one active
   * option, whichever source it came from.
   */
  const sequenceOptions = $derived.by(() => {
    const options = LAB_FIXTURES.map((fixture) => ({
      value: fixture.id,
      label: fixture.label,
      ariaLabel: `${fixture.label}, ${fixture.stepCount} steps`,
      count: fixture.stepCount,
    }));
    if (!labFixture(lab.sequenceId) && sequence) {
      options.push({
        value: lab.sequenceId,
        label: labSequenceLabel(sequence),
        ariaLabel: `${labSequenceLabel(sequence)}, from the library`,
        count: sequence.steps.length,
      });
    }
    return options;
  });

  const viewOptions = $derived([
    { value: "quad" as LabView, label: "Quad", ariaLabel: "All four cameras" },
    ...INSPECTION_VIEWS.map((view) => ({
      value: view.id as LabView,
      label: view.label,
      ariaLabel: `${view.label} camera only`,
    })),
  ]);

  const lengthMode = $derived(lab.propLength === "body" ? "body" : "pinned");
  const pinnedLengthCm = $derived(
    lab.propLength === "body"
      ? Math.round(bodyLengthCm ?? 91)
      : lab.propLength
  );

  const stepCount = $derived(sequence?.steps.length ?? 1);

  const phaseLabel = $derived(
    `${Math.floor(lab.phase) + 1}.${Math.round((lab.phase % 1) * 100)
      .toString()
      .padStart(2, "0")}`
  );

  async function copyLink(): Promise<void> {
    lab.flushPhase();
    const href = lab.fullyQualifiedHref();
    try {
      await navigator.clipboard.writeText(href);
      copied = true;
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => (copied = false), 1600);
    } catch {
      // Clipboard permission is not something a lab should fight over; the
      // address bar already carries the same state.
      copied = false;
    }
  }

  function chooseCharacter(id: CharacterId): void {
    lab.setCharacter(id);
    characterOpen = false;
  }

  function chooseProp(prop: PropType): void {
    lab.setProp(prop);
    propOpen = false;
  }

  function chooseLibrarySequence(picked: SequenceData): void {
    lab.setSequence(picked.id);
    libraryOpen = false;
  }
</script>

<div class="controls">
  <section class="group" aria-label="Stage">
    <h2 class="group-title">Stage</h2>
    <div class="chip-row">
      <FilterChipBase
        mode="dropdown"
        icon="fa-person"
        label={characterName}
        expanded={characterOpen}
        ariaLabel={`Character: ${characterName}. Choose another.`}
        onclick={() => (characterOpen = true)}
      />
      <FilterChipBase
        mode="dropdown"
        icon="fa-grip-lines"
        label={propLabel}
        expanded={propOpen}
        ariaLabel={`Prop: ${propLabel}. Choose another.`}
        onclick={() => (propOpen = true)}
      />
    </div>
    {#if isLocalOnlyCharacter(lab.character)}
      <p class="note">Local rig — not in the deployable catalog.</p>
    {/if}
  </section>

  <section class="group" aria-label="Prop length">
    <h2 class="group-title">Prop length</h2>
    <SegmentedControl
      options={[
        {
          value: "body",
          label: "Body fit",
          ariaLabel: "Length this body can hold",
        },
        { value: "pinned", label: "Pinned", ariaLabel: "Fixed length in cm" },
      ]}
      value={lengthMode}
      size="sm"
      ariaLabel="How prop length is chosen"
      onchange={(mode) =>
        lab.setPropLength(mode === "body" ? "body" : pinnedLengthCm)}
    />
    <div class="length-value" class:is-pinned={lengthMode === "pinned"}>
      {#if lengthMode === "pinned"}
        <ScrubbableNumber
          value={pinnedLengthCm}
          min={LAB_LENGTH_MIN_CM}
          max={LAB_LENGTH_MAX_CM}
          step={1}
          label="Pinned prop length"
          unit=" cm"
          onchange={(cm) => lab.setPropLength(cm)}
        />
      {:else}
        <p class="derived">
          {bodyLengthCm === null
            ? "Measuring…"
            : `${bodyLengthCm.toFixed(0)} cm from this body`}
        </p>
      {/if}
    </div>
  </section>

  <section class="group" aria-label="Sequence">
    <h2 class="group-title">Sequence</h2>
    <SegmentedControl
      options={sequenceOptions}
      value={lab.sequenceId}
      size="sm"
      columns={2}
      ariaLabel="Loaded sequence"
      onchange={(id) => lab.setSequence(id)}
    />
    <div class="chip-row">
      <FilterChipBase
        mode="action"
        icon="fa-book-open"
        label="Browse library"
        size="sm"
        onclick={() => (libraryOpen = true)}
      />
      {#if sequenceLoading}
        <span class="note" role="status">Loading sequence…</span>
      {/if}
    </div>
  </section>

  <section class="group" aria-label="Playback">
    <h2 class="group-title">Playback</h2>
    <div class="transport">
      <button
        type="button"
        class="transport-button"
        aria-pressed={lab.playing}
        onclick={() => lab.setPlaying(!lab.playing)}
      >
        <i
          class="fas {lab.playing ? 'fa-pause' : 'fa-play'}"
          aria-hidden="true"
        ></i>
        <span>{lab.playing ? "Pause" : "Play"}</span>
      </button>
      <span class="step-readout">Step {phaseLabel}</span>
    </div>
    <label class="scrub" for="grip-phase">
      <span class="visually-hidden">Position in sequence</span>
      <input
        id="grip-phase"
        type="range"
        min="0"
        max={stepCount - 0.01}
        step="0.01"
        value={lab.phase}
        oninput={(event) => lab.setPhase(event.currentTarget.valueAsNumber)}
        onchange={() => lab.flushPhase()}
      />
    </label>
  </section>

  <section class="group" aria-label="Cameras">
    <h2 class="group-title">Cameras</h2>
    <SegmentedControl
      options={viewOptions}
      value={lab.view}
      size="sm"
      columns={3}
      ariaLabel="Camera layout"
      onchange={(view) => lab.setView(view)}
    />
    <div class="chip-row">
      <FilterChipBase
        mode="toggle"
        icon="fa-tag"
        label="Grid labels"
        size="sm"
        active={lab.gridLabels}
        onclick={() => lab.setGridLabels(!lab.gridLabels)}
      />
      <FilterChipBase
        mode="action"
        icon={copied ? "fa-check" : "fa-link"}
        label={copied ? "Link copied" : "Copy link"}
        size="sm"
        ariaLabel="Copy a link that reproduces this exact configuration"
        onclick={copyLink}
      />
    </div>
  </section>
</div>

<BaseModal
  bind:open={characterOpen}
  size="lg"
  labelledBy="lab-character-title"
  onclose={() => (characterOpen = false)}
>
  {#snippet header()}
    <h2 id="lab-character-title" class="modal-title">Character</h2>
  {/snippet}
  <div class="picker-body">
    <PerformerCharacterPicker
      selectedCharacterId={lab.character}
      pendingCharacterId={null}
      previewPerformer={null}
      groupLabel="Lab character"
      onSelect={chooseCharacter}
      onIntent={() => {}}
      onCancelIntent={() => {}}
    />
  </div>
</BaseModal>

<BaseModal
  bind:open={propOpen}
  size="lg"
  labelledBy="lab-prop-title"
  onclose={() => (propOpen = false)}
>
  {#snippet header()}
    <h2 id="lab-prop-title" class="modal-title">Prop</h2>
  {/snippet}
  <div class="picker-body">
    <ScenePropPicker currentProp={lab.prop} onSelect={chooseProp} />
  </div>
</BaseModal>

<SequencePickerModal
  bind:open={libraryOpen}
  title="Load a sequence"
  onClose={() => (libraryOpen = false)}
  onSelect={chooseLibrarySequence}
/>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 1rem);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .group-title {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  /*
   * A chip sizes to its label. Without this a chip inside a flex column
   * stretches to the rail's full width, which is the "absurdly wide control"
   * failure the visual-verification rule names first.
   */
  .chip-row :global(> *) {
    flex: 0 0 auto;
    max-width: 100%;
  }

  .note {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  /*
   * Both length modes occupy the same reserved row, so switching between the
   * scrubber and the derived readout cannot shove the sections beneath it.
   */
  .length-value {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
  }

  .derived {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .transport-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0 1rem;
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    background: var(--card-bg-current, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--transition-fast, 120ms) ease,
      border-color var(--transition-fast, 120ms) ease;
  }

  .transport-button:hover {
    background: var(--surface-glass-hover, rgba(255, 255, 255, 0.1));
  }

  .transport-button[aria-pressed="true"] {
    border-color: var(--theme-accent, #7a73da);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7a73da) 22%,
      transparent
    );
  }

  .transport-button:focus-visible {
    outline: 2px solid var(--theme-accent, #7a73da);
    outline-offset: 2px;
  }

  .step-readout {
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #fff);
    /*
     * The step label grows a digit at step 10. Reserving the widest form keeps
     * the transport row from nudging when a longer sequence loads.
     */
    min-width: 5.5ch;
  }

  .scrub {
    display: block;
    width: 100%;
  }

  .scrub input {
    width: 100%;
    min-height: 44px;
    accent-color: var(--theme-accent, #7a73da);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .modal-title {
    margin: 0;
    padding: 0.85rem 1.1rem 0;
    font-size: var(--font-size-lg, 1.125rem);
    color: var(--theme-text, #fff);
  }

  .picker-body {
    max-height: min(70dvh, 640px);
    overflow-y: auto;
    padding: 0.85rem 1.1rem 1.1rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .transport-button {
      transition: none;
    }
  }
</style>
