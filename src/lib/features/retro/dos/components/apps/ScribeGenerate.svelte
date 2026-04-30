<!--
  ScribeGenerate - Generate mode for the DOS-era SCRIBE app.

  Flow:
    1. Display header and prompt for a word
    2. User types a word and presses Enter
    3. Fake processing with dot animation (500ms delays per step)
    4. Render ASCII pictograph for each letter using AsciiRenderer
    5. Summary line
    6. Return to SCRIBE menu

  The component writes to terminalState and handles input via the
  inputHandler callback. Internal state tracks the current sub-step:
  waiting-for-word, processing, displaying.

  Domain: Retro DOS Terminal - SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { BrailleHybridRenderer } from "../../services/implementations/BrailleHybridRenderer";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  interface Props {
    /** Called when Generate mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* ------------------------------------------------------------------ */
  /* Internal state                                                      */
  /* ------------------------------------------------------------------ */

  type GenerateStep = "waiting-for-word" | "processing" | "displaying" | "done";

  let step = $state<GenerateStep>("waiting-for-word");
  let cancelled = $state(false);

  const renderer = new BrailleHybridRenderer();

  /* ------------------------------------------------------------------ */
  /* Processing animation helpers                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Write a status line with animated dots, then append " OK".
   * Each dot appears at ~60ms intervals, "OK" appears after a 500ms pause.
   */
  async function writeProcessingLine(label: string, dotCount: number): Promise<void> {
    if (cancelled) return;

    // Build the label portion padded with dots to a fixed width
    const totalWidth = 38;
    const dotsNeeded = totalWidth - label.length;
    const dots = ".".repeat(Math.max(dotsNeeded, 3));

    // Write the line with dots and OK
    const html =
      `${terminalState.escapeForDisplay(label)}` +
      `<span class="dos-gray">${terminalState.escapeForDisplay(dots)}</span>` +
      `&nbsp;<span class="dos-green">OK</span>`;

    await delay(500);
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
      // Empty input - return to menu
      cleanup();
      onreturn();
      return;
    }

    // Filter to alpha characters only
    const letters = word.replace(/[^A-Z]/g, "");
    if (letters.length === 0) {
      terminalState.writeLine("Invalid input. Enter a word using A-Z.", "red");
      terminalState.writeBlank();
      showPrompt();
      return;
    }

    // Start generation
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

    // Fake processing steps with dot animation
    await writeProcessingLine("Computing kinetic path", 10);
    if (cancelled) return;

    await writeProcessingLine("Resolving bridges", 10);
    if (cancelled) return;

    await writeProcessingLine("Calibrating prop physics", 10);
    if (cancelled) return;

    terminalState.writeBlank();

    // Render each letter as an ASCII pictograph
    step = "displaying";

    for (let i = 0; i < word.length; i++) {
      if (cancelled) return;

      const letter = word[i]!;
      const beatNum = i + 1;

      // Beat header
      terminalState.writeLine(`Beat ${beatNum}: ${letter}`, "cyan");

      // Generate and render the pictograph
      const pictData = createMockPictographData(letter);
      const asciiLines = renderer.renderPictograph(pictData);

      for (const line of asciiLines) {
        terminalState.writeHtml(line);
      }

      terminalState.writeBlank();

      // Small delay between beats for visual pacing
      await delay(200);
    }

    if (cancelled) return;

    // Summary
    terminalState.writeLine(
      `Sequence complete: ${word.length} beat${word.length !== 1 ? "s" : ""} generated.`,
      "white",
    );
    terminalState.writeBlank();

    // Done - return to menu
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
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    cancelled = false;
    showHeader();
    showPrompt();

    // Register input handler
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    cancelled = true;
    cleanup();
  });
</script>
