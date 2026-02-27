<!--
  RetroConstructTab — Beat-by-beat sequence builder for SCRIBE.EXE

  Lets the user pick a letter, motion type, and CW/CCW turns,
  then add beats one at a time to build a sequence. The beat list
  and a placeholder preview panel sit side by side below.

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroTextInput from "../../primitives/RetroTextInput.svelte";
  import RetroDropdown from "../../primitives/RetroDropdown.svelte";
  import RetroRadioButton from "../../primitives/RetroRadioButton.svelte";
  import RetroListBox from "../../primitives/RetroListBox.svelte";

  let {
    onstatuschange,
  }: {
    onstatuschange?: (status: string) => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* Beat form state                                                     */
  /* ------------------------------------------------------------------ */

  let selectedLetter = $state("a");
  let motionType = $state("pro");
  let cwTurns = $state(0);
  let ccwTurns = $state(0);

  /* ------------------------------------------------------------------ */
  /* Letter options                                                      */
  /* ------------------------------------------------------------------ */

  const greekLetters = [
    { value: "sigma", label: "Sigma" },
    { value: "phi", label: "Phi" },
    { value: "theta", label: "Theta" },
    { value: "psi", label: "Psi" },
    { value: "lambda", label: "Lambda" },
  ];

  const letterOptions = [
    ...Array.from({ length: 26 }, (_, i) => {
      const char = String.fromCharCode(65 + i);
      return { value: char.toLowerCase(), label: char };
    }),
    ...greekLetters,
  ];

  /* ------------------------------------------------------------------ */
  /* Motion type selection                                               */
  /* ------------------------------------------------------------------ */

  function selectMotion(value: string) {
    motionType = value;
  }

  /* ------------------------------------------------------------------ */
  /* Turn spinner helpers                                                */
  /* ------------------------------------------------------------------ */

  const TURN_MIN = 0;
  const TURN_MAX = 3;
  const TURN_STEP = 0.5;

  function clampTurns(val: number): number {
    return Math.max(TURN_MIN, Math.min(TURN_MAX, Math.round(val * 2) / 2));
  }

  function incrementCW() {
    cwTurns = clampTurns(cwTurns + TURN_STEP);
  }
  function decrementCW() {
    cwTurns = clampTurns(cwTurns - TURN_STEP);
  }
  function incrementCCW() {
    ccwTurns = clampTurns(ccwTurns + TURN_STEP);
  }
  function decrementCCW() {
    ccwTurns = clampTurns(ccwTurns - TURN_STEP);
  }

  function handleCWInput(val: string) {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) cwTurns = clampTurns(parsed);
  }

  function handleCCWInput(val: string) {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) ccwTurns = clampTurns(parsed);
  }

  /* ------------------------------------------------------------------ */
  /* Beat list                                                           */
  /* ------------------------------------------------------------------ */

  interface Beat {
    letter: string;
    motion: string;
    cw: number;
    ccw: number;
  }

  let beats = $state<Beat[]>([]);
  let selectedBeatIndex = $state(-1);

  const beatColors = [
    "#000080",
    "#800000",
    "#008000",
    "#808000",
    "#800080",
    "#008080",
  ];

  const beatListItems = $derived(
    beats.map((b, i) => {
      const label = b.letter.length > 1
        ? b.letter.charAt(0).toUpperCase() + b.letter.slice(1)
        : b.letter.toUpperCase();
      const motion = b.motion.charAt(0).toUpperCase() + b.motion.slice(1);
      return `${i + 1}. ${label} - ${motion} - CW:${b.cw} CCW:${b.ccw}`;
    }),
  );

  function handleAddBeat() {
    beats.push({
      letter: selectedLetter,
      motion: motionType,
      cw: cwTurns,
      ccw: ccwTurns,
    });
    onstatuschange?.(`Beats: ${beats.length} | Added beat ${beats.length}`);
  }

  function handleRemoveBeat() {
    if (selectedBeatIndex < 0 || selectedBeatIndex >= beats.length) return;
    beats.splice(selectedBeatIndex, 1);
    selectedBeatIndex = Math.min(selectedBeatIndex, beats.length - 1);
    onstatuschange?.(`Beats: ${beats.length} | Beat removed`);
  }
</script>

<div class="construct-tab">
  <!-- Controls fieldset -->
  <fieldset class="controls-fieldset">
    <legend>Beat Parameters</legend>

    <!-- Letter picker -->
    <div class="field-row-custom">
      <label class="field-label" for="construct-letter">Letter:</label>
      <RetroDropdown id="construct-letter" bind:value={selectedLetter} options={letterOptions} />
    </div>

    <!-- Motion type radios -->
    <div class="field-row-custom">
      <label class="field-label" for="construct-motion-pro">Motion:</label>
      <div class="radio-group">
        <RetroRadioButton
          label="Pro"
          name="motion-type"
          value="pro"
          selected={motionType === "pro"}
          onchange={selectMotion}
        />
        <RetroRadioButton
          label="Anti"
          name="motion-type"
          value="anti"
          selected={motionType === "anti"}
          onchange={selectMotion}
        />
        <RetroRadioButton
          label="Static"
          name="motion-type"
          value="static"
          selected={motionType === "static"}
          onchange={selectMotion}
        />
        <RetroRadioButton
          label="Dash"
          name="motion-type"
          value="dash"
          selected={motionType === "dash"}
          onchange={selectMotion}
        />
      </div>
    </div>

    <!-- Turn spinners -->
    <div class="field-row-custom">
      <label class="field-label" for="construct-cw">CW Turns:</label>
      <div class="spinner">
        <div class="spinner-input">
          <RetroTextInput
            id="construct-cw"
            value={String(cwTurns)}
            onchange={handleCWInput}
          />
        </div>
        <div class="spinner-buttons">
          <RetroButton onclick={incrementCW}>
            <span class="spinner-arrow">&#9650;</span>
          </RetroButton>
          <RetroButton onclick={decrementCW}>
            <span class="spinner-arrow">&#9660;</span>
          </RetroButton>
        </div>
      </div>

      <label class="field-label ccw-label" for="construct-ccw">CCW Turns:</label>
      <div class="spinner">
        <div class="spinner-input">
          <RetroTextInput
            id="construct-ccw"
            value={String(ccwTurns)}
            onchange={handleCCWInput}
          />
        </div>
        <div class="spinner-buttons">
          <RetroButton onclick={incrementCCW}>
            <span class="spinner-arrow">&#9650;</span>
          </RetroButton>
          <RetroButton onclick={decrementCCW}>
            <span class="spinner-arrow">&#9660;</span>
          </RetroButton>
        </div>
      </div>
    </div>

    <!-- Add Beat button -->
    <div class="add-row">
      <RetroButton label="Add Beat" isDefault onclick={handleAddBeat} />
    </div>
  </fieldset>

  <!-- Bottom section: beat list + preview side by side -->
  <div class="bottom-section">
    <!-- Beat list -->
    <div class="list-column">
      <RetroListBox
        items={beatListItems}
        bind:selectedIndex={selectedBeatIndex}
        height={6}
      />
      <div class="list-actions">
        <RetroButton
          label="Remove"
          disabled={selectedBeatIndex < 0 || beats.length === 0}
          onclick={handleRemoveBeat}
        />
      </div>
    </div>

    <!-- Preview area -->
    <div class="preview-column sunken-panel">
      {#if beats.length > 0}
        <div class="beats-container">
          {#each beats as beat, i (i)}
            <div
              class="beat-square"
              style="background: {beatColors[i % beatColors.length]};"
            >
              <span class="beat-letter">
                {beat.letter.length > 1
                  ? beat.letter.charAt(0).toUpperCase() + beat.letter.slice(1)
                  : beat.letter.toUpperCase()}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p class="empty-text">Add beats to preview sequence</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .construct-tab {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Fieldset (98.css provides etched border)                            */
  /* ------------------------------------------------------------------ */
  .controls-fieldset {
    flex-shrink: 0;
    padding: 6px 8px;
    margin: 0;
  }

  .controls-fieldset legend {
    font-size: var(--retro-font-size, 11px);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    color: var(--retro-black, #000);
  }

  /* ------------------------------------------------------------------ */
  /* Field rows                                                          */
  /* ------------------------------------------------------------------ */
  .field-row-custom {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .field-label {
    white-space: nowrap;
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    flex-shrink: 0;
    min-width: 60px;
  }

  .ccw-label {
    margin-left: 12px;
  }

  .radio-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ------------------------------------------------------------------ */
  /* Turn spinners                                                       */
  /* ------------------------------------------------------------------ */
  .spinner {
    display: flex;
    align-items: stretch;
  }

  .spinner-input {
    width: 42px;
  }

  .spinner-input :global(.retro-input) {
    text-align: center;
    width: 42px;
  }

  .spinner-buttons {
    display: flex;
    flex-direction: column;
  }

  .spinner-buttons :global(button) {
    min-width: 16px;
    min-height: 11px;
    padding: 0;
    line-height: 1;
    font-size: 6px;
  }

  .spinner-arrow {
    font-size: 6px;
    line-height: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Add button row                                                      */
  /* ------------------------------------------------------------------ */
  .add-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Bottom section: list + preview                                      */
  /* ------------------------------------------------------------------ */
  .bottom-section {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  .list-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .list-actions {
    display: flex;
    gap: 4px;
  }

  .preview-column {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
  }

  /* ------------------------------------------------------------------ */
  /* Beat squares (same style as GenerateTab)                            */
  /* ------------------------------------------------------------------ */
  .beats-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    align-items: center;
    justify-content: center;
  }

  .beat-square {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px outset var(--retro-button-face, #c0c0c0);
    image-rendering: pixelated;
  }

  .beat-letter {
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .empty-text {
    color: var(--retro-disabled-text, #808080);
    font-size: var(--retro-font-size, 11px);
    margin: 0;
    font-style: italic;
  }
</style>
