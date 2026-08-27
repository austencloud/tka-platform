<!--
  ScribeGenerate - Generate mode for the DOS-era SCRIBE app.

  Flow:
    1. Display header and prompt for a word
    2. User types a word and presses Enter
    3. Processing animation runs in parallel with real generation
    4. Render ASCII pictograph for each beat using BrailleHybridRenderer
    5. Summary line
    6. Return to SCRIBE menu

  Uses the shared notation-adapter to call the real GenerationOrchestrator
  and convert results to RetroPictographData for the ASCII renderer.

  Domain: Retro DOS Terminal - SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { BrailleHybridRenderer } from "../../services/braille-hybrid-renderer";
  import {
    generateRetroSequence,
    type RetroGenerationResult,
  } from "../../../win95/adapters/notation-adapter";

  /* Props                                                               */

  interface Props {
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* Internal state                                                      */

  type GenerateStep = "waiting-for-word" | "processing" | "displaying" | "done";

  let step = $state<GenerateStep>("waiting-for-word");
  let cancelled = $state(false);
  /** Last successful generation result — available for SAVE */
  let lastResult = $state<RetroGenerationResult | null>(null);

  const renderer = new BrailleHybridRenderer();

  /* Processing animation helpers                                        */

  async function writeProcessingLine(label: string): Promise<void> {
    if (cancelled) return;

    const totalWidth = 38;
    const dotsNeeded = totalWidth - label.length;
    const dots = ".".repeat(Math.max(dotsNeeded, 3));

    const html =
      `${terminalState.escapeForDisplay(label)}` +
      `<span class="dos-gray">${terminalState.escapeForDisplay(dots)}</span>` +
      `&nbsp;<span class="dos-green">OK</span>`;

    await delay(400);
    if (cancelled) return;
    terminalState.writeHtml(html);
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ------------------------------------------------------------------ */
  /* Input handler                                                        */
  /* ------------------------------------------------------------------ */

  function handleInput(input: string): void {
    if (step !== "waiting-for-word") return;

    const word = input.trim().toUpperCase();

    if (word.length === 0) {
      cleanup();
      onreturn();
      return;
    }

    const letters = word.replace(/[^A-Z]/g, "");
    if (letters.length === 0) {
      terminalState.writeLine("Invalid input. Enter a word using A-Z.", "red");
      terminalState.writeBlank();
      showPrompt();
      return;
    }

    step = "processing";
    runGeneration(letters);
  }

  /* ------------------------------------------------------------------ */
  /* Generation pipeline                                                  */
  /* ------------------------------------------------------------------ */

  async function runGeneration(word: string): Promise<void> {
    terminalState.writeBlank();
    terminalState.writeLine(`Generating sequence for: ${word}`, "white");
    terminalState.writeBlank();

    // Start real generation in parallel with the processing animation
    const generationPromise = generateRetroSequence({
      mode: "spell",
      word,
      constraintPreset: "smooth",
    });

    // Fake processing steps run while real engine works
    await writeProcessingLine("Computing kinetic path");
    if (cancelled) return;

    await writeProcessingLine("Resolving bridges");
    if (cancelled) return;

    await writeProcessingLine("Calibrating prop physics");
    if (cancelled) return;

    // Wait for real generation to finish
    let result: RetroGenerationResult;
    try {
      result = await generationPromise;
    } catch (err) {
      terminalState.writeBlank();
      terminalState.writeLine(
        `GENERATION FAILED: ${err instanceof Error ? err.message : "Unknown error"}`,
        "red",
      );
      terminalState.writeBlank();
      step = "done";
      cleanup();
      onreturn();
      return;
    }

    if (cancelled) return;

    lastResult = result;
    terminalState.writeBlank();

    // Render each beat as an ASCII pictograph
    step = "displaying";

    for (let i = 0; i < result.beats.length; i++) {
      if (cancelled) return;

      const beat = result.beats[i]!;
      const beatNum = i + 1;

      terminalState.writeLine(`Beat ${beatNum}: ${beat.letter}`, "cyan");

      const asciiLines = renderer.renderPictograph(beat.pictograph);
      for (const line of asciiLines) {
        terminalState.writeHtml(line);
      }

      terminalState.writeBlank();
      await delay(150);
    }

    if (cancelled) return;

    // Summary
    terminalState.writeLine(
      `Sequence complete: ${result.word} — ${result.stepCount} beat${result.stepCount !== 1 ? "s" : ""} generated.`,
      "white",
    );
    terminalState.writeBlank();

    step = "done";
    cleanup();
    onreturn();
  }

  /* ------------------------------------------------------------------ */
  /* UI display                                                           */
  /* ------------------------------------------------------------------ */

  function showHeader(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== GENERATE SEQUENCE ===", "white");
    terminalState.writeBlank();
  }

  function showPrompt(): void {
    terminalState.promptString = "Enter word (or ENTER to return): ";
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    const user = terminalState.authenticatedUser;
    terminalState.promptString = user
      ? `C:\\BELLWTHR [${user}]>`
      : "C:\\BELLWTHR>";
  }

  onMount(() => {
    cancelled = false;
    showHeader();

    // If a word was passed from `GENERATE <word>`, auto-start
    const pending = terminalState.pendingWord;
    if (pending) {
      terminalState.pendingWord = null;
      step = "processing";
      runGeneration(pending);
    } else {
      showPrompt();
      terminalState.inputHandler = handleInput;
    }
  });

  onDestroy(() => {
    cancelled = true;
    cleanup();
  });
</script>
