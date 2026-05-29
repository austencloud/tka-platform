<!--
  ScribeMenu - Main menu for the SCRIBE notation utility.

  Renders a box-drawn menu to the terminal buffer with options 1-7
  (Generate, Construct, Spell, Browse, Cards, Tutorial, Configuration)
  and 0 to exit back to the DOS prompt.

  On mount, draws the menu and registers an input handler on
  terminalState. A digit 1-7 transitions to the corresponding
  ScribeMode; 0 exits to the DOS prompt. Any other input shows
  an error. On destroy, the handler is cleared.

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import type { ScribeMode } from "../../domain/dos-types";
  import { DosSoundManager } from "../../services/dos-sound-manager";

  const soundManager = new DosSoundManager();

  /**
   * Map of digit keys to their corresponding SCRIBE sub-mode.
   * "0" is handled separately as exit-to-DOS.
   */
  const MENU_SELECTIONS: Record<string, ScribeMode> = {
    "1": "generate",
    "2": "construct",
    "3": "spell",
    "4": "browse",
    "5": "cards",
    "6": "tutorial",
    "7": "config",
  };

  /** Menu width (interior character count between the vertical bars). */
  const BOX_WIDTH = 42;

  /** Build the box-drawn menu frame. */
  function buildMenuLines(): string[] {
    const h = "\u2550"; // ═
    const topLeft = "\u2554"; // ╔
    const topRight = "\u2557"; // ╗
    const bottomLeft = "\u255A"; // ╚
    const bottomRight = "\u255D"; // ╝
    const vert = "\u2551"; // ║
    const midLeft = "\u2560"; // ╠
    const midRight = "\u2563"; // ╣

    const hBar = h.repeat(BOX_WIDTH);
    const emptyRow = vert + " ".repeat(BOX_WIDTH) + vert;

    return [
      topLeft + hBar + topRight,
      vert + "  BELLWEATHER NOTATION UTILITY v1.0       " + vert,
      vert + "  TKAUTIL.COM \u2014 Order Directive 7         " + vert,
      midLeft + hBar + midRight,
      emptyRow,
      vert + "   1) Generate Sequence                   " + vert,
      vert + "   2) Construct Sequence                  " + vert,
      vert + "   3) Spell Word                          " + vert,
      vert + "   4) Browse Library                      " + vert,
      vert + "   5) View Sequence Cards                 " + vert,
      vert + "   6) Tutorial                            " + vert,
      vert + "   7) Configuration                       " + vert,
      emptyRow,
      vert + "   0) Exit to DOS                         " + vert,
      emptyRow,
      bottomLeft + hBar + bottomRight,
    ];
  }

  const MENU_LINES = buildMenuLines();

  /** Write the menu frame to the terminal buffer and set the prompt. */
  function drawMenu(): void {
    terminalState.writeBlank();
    for (const line of MENU_LINES) {
      terminalState.writeLine(line);
    }
    terminalState.writeBlank();
    terminalState.promptString = "  Enter selection: ";
  }

  /**
   * Process a single line of input from the terminal.
   * Registered on terminalState.inputHandler so DosTerminal routes here.
   */
  function onInput(input: string): void {
    const trimmed = input.trim();

    // Exit to DOS prompt
    if (trimmed === "0") {
      soundManager.menuSelect();
      terminalState.writeBlank();
      terminalState.writeLine("Returning to DOS...");
      terminalState.writeBlank();
      terminalState.inputHandler = null;
      terminalState.promptString = "C:\\BELLWTHR>";
      terminalState.mode = "prompt";
      terminalState.scribeMode = "menu";
      return;
    }

    // Select a SCRIBE sub-mode
    const targetMode = MENU_SELECTIONS[trimmed];
    if (targetMode) {
      soundManager.menuSelect();
      // Clear handler before transitioning - the sub-mode component
      // will register its own handler when it mounts.
      terminalState.inputHandler = null;
      terminalState.scribeMode = targetMode;
      return;
    }

    // Invalid input - play error sound if sound is enabled
    soundManager.setMuted(!terminalState.soundEnabled);
    soundManager.error();
    terminalState.writeLine("Invalid selection. Enter 0-7.");
  }

  onMount(() => {
    drawMenu();
    terminalState.inputHandler = onInput;
  });

  onDestroy(() => {
    // Only clear if we're still the active handler
    if (terminalState.inputHandler === onInput) {
      terminalState.inputHandler = null;
    }
  });
</script>
