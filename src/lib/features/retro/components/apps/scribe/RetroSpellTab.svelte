<!--
  RetroSpellTab — Word-to-sequence spelling for SCRIBE.EXE

  Type a word, hit Spell. A fake progress animation runs for ~2.5s
  (same pipeline as GenerateTab), then placeholder beat squares appear
  with a letter-by-letter breakdown below them.

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroTextInput from "../../primitives/RetroTextInput.svelte";
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
  let isSpelling = $state(false);
  let spellProgress = $state(0);
  let spellStatus = $state("Ready");
  let spelledBeats = $state<
    { letter: string; tkaName: string; color: string; pictograph: RetroPictographData }[]
  >([]);

  const beatColors = [
    "#000080",
    "#800000",
    "#008000",
    "#808000",
    "#800080",
    "#008080",
  ];

  /* ------------------------------------------------------------------ */
  /* Greek letter name mapping                                           */
  /* ------------------------------------------------------------------ */

  const tkaNameMap: Record<string, string> = {
    A: "Alpha",
    B: "Beta",
    C: "Chi",
    D: "Delta",
    E: "Epsilon",
    F: "Phi",
    G: "Gamma",
    H: "Eta",
    I: "Iota",
    J: "Jot",
    K: "Kappa",
    L: "Lambda",
    M: "Mu",
    N: "Nu",
    O: "Omicron",
    P: "Pi",
    Q: "Qoppa",
    R: "Rho",
    S: "Sigma",
    T: "Tau",
    U: "Upsilon",
    V: "Vau",
    W: "Omega",
    X: "Xi",
    Y: "Psi",
    Z: "Zeta",
  };

  /* ------------------------------------------------------------------ */
  /* Spell pipeline (fake, same pattern as GenerateTab)                  */
  /* ------------------------------------------------------------------ */

  function handleSpell() {
    if (!word.trim() || isSpelling) return;

    isSpelling = true;
    spellProgress = 0;
    spelledBeats = [];
    spellStatus = "Mapping letters...";
    onstatuschange?.("Spelling...");

    const messages = [
      "Mapping letters...",
      "Resolving letter variants...",
      "Computing bridge letters...",
      "Rendering notation...",
    ];
    let msgIdx = 0;

    const interval = setInterval(() => {
      spellProgress = Math.min(95, spellProgress + Math.random() * 20);
      msgIdx = (msgIdx + 1) % messages.length;
      spellStatus = messages[msgIdx]!;
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      spellProgress = 100;
      spellStatus = `Spelled: ${word.toUpperCase()} (${word.length} letters)`;
      onstatuschange?.(`Beats: ${word.length} | Spelled`);

      spelledBeats = word.split("").map((letter, i) => {
        const upper = letter.toUpperCase();
        return {
          letter: upper,
          tkaName: tkaNameMap[upper] ?? upper,
          color: beatColors[i % beatColors.length]!,
          pictograph: createMockPictographData(letter),
        };
      });
      isSpelling = false;
    }, 2500);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSpell();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="spell-tab" onkeydown={handleKeydown}>
  <!-- Input row -->
  <div class="input-row">
    <label class="field-label" for="spell-word">Spell Word:</label>
    <div class="word-input-wrapper">
      <RetroTextInput
        bind:value={word}
        placeholder="Type a word to spell..."
        disabled={isSpelling}
      />
    </div>
    <RetroButton
      label="Spell"
      isDefault
      disabled={isSpelling || !word.trim()}
      onclick={handleSpell}
    />
  </div>

  <!-- Display area -->
  <div class="display-area sunken-panel">
    {#if isSpelling}
      <div class="progress-container">
        <RetroProgressBar value={spellProgress} segmented />
        <p class="progress-message">{spellStatus}</p>
      </div>
    {:else if spelledBeats.length > 0}
      <div class="results">
        <!-- Beat pictographs -->
        <div class="beats-container">
          {#each spelledBeats as beat, i (i)}
            <div class="beat-cell">
              <RetroPictograph data={beat.pictograph} size={48} />
              <span class="beat-label">{beat.letter}</span>
            </div>
          {/each}
        </div>

        <!-- Letter-by-letter breakdown -->
        <div class="breakdown">
          {#each spelledBeats as beat, i (i)}
            <span class="breakdown-item">
              {beat.letter} &rarr; {beat.tkaName}{#if i < spelledBeats.length - 1}<span class="breakdown-sep">&nbsp;&nbsp;</span>{/if}
            </span>
          {/each}
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <p class="empty-text">Spelled sequence will appear here</p>
      </div>
    {/if}
  </div>

  <!-- Status line -->
  <div class="status-line">
    Status: {spellStatus}
  </div>
</div>

<style>
  .spell-tab {
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
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    flex-shrink: 0;
    font-weight: bold;
  }

  .word-input-wrapper {
    flex: 1;
    min-width: 120px;
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

  .results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 8px;
  }

  /* ------------------------------------------------------------------ */
  /* Beat squares (same style as GenerateTab)                            */
  /* ------------------------------------------------------------------ */
  .beats-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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

  /* ------------------------------------------------------------------ */
  /* Letter breakdown                                                    */
  /* ------------------------------------------------------------------ */
  .breakdown {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px 0;
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .breakdown-item {
    white-space: nowrap;
  }

  .breakdown-sep {
    color: var(--retro-disabled-text, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Empty state                                                         */
  /* ------------------------------------------------------------------ */
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
