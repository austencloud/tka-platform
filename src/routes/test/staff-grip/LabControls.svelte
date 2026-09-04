<!--
  Everything the lab can change, built from the app's own controls.

  Nothing here owns a choice. The character gallery is the product's
  PerformerCharacterPicker over CHARACTER_DEFINITIONS, the prop gallery is the
  canonical ScenePropPicker over the shared 3D catalog, and choosing what plays
  goes through SequencePickerModal — the same picker Stage and the effects lab
  open, over the same browse engine. This component only arranges them into the
  app's card vocabulary and writes each choice into the URL.

  The verified fixtures sit under that picker as a pinned row rather than above
  it as the headline. They are a shortcut to seven known-good loops, not the
  set of sequences this lab can play.
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
    /**
     * Whether the rig has been measured yet. Without it a body that fits no
     * supported staff is indistinguishable from one still loading, and the
     * caption sits on “Measuring…” forever while the inspector beside it
     * already says the fit failed.
     */
    bodyMeasured: boolean;
  }

  let { lab, sequence, sequenceLoading, bodyLengthCm, bodyMeasured }: Props =
    $props();

  let characterOpen = $state(false);
  let propOpen = $state(false);
  let libraryOpen = $state(false);
  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  const characterName = $derived(labCharacterName(lab.character));
  const propLabel = $derived(labPropLabel(lab.prop));

  /**
   * The loaded sequence, named the way the product names it. A repeating word
   * always shows in its smallest form, which `labSequenceLabel` owns.
   */
  const activeFixture = $derived(labFixture(lab.sequenceId));
  const sequenceWord = $derived(
    activeFixture?.label ??
      (sequence ? labSequenceLabel(sequence) : lab.sequenceId)
  );
  const sequenceStepCount = $derived(
    activeFixture?.stepCount ?? sequence?.steps.length ?? null
  );
  const sequenceSource = $derived(
    activeFixture ? "verified fixture" : "from the library"
  );

  const viewOptions = $derived([
    { value: "quad" as LabView, label: "Quad", ariaLabel: "All four cameras" },
    ...INSPECTION_VIEWS.map((view) => ({
      value: view.id as LabView,
      // The abbreviation is visual only; `ariaLabel` still says the full name.
      label: view.pickerLabel ?? view.label,
      ariaLabel: `${view.label} camera only`,
    })),
  ]);

  const lengthMode = $derived(lab.propLength === "body" ? "body" : "pinned");
  const pinnedLengthCm = $derived(
    lab.propLength === "body" ? Math.round(bodyLengthCm ?? 91) : lab.propLength
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
  <section class="card" aria-label="Stage">
    <h2 class="card-title">Stage</h2>
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

    <div class="field">
      <span class="field-label">Prop length</span>
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
        density="tight"
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
            {#if bodyLengthCm !== null}
              {bodyLengthCm.toFixed(0)} cm from this body
            {:else if bodyMeasured}
              No supported length fits this body
            {:else}
              Measuring…
            {/if}
          </p>
        {/if}
      </div>
    </div>
  </section>

  <section class="card" aria-label="Sequence">
    <h2 class="card-title">Sequence</h2>
    <!--
      The front door. Everything the browse engine can reach is one press
      away, which is what lets this lab reproduce a grip failure somebody hit
      on a sequence of their own.
    -->
    <div class="chip-row">
      <FilterChipBase
        mode="dropdown"
        icon="fa-book-open"
        label={sequenceWord}
        count={sequenceStepCount}
        expanded={libraryOpen}
        ariaLabel={`Sequence: ${sequenceWord}. Choose another from the library.`}
        onclick={() => (libraryOpen = true)}
      />
    </div>
    <p class="note" aria-live="polite">
      {#if sequenceLoading}
        Loading sequence…
      {:else if sequenceStepCount !== null}
        {sequenceStepCount} steps · {sequenceSource}
      {:else}
        Nothing loaded
      {/if}
    </p>

    <div class="field">
      <span class="field-label" id="lab-fixtures-label">Pinned fixtures</span>
      <div class="chip-row" role="group" aria-labelledby="lab-fixtures-label">
        {#each LAB_FIXTURES as fixture (fixture.id)}
          <FilterChipBase
            mode="toggle"
            emphasis="solid"
            size="sm"
            label={fixture.label}
            active={lab.sequenceId === fixture.id}
            ariaLabel={`${fixture.label}, ${fixture.stepCount} steps`}
            onclick={() => lab.setSequence(fixture.id)}
          />
        {/each}
      </div>
    </div>
  </section>

  <section class="card" aria-label="View">
    <h2 class="card-title">View</h2>
    <SegmentedControl
      options={viewOptions}
      value={lab.view}
      density="tight"
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
  title="Choose the sequence this lab plays"
  onClose={() => (libraryOpen = false)}
  onSelect={chooseLibrarySequence}
/>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 1rem);
    min-width: 0;
  }

  /*
   * The app's own settings-card treatment — the one GridSettingsPanel and the
   * scene control inspector use. The lab's sections used to be bare headings
   * on a glass rail, which is what made a page full of real product pickers
   * still read as a debug console.
   */
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .card-title {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  /* A labelled sub-group inside a card: its own quiet label, then its control. */
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .field-label {
    font-size: var(--font-size-compact, 0.75rem);
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
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    /* The caption changes with the loaded sequence; reserving the line keeps
       the fixtures below it from stepping up and down as one loads. */
    min-height: 1.15rem;
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
</style>
