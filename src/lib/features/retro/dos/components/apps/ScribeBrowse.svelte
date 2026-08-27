<!--
  ScribeBrowse - Sequence library browser for SCRIBE.

  Lists .SEQ files from the SEQUENCES directory in authentic DOS DIR
  format, prompts for a filename, renders ASCII pictographs for that
  word, then returns to the listing. Empty input or ESC returns to
  the SCRIBE menu.

  Communication pattern: writes output to terminalState, reads input
  via the inputHandler callback wired from DosTerminal's keyboard handler.

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { DosFileSystem } from "../../services/dos-file-system";
  import { BrailleHybridRenderer } from "../../services/braille-hybrid-renderer";
  import { DosSoundManager } from "../../services/dos-sound-manager";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";
  import type { DosFile } from "../../domain/dos-types";

  /* Props                                                               */

  interface Props {
    /** Called when Browse mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* Services                                                            */

  const fs = new DosFileSystem();
  const renderer = new BrailleHybridRenderer();
  const soundManager = new DosSoundManager();

  /* Internal state                                                      */

  /**
   * Internal phase of the browse UI.
   *
   * "listing" - showing the DIR output and waiting for a filename.
   * "viewing" - rendering pictographs for a chosen sequence.
   */
  type BrowsePhase = "listing" | "viewing";

  let phase = $state<BrowsePhase>("listing");

  /** The .SEQ files discovered from the SEQUENCES directory. */
  let seqFiles: DosFile[] = [];

  /* Directory listing                                                   */

  /** Navigate into SEQUENCES and read .SEQ files. */
  function loadSequenceFiles(): void {
    // The DosFileSystem starts at C:\BELLWTHR, so SEQUENCES is a relative child
    const moved = fs.changeDir("SEQUENCES");
    if (moved) {
      seqFiles = fs.listFiles("*.SEQ");
      // Navigate back up to BELLWTHR
      fs.changeDir("..");
    } else {
      seqFiles = [];
    }
  }

  /** Write the DIR-style listing to the terminal buffer. */
  function drawListing(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== SEQUENCE LIBRARY ===", "white");
    terminalState.writeBlank();
    terminalState.writeLine(" Directory of C:\\BELLWTHR\\SEQUENCES");
    terminalState.writeBlank();

    if (seqFiles.length === 0) {
      terminalState.writeLine("  No sequence files found.", "gray");
    } else {
      for (const file of seqFiles) {
        const name = file.name.padEnd(8, " ");
        const ext = file.ext.padEnd(3, " ");
        const size = String(file.size).padStart(9, " ");
        terminalState.writeLine(`${name} ${ext}  ${size}  ${file.date}`);
      }
    }

    terminalState.writeBlank();
    terminalState.writeLine(`      ${seqFiles.length} file(s)`);
    terminalState.writeBlank();
    showPrompt();
    phase = "listing";
  }

  /* ------------------------------------------------------------------ */
  /* Sequence viewing                                                    */
  /* ------------------------------------------------------------------ */

  /** Render ASCII pictographs for each letter in the word. */
  function viewSequence(word: string): void {
    phase = "viewing";
    soundManager.beep();

    terminalState.writeBlank();
    terminalState.writeLine(`Loading ${word}.SEQ...`, "white");
    terminalState.writeBlank();

    const letters = word.split("");
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i]!;
      terminalState.writeLine(`Beat ${i + 1}: ${letter}`, "cyan");

      const pictData = createMockPictographData(letter);
      const asciiLines = renderer.renderPictograph(pictData);
      for (const line of asciiLines) {
        terminalState.writeHtml(line);
      }

      terminalState.writeBlank();
    }

    terminalState.writeLine(
      `Sequence complete: ${letters.length} beats loaded from ${word}.SEQ`,
      "white",
    );
    terminalState.writeBlank();

    // Return to listing after viewing
    drawListing();
  }

  /* ------------------------------------------------------------------ */
  /* Input handler                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Process a line of input from the terminal.
   * Registered via terminalState.inputHandler on mount.
   */
  function handleInput(input: string): void {
    const trimmed = input.trim().toUpperCase();

    // Empty input - return to SCRIBE menu
    if (trimmed === "") {
      cleanup();
      onreturn();
      return;
    }

    if (phase === "listing") {
      // Strip .SEQ extension if the user typed it
      const baseName = trimmed.replace(/\.SEQ$/i, "");

      // Check if this filename matches a known sequence file
      const match = seqFiles.find((f) => f.name === baseName);
      if (match) {
        viewSequence(match.name);
      } else {
        soundManager.error();
        terminalState.writeLine(`File not found: ${trimmed}`, "red");
        terminalState.writeLine(
          "Available files: " + seqFiles.map((f) => f.name).join(", "),
        );
        terminalState.writeBlank();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* UI helpers                                                          */
  /* ------------------------------------------------------------------ */

  function showPrompt(): void {
    terminalState.promptString = "Enter filename to view (or ENTER to return): ";
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    loadSequenceFiles();
    drawListing();

    // Register input handler so DosTerminal routes input here
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    cleanup();
  });
</script>
