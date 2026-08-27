<!--
  ScribeConstruct -- Step-by-step beat construction mode for SCRIBE.

  Lets the user build a sequence one beat at a time via text prompts.
  Commands: [A]dd beat, [R]emove last, [V]iew sequence, [C]lear, [D]one.
  Adding a beat walks through sub-prompts for letter, motion type,
  CW turns, and CCW turns before appending to the beat list.

  Input handling: receives input lines via the exported `handleInput`
  function, called by DosTerminal when scribeMode === "construct".

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { BrailleHybridRenderer } from "../../services/braille-hybrid-renderer";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";
  import { DosSoundManager } from "../../services/dos-sound-manager";

  /* Props                                                               */

  interface Props {
    /** Called when Construct mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  /* Services                                                            */

  const renderer = new BrailleHybridRenderer();
  const soundManager = new DosSoundManager();

  /* Beat data model                                                     */

  interface ConstructBeat {
    letter: string;
    motion: string;
    cw: number;
    ccw: number;
  }

  let beats = $state<ConstructBeat[]>([]);

  /* Sub-prompt state machine                                            */
  /*                                                                     */
  /* The construct mode uses a multi-step prompt for adding beats:       */
  /*   "main"   -> top-level action menu (A/R/V/C/D)                    */
  /*   "letter" -> enter letter name                                    */
  /*   "motion" -> select motion type                                   */
  /*   "cw"     -> enter CW turns                                       */
  /*   "ccw"    -> enter CCW turns                                      */

  type ConstructStep = "main" | "letter" | "motion" | "cw" | "ccw";

  let currentStep = $state<ConstructStep>("main");

  /** Partial beat being assembled during the add flow */
  let pendingLetter = $state("");
  let pendingMotion = $state("");
  let pendingCW = $state(0);

  /* Valid letter names (A-Z plus Greek letters)                          */

  const GREEK_LETTERS = new Set([
    "SIGMA", "PHI", "THETA", "PSI", "LAMBDA",
  ]);

  function isValidLetter(input: string): boolean {
    const upper = input.toUpperCase();
    if (upper.length === 1 && upper >= "A" && upper <= "Z") return true;
    return GREEK_LETTERS.has(upper);
  }

  /** Normalize letter for display: single chars uppercase, Greek capitalized */
  function formatLetter(input: string): string {
    const upper = input.toUpperCase();
    if (upper.length === 1) return upper;
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  }

  /* Valid motion types                                                   */

  const MOTION_MAP: Record<string, string> = {
    "P": "Pro",
    "A": "Anti",
    "S": "Static",
    "D": "Dash",
  };

  /* Turn validation                                                     */

  function isValidTurns(input: string): boolean {
    const num = parseFloat(input);
    if (isNaN(num)) return false;
    if (num < 0 || num > 3) return false;
    // Must be in 0.5 increments: 0, 0.5, 1, 1.5, 2, 2.5, 3
    return num % 0.5 === 0;
  }

  /* Drawing helpers                                                     */

  function drawHeader(): void {
    terminalState.writeBlank();
    terminalState.writeLine("=== CONSTRUCT SEQUENCE ===", "white");
    terminalState.writeBlank();
  }

  function drawStatus(): void {
    if (beats.length === 0) {
      terminalState.writeLine("Current sequence: (empty)");
    } else {
      const letters = beats.map(b => formatLetter(b.letter)).join(", ");
      terminalState.writeLine(`Current sequence: ${letters} (${beats.length} beat${beats.length === 1 ? "" : "s"})`);
    }
    terminalState.writeBlank();
  }

  function drawMainPrompt(): void {
    terminalState.writeLine("[A]dd beat  [R]emove last  [V]iew sequence  [C]lear  [D]one");
    terminalState.promptString = "Select: ";
  }

  function drawLetterPrompt(): void {
    terminalState.writeLine("Enter letter (A-Z, or SIGMA/PHI/THETA/PSI/LAMBDA):");
    terminalState.promptString = "Letter: ";
  }

  function drawMotionPrompt(): void {
    terminalState.writeLine("Motion type [P]ro [A]nti [S]tatic [D]ash:");
    terminalState.promptString = "Motion: ";
  }

  function drawCWPrompt(): void {
    terminalState.writeLine("CW turns (0-3, 0.5 step):");
    terminalState.promptString = "CW: ";
  }

  function drawCCWPrompt(): void {
    terminalState.writeLine("CCW turns (0-3, 0.5 step):");
    terminalState.promptString = "CCW: ";
  }

  /* ------------------------------------------------------------------ */
  /* View sequence: render all beats as ASCII pictographs                 */
  /* ------------------------------------------------------------------ */

  function viewSequence(): void {
    if (beats.length === 0) {
      terminalState.writeLine("No beats to display.", "gray");
      terminalState.writeBlank();
      return;
    }

    terminalState.writeBlank();
    terminalState.writeLine("--- Sequence View ---", "white");
    terminalState.writeBlank();

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i]!;
      const label = formatLetter(beat.letter);
      terminalState.writeLine(`Beat ${i + 1}: ${label} - ${beat.motion} - CW:${beat.cw} CCW:${beat.ccw}`, "cyan");

      // Use the first character for mock data generation
      const letterChar = beat.letter.length === 1 ? beat.letter : beat.letter.charAt(0);
      const pictData = createMockPictographData(letterChar);
      const asciiLines = renderer.renderPictograph(pictData);
      for (const line of asciiLines) {
        terminalState.writeHtml(line);
      }
      terminalState.writeBlank();
    }

    terminalState.writeLine(`--- ${beats.length} beat${beats.length === 1 ? "" : "s"} ---`, "white");
    terminalState.writeBlank();
  }

  /* ------------------------------------------------------------------ */
  /* Input handler - registered on terminalState.inputHandler            */
  /* ------------------------------------------------------------------ */

  function handleInput(input: string): void {
    const trimmed = input.trim();

    switch (currentStep) {
      case "main":
        handleMainInput(trimmed);
        break;
      case "letter":
        handleLetterInput(trimmed);
        break;
      case "motion":
        handleMotionInput(trimmed);
        break;
      case "cw":
        handleCWInput(trimmed);
        break;
      case "ccw":
        handleCCWInput(trimmed);
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Main menu input: A/R/V/C/D                                          */
  /* ------------------------------------------------------------------ */

  function handleMainInput(input: string): void {
    const upper = input.toUpperCase();

    switch (upper) {
      case "A": {
        soundManager.menuSelect();
        currentStep = "letter";
        drawLetterPrompt();
        break;
      }
      case "R": {
        if (beats.length === 0) {
          soundManager.error();
          terminalState.writeLine("No beats to remove.", "red");
          terminalState.writeBlank();
          drawMainPrompt();
        } else {
          soundManager.beep();
          const removed = beats.pop()!;
          terminalState.writeLine(`Removed beat ${beats.length + 1}: ${formatLetter(removed.letter)}`, "gray");
          terminalState.writeBlank();
          drawStatus();
          drawMainPrompt();
        }
        break;
      }
      case "V": {
        soundManager.menuSelect();
        viewSequence();
        drawMainPrompt();
        break;
      }
      case "C": {
        if (beats.length === 0) {
          soundManager.error();
          terminalState.writeLine("Sequence is already empty.", "red");
          terminalState.writeBlank();
        } else {
          soundManager.beep();
          const count = beats.length;
          beats = [];
          terminalState.writeLine(`Cleared ${count} beat${count === 1 ? "" : "s"}.`, "gray");
          terminalState.writeBlank();
        }
        drawStatus();
        drawMainPrompt();
        break;
      }
      case "D": {
        soundManager.menuSelect();
        if (beats.length > 0) {
          terminalState.writeLine(`Sequence complete: ${beats.length} beat${beats.length === 1 ? "" : "s"} constructed.`, "white");
        } else {
          terminalState.writeLine("No sequence constructed.");
        }
        terminalState.writeBlank();
        terminalState.writeLine("Returning to menu...");
        terminalState.writeBlank();
        currentStep = "main";
        beats = [];
        cleanup();
        onreturn();
        break;
      }
      default: {
        soundManager.error();
        terminalState.writeLine("Invalid selection. Use A, R, V, C, or D.", "red");
        terminalState.writeBlank();
        drawMainPrompt();
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Letter input step                                                   */
  /* ------------------------------------------------------------------ */

  function handleLetterInput(input: string): void {
    if (input.length === 0) {
      soundManager.error();
      terminalState.writeLine("No letter entered. Try again.", "red");
      drawLetterPrompt();
      return;
    }

    if (!isValidLetter(input)) {
      soundManager.error();
      terminalState.writeLine(`"${input.toUpperCase()}" is not a valid letter. Use A-Z or SIGMA/PHI/THETA/PSI/LAMBDA.`, "red");
      drawLetterPrompt();
      return;
    }

    soundManager.beep();
    pendingLetter = input.toUpperCase();
    currentStep = "motion";
    drawMotionPrompt();
  }

  /* ------------------------------------------------------------------ */
  /* Motion type input step                                              */
  /* ------------------------------------------------------------------ */

  function handleMotionInput(input: string): void {
    const upper = input.toUpperCase();
    const motionName = MOTION_MAP[upper];

    if (!motionName) {
      soundManager.error();
      terminalState.writeLine("Invalid motion type. Use P, A, S, or D.", "red");
      drawMotionPrompt();
      return;
    }

    soundManager.beep();
    pendingMotion = motionName;
    currentStep = "cw";
    drawCWPrompt();
  }

  /* ------------------------------------------------------------------ */
  /* CW turns input step                                                 */
  /* ------------------------------------------------------------------ */

  function handleCWInput(input: string): void {
    if (!isValidTurns(input)) {
      soundManager.error();
      terminalState.writeLine("Invalid. Enter a number 0-3 in 0.5 steps (e.g., 0, 0.5, 1, 1.5, 2).", "red");
      drawCWPrompt();
      return;
    }

    soundManager.beep();
    pendingCW = parseFloat(input);
    currentStep = "ccw";
    drawCCWPrompt();
  }

  /* ------------------------------------------------------------------ */
  /* CCW turns input step - completes the beat                           */
  /* ------------------------------------------------------------------ */

  function handleCCWInput(input: string): void {
    if (!isValidTurns(input)) {
      soundManager.error();
      terminalState.writeLine("Invalid. Enter a number 0-3 in 0.5 steps (e.g., 0, 0.5, 1, 1.5, 2).", "red");
      drawCCWPrompt();
      return;
    }

    soundManager.beep();
    const ccw = parseFloat(input);

    const newStep: ConstructBeat = {
      letter: pendingLetter,
      motion: pendingMotion,
      cw: pendingCW,
      ccw: ccw,
    };

    beats.push(newStep);

    terminalState.writeBlank();
    terminalState.writeLine(
      `Beat ${beats.length} added: ${formatLetter(newStep.letter)} - ${newStep.motion} - CW:${newStep.cw} CCW:${newStep.ccw}`,
      "cyan",
    );
    terminalState.writeBlank();

    // Reset sub-prompt state
    currentStep = "main";
    pendingLetter = "";
    pendingMotion = "";
    pendingCW = 0;

    drawStatus();
    drawMainPrompt();
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    drawHeader();
    drawStatus();
    drawMainPrompt();
    terminalState.inputHandler = handleInput;
  });

  onDestroy(() => {
    if (terminalState.inputHandler === handleInput) {
      terminalState.inputHandler = null;
    }
  });
</script>
