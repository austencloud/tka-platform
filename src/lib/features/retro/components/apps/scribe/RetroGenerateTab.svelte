<!--
  RetroGenerateTab — Generate tab for SCRIBE.EXE

  Form-based interface for generating TKA sequences from words.
  Enter a word, pick a constraint, hit Generate. A fake progress
  animation runs for ~2.5s, then placeholder beat squares appear.

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroTextInput from "../../primitives/RetroTextInput.svelte";
  import RetroDropdown from "../../primitives/RetroDropdown.svelte";
  import RetroProgressBar from "../../primitives/RetroProgressBar.svelte";
  import RetroPictograph from "../../rendering/RetroPictograph.svelte";
  import { createMockPictographData } from "../../rendering/mock-pictograph-data";
  import type { RetroPictographData } from "../../../shared/domain/pictograph-types";

  let {
    onstatuschange,
  }: {
    onstatuschange?: (status: string) => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  let word = $state("");
  let constraint = $state("smooth");
  let isGenerating = $state(false);
  let generatedBeats = $state<
    { letter: string; color: string; pictograph: RetroPictographData }[]
  >([]);
  let generateProgress = $state(0);
  let generateStatus = $state("Ready");

  const constraintOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "reversal", label: "Reversal" },
    { value: "none", label: "None" },
  ];

  const beatColors = [
    "#000080",
    "#800000",
    "#008000",
    "#808000",
    "#800080",
    "#008080",
  ];

  /* ------------------------------------------------------------------ */
  /* Generation (fake)                                                   */
  /* ------------------------------------------------------------------ */

  function handleGenerate() {
    if (!word.trim() || isGenerating) return;

    isGenerating = true;
    generateProgress = 0;
    generatedBeats = [];
    generateStatus = "Computing kinetic path...";
    onstatuschange?.("Generating...");

    const messages = [
      "Computing kinetic path...",
      "Resolving bridges...",
      "Calibrating prop physics...",
      "Rendering notation...",
    ];
    let msgIdx = 0;

    const interval = setInterval(() => {
      generateProgress = Math.min(95, generateProgress + Math.random() * 20);
      msgIdx = (msgIdx + 1) % messages.length;
      generateStatus = messages[msgIdx]!;
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      generateProgress = 100;
      generateStatus = `Generated: ${word.toUpperCase()} (${word.length} beats)`;
      onstatuschange?.(`Beats: ${word.length} | Generated`);

      generatedBeats = word.split("").map((letter, i) => ({
        letter: letter.toUpperCase(),
        color: beatColors[i % beatColors.length]!,
        pictograph: createMockPictographData(letter),
      }));
      isGenerating = false;
    }, 2500);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleGenerate();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="generate-tab" onkeydown={handleKeydown}>
  <!-- Input row: word + generate button -->
  <div class="input-row">
    <label class="field-label" for="generate-word">Enter Word:</label>
    <div class="word-input-wrapper">
      <RetroTextInput
        bind:value={word}
        placeholder="Type a word..."
        disabled={isGenerating}
      />
    </div>
    <RetroButton
      label="Generate"
      isDefault
      disabled={isGenerating || !word.trim()}
      onclick={handleGenerate}
    />
  </div>

  <!-- Constraint row -->
  <div class="constraint-row">
    <label class="field-label" for="generate-constraint">Constraint:</label>
    <RetroDropdown
      bind:value={constraint}
      options={constraintOptions}
      disabled={isGenerating}
    />
  </div>

  <!-- Display area: sunken panel for results -->
  <div class="display-area sunken-panel">
    {#if isGenerating}
      <div class="progress-container">
        <RetroProgressBar value={generateProgress} segmented />
        <p class="progress-message">{generateStatus}</p>
      </div>
    {:else if generatedBeats.length > 0}
      <div class="beats-container">
        {#each generatedBeats as beat, i (i)}
          <div class="beat-cell">
            <RetroPictograph data={beat.pictograph} size={48} />
            <span class="beat-label">{beat.letter}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <p class="empty-text">Generated sequence will appear here</p>
      </div>
    {/if}
  </div>

  <!-- Status line -->
  <div class="status-line">
    Status: {generateStatus}
  </div>
</div>

<style>
  .generate-tab {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Input row                                                           */
  /* ------------------------------------------------------------------ */
  .input-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field-label {
    white-space: nowrap;
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    flex-shrink: 0;
  }

  .word-input-wrapper {
    flex: 1;
    min-width: 80px;
  }

  /* ------------------------------------------------------------------ */
  /* Constraint row                                                      */
  /* ------------------------------------------------------------------ */
  .constraint-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* ------------------------------------------------------------------ */
  /* Display area                                                        */
  /* ------------------------------------------------------------------ */
  .display-area {
    flex: 1;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    width: 80%;
  }

  .progress-message {
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    margin: 0;
  }

  .beats-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    align-items: center;
    justify-content: center;
  }

  .beat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .beat-label {
    color: var(--retro-black, #000);
    font-size: 9px;
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    text-align: center;
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

  /* ------------------------------------------------------------------ */
  /* Status line                                                         */
  /* ------------------------------------------------------------------ */
  .status-line {
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    padding: 2px 0;
    flex-shrink: 0;
  }
</style>
