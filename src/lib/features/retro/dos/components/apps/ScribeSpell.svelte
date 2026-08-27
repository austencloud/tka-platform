<!--
  ScribeSpell - Spell a word letter-by-letter with TKA notation names.

  Prompts for a word, fakes a processing pipeline with timed status
  messages, outputs each letter mapped to its TKA name (B -> Beta,
  O -> Omicron, etc.), then renders ASCII pictographs for each letter
  via AsciiRenderer.

  Communication pattern: writes output to terminalState, reads input
  via the oninput callback wired from DosTerminal's keyboard handler.

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { BrailleHybridRenderer } from "../../services/braille-hybrid-renderer";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";

  interface Props {
    /** Called when Spell mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* Services                                                            */

  const renderer = new BrailleHybridRenderer();

  /* TKA letter-name mapping                                             */

  const TKA_NAME_MAP: Record<string, string> = {
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
    Q: "Koppa",
    R: "Rho",
    S: "Sigma",
    T: "Tau",
    U: "Upsilon",
    V: "Theta",
    W: "Omega",
    X: "Xi",
    Y: "Psi",
    Z: "Zeta",
  };

  /* Internal state                                                      */

  type Phase = "prompt" | "processing" | "done";

  let phase = $state<Phase>("prompt");

  /* Input handler - registered on terminalState.inputHandler            */

  function handleInput(input: string): void {
    if (phase === "done") {
      // Any input after results returns to menu
      cleanup();
      onreturn();
      return;
    }

    if (phase !== "prompt") return;

    const word = input.trim().toUpperCase();
    if (word.length === 0) {
      terminalState.writeLine("No word entered.");
      terminalState.writeBlank();
      showPrompt();
      return;
    }

    // Filter to alphabetic characters only
    const letters = word.replace(/[^A-Z]/g, "");
    if (letters.length === 0) {
      terminalState.writeLine("No valid letters found.", "red");
      terminalState.writeBlank();
      showPrompt();
      return;
    }

    runSpell(letters);
  }

  /* Show header and initial prompt                                      */

  function showHeader(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== SPELL WORD ===", "white");
    terminalState.writeBlank();
  }

  function showPrompt(): void {
    phase = "prompt";
    terminalState.promptString = "Word> ";
  }

  /* Processing pipeline                                                 */

  async function runSpell(word: string): Promise<void> {
    phase = "processing";
    terminalState.inputEnabled = false;

    terminalState.writeBlank();
    terminalState.writeLine(`Spelling: ${word}`, "white");

    // Fake processing steps with animated dots
    const steps = [
      "Mapping letters",
      "Resolving letter variants",
    ];

    for (const step of steps) {
      await delay(300);
      const dots = ".".repeat(30 - step.length);
      terminalState.writeLine(`${step}${dots} OK`);
    }

    await delay(300);
    terminalState.writeBlank();

    // Letter-to-name mapping output
    const letters = word.split("");
    for (const letter of letters) {
      const tkaName = TKA_NAME_MAP[letter] ?? letter;
      terminalState.writeHtml(
        `<span class="dos-white">${terminalState.escapeForDisplay(letter)}</span>` +
        `&nbsp;&nbsp;-&gt;&nbsp;&nbsp;` +
        `<span class="dos-green">${terminalState.escapeForDisplay(tkaName)}</span>`
      );
    }

    terminalState.writeBlank();

    // Render ASCII pictographs for each letter
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i]!;
      const tkaName = TKA_NAME_MAP[letter] ?? letter;

      terminalState.writeLine(`Beat ${i + 1}: ${letter} (${tkaName})`, "cyan");

      const pictographData = createMockPictographData(letter);
      const asciiLines = renderer.renderPictograph(pictographData);

      for (const line of asciiLines) {
        terminalState.writeHtml(line);
      }

      terminalState.writeBlank();
    }

    // Summary
    terminalState.writeLine(
      `${letters.length} letter${letters.length === 1 ? "" : "s"} spelled.`,
      "white",
    );
    terminalState.writeBlank();
    terminalState.writeLine("Press ENTER to return to menu.", "gray");

    phase = "done";
    terminalState.inputEnabled = true;
    terminalState.promptString = "";
  }

  /* ------------------------------------------------------------------ */
  /* Utility                                                             */
  /* ------------------------------------------------------------------ */

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    showHeader();
    showPrompt();
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    if (terminalState.inputHandler === handleInput) {
      terminalState.inputHandler = null;
    }
  });
</script>
