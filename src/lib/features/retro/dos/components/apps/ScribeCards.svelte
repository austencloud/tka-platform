<!--
  ScribeCards -- Sequence card viewer for the DOS-era SCRIBE utility.

  Displays 5 pre-built choreo cards as ASCII box art. The user selects
  a card by number from a list, then views the full card rendered with
  box-drawing characters, compact pictograph summaries for each beat,
  and metadata (constraint, date, notes).

  Navigation within a displayed card: [N]ext, [P]rev, [R]eturn to list.
  From the list view: enter a card number (1-5) or [R]eturn to menu.

  Input handling: receives lines via the `handleInput` export, called
  by DosTerminal when scribeMode === "cards".

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { BrailleHybridRenderer } from "../../services/braille-hybrid-renderer";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";
  import type { RetroPictographData } from "../../../shared/domain/pictograph-types";
  import { DosSoundManager } from "../../services/dos-sound-manager";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  interface Props {
    /** Called when Cards mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* ------------------------------------------------------------------ */
  /* Services                                                            */
  /* ------------------------------------------------------------------ */

  const renderer = new BrailleHybridRenderer();
  const soundManager = new DosSoundManager();

  /* ------------------------------------------------------------------ */
  /* Card data                                                           */
  /* ------------------------------------------------------------------ */

  interface DosCard {
    readonly word: string;
    readonly letters: string[];
    readonly beats: RetroPictographData[];
    readonly constraint: string;
    readonly date: string;
    readonly notes: string;
  }

  const CARDS: DosCard[] = [
    {
      word: "BOOK",
      letters: ["B", "O", "O", "K"],
      beats: ["B", "O", "O", "K"].map(createMockPictographData),
      constraint: "Smooth",
      date: "06/15/1989",
      notes: "A gripping page-turner",
    },
    {
      word: "FLOW",
      letters: ["F", "L", "O", "W"],
      beats: ["F", "L", "O", "W"].map(createMockPictographData),
      constraint: "Smooth",
      date: "06/15/1989",
      notes: "Like water through a pipe",
    },
    {
      word: "SPIN",
      letters: ["S", "P", "I", "N"],
      beats: ["S", "P", "I", "N"].map(createMockPictographData),
      constraint: "Reversal",
      date: "06/15/1989",
      notes: "Round and round we go",
    },
    {
      word: "CAKE",
      letters: ["C", "A", "K", "E"],
      beats: ["C", "A", "K", "E"].map(createMockPictographData),
      constraint: "Smooth",
      date: "06/15/1989",
      notes: "Layers of complexity",
    },
    {
      word: "NOVA",
      letters: ["N", "O", "V", "A"],
      beats: ["N", "O", "V", "A"].map(createMockPictographData),
      constraint: "None",
      date: "06/15/1989",
      notes: "A star's dramatic exit",
    },
  ];

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  /** Whether the user is viewing a card or the list. */
  type CardsView = "list" | "card";

  let currentView: CardsView = "list";
  let currentIndex: number = 0;

  /* ------------------------------------------------------------------ */
  /* Box-drawing constants                                               */
  /* ------------------------------------------------------------------ */

  /** Card frame width (interior content width, excluding border chars) */
  const FRAME_WIDTH = 42;

  /** Box-drawing characters */
  const TL = "\u2554"; // top-left double corner
  const TR = "\u2557"; // top-right double corner
  const BL = "\u255A"; // bottom-left double corner
  const BR = "\u255D"; // bottom-right double corner
  const HZ = "\u2550"; // horizontal double line
  const VT = "\u2551"; // vertical double line
  const ML = "\u2560"; // mid-left tee
  const MR = "\u2563"; // mid-right tee

  /* ------------------------------------------------------------------ */
  /* Drawing helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Build a horizontal border line */
  function hBorder(left: string, right: string): string {
    return left + HZ.repeat(FRAME_WIDTH) + right;
  }

  /** Build a content line padded to the frame width */
  function contentLine(text: string): string {
    const padded = text.length < FRAME_WIDTH
      ? text + " ".repeat(FRAME_WIDTH - text.length)
      : text.slice(0, FRAME_WIDTH);
    return VT + padded + VT;
  }

  /** Build an empty content line */
  function emptyLine(): string {
    return contentLine("");
  }

  /* ------------------------------------------------------------------ */
  /* List view                                                           */
  /* ------------------------------------------------------------------ */

  function drawList(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== SEQUENCE CARDS ===", "white");
    terminalState.writeBlank();
    terminalState.writeLine("Available cards:");
    terminalState.writeBlank();

    for (let i = 0; i < CARDS.length; i++) {
      const card = CARDS[i]!;
      terminalState.writeLine(`  ${i + 1}) ${card.word}  -  "${card.notes}"`);
    }

    terminalState.writeBlank();
    terminalState.promptString = "  Enter card # (1-5) or [R]eturn: ";
  }

  /* ------------------------------------------------------------------ */
  /* Card view - render full ASCII card                                  */
  /* ------------------------------------------------------------------ */

  function drawCard(index: number): void {
    const card = CARDS[index]!;

    terminalState.writeBlank();

    // Top border
    terminalState.writeLine(hBorder(TL, TR));

    // Title section
    terminalState.writeLine(contentLine(`  Sequence: ${card.word}`));
    terminalState.writeLine(contentLine(`  Constraint: ${card.constraint}`));
    terminalState.writeLine(contentLine(`  Date: ${card.date}`));

    // Section separator
    terminalState.writeLine(hBorder(ML, MR));

    // Empty padding line
    terminalState.writeLine(emptyLine());

    // Render beats in pairs (2 per row)
    for (let row = 0; row < card.beats.length; row += 2) {
      const beat1 = card.beats[row]!;
      const letter1 = card.letters[row]!;
      const compact1 = renderer.renderCompact(beat1);

      let headerText: string;
      let compactText: string;

      if (row + 1 < card.beats.length) {
        const beat2 = card.beats[row + 1]!;
        const letter2 = card.letters[row + 1]!;
        const compact2 = renderer.renderCompact(beat2);

        // Build header line: "  Beat 1: B     Beat 2: O"
        const h1 = `Beat ${row + 1}: ${letter1}`;
        const h2 = `Beat ${row + 2}: ${letter2}`;
        headerText = `  ${h1}${" ".repeat(Math.max(1, 14 - h1.length))}${h2}`;

        // Compact pictographs are HTML - write them as raw HTML lines
        compactText = `  ${compact1}  ${compact2}`;
      } else {
        // Odd beat at the end (solo)
        headerText = `  Beat ${row + 1}: ${letter1}`;
        compactText = `  ${compact1}`;
      }

      // The header is plain text, pad to frame width
      terminalState.writeLine(contentLine(headerText));

      // The compact line contains HTML spans, so we build the framed line manually
      const compactFramed = VT + "  " + compactText;
      // Pad the right side (approximate since HTML tags don't take visual space)
      terminalState.writeHtml(compactFramed);

      // Empty padding between rows
      terminalState.writeLine(emptyLine());
    }

    // Notes separator
    terminalState.writeLine(hBorder(ML, MR));

    // Notes line
    terminalState.writeLine(contentLine(`  Notes: ${card.notes}`));

    // Bottom border
    terminalState.writeLine(hBorder(BL, BR));

    terminalState.writeBlank();

    // Navigation footer
    const cardNum = `Card ${index + 1} of ${CARDS.length}`;
    terminalState.writeLine(`  ${cardNum}`, "gray");
    terminalState.promptString = "  [N]ext  [P]rev  [R]eturn: ";
  }

  /* ------------------------------------------------------------------ */
  /* Input handler                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Process input from the terminal.
   * Registered on terminalState.inputHandler during mount.
   */
  function handleInput(input: string): void {
    const trimmed = input.trim().toUpperCase();

    if (currentView === "list") {
      handleListInput(trimmed);
    } else {
      handleCardInput(trimmed);
    }
  }

  function handleListInput(input: string): void {
    // Return to SCRIBE menu
    if (input === "R" || input === "RETURN") {
      soundManager.menuSelect();
      cleanup();
      onreturn();
      return;
    }

    // Card selection by number
    const num = parseInt(input, 10);
    if (num >= 1 && num <= CARDS.length) {
      soundManager.menuSelect();
      currentIndex = num - 1;
      currentView = "card";
      drawCard(currentIndex);
      return;
    }

    // Invalid input
    soundManager.error();
    terminalState.writeLine("  Invalid selection. Enter 1-5 or R to return.");
  }

  function handleCardInput(input: string): void {
    switch (input) {
      case "N":
      case "NEXT": {
        if (currentIndex < CARDS.length - 1) {
          soundManager.menuSelect();
          currentIndex++;
          drawCard(currentIndex);
        } else {
          soundManager.error();
          terminalState.writeLine("  Already at last card.");
          terminalState.promptString = "  [N]ext  [P]rev  [R]eturn: ";
        }
        break;
      }
      case "P":
      case "PREV": {
        if (currentIndex > 0) {
          soundManager.menuSelect();
          currentIndex--;
          drawCard(currentIndex);
        } else {
          soundManager.error();
          terminalState.writeLine("  Already at first card.");
          terminalState.promptString = "  [N]ext  [P]rev  [R]eturn: ";
        }
        break;
      }
      case "R":
      case "RETURN": {
        soundManager.menuSelect();
        currentView = "list";
        drawList();
        break;
      }
      default: {
        // Also accept card numbers directly while viewing
        const num = parseInt(input, 10);
        if (num >= 1 && num <= CARDS.length) {
          soundManager.menuSelect();
          currentIndex = num - 1;
          drawCard(currentIndex);
        } else {
          soundManager.error();
          terminalState.writeLine("  Use [N]ext, [P]rev, or [R]eturn.");
          terminalState.promptString = "  [N]ext  [P]rev  [R]eturn: ";
        }
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    currentView = "list";
    currentIndex = 0;
    drawList();
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    if (terminalState.inputHandler === handleInput) {
      terminalState.inputHandler = null;
    }
  });
</script>
