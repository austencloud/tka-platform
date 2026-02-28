<!--
  ScribeTutorial — Text-based educational content for SCRIBE.

  Five paginated lessons covering TKA fundamentals: what TKA is, letter
  types, grid positions, turns and rotation, and building sequences.
  Each lesson is displayed page by page, advancing with ENTER and
  returning to the lesson index (or SCRIBE menu) with ESC.

  Input handling: receives lines via the exported `handleInput` function.
  ENTER advances pages, ESC backs out, and digit keys select lessons
  from the index.

  Tone: Bellweather Technical Institute field manual. Cold, precise,
  institutional. As if you found a training terminal in a government
  basement.

  Domain: Retro DOS Terminal / SCRIBE App
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { terminalState } from "../../state/terminal-state.svelte";
  import { DosSoundManager } from "../../services/implementations/DosSoundManager";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  interface Props {
    /** Called when Tutorial mode finishes and should return to menu */
    onreturn: () => void;
  }

  let { onreturn }: Props = $props();

  const soundManager = new DosSoundManager();

  /* ------------------------------------------------------------------ */
  /* Tutorial state                                                      */
  /* ------------------------------------------------------------------ */

  /** Current view: index (lesson selection) or lesson (reading pages) */
  let view = $state<"index" | "lesson">("index");

  /** Currently selected lesson index (0-4) */
  let currentLesson = $state(0);

  /** Current page within the active lesson (0-based) */
  let currentPage = $state(0);

  /* ------------------------------------------------------------------ */
  /* Lesson content                                                      */
  /* ------------------------------------------------------------------ */

  interface TutorialPage {
    readonly lines: readonly string[];
  }

  interface TutorialLesson {
    readonly title: string;
    readonly pages: readonly TutorialPage[];
  }

  const LESSONS: readonly TutorialLesson[] = [
    {
      title: "What is TKA?",
      pages: [
        {
          lines: [
            "LESSON 1: WHAT IS TKA?",
            "Page 1 of 3",
            "",
            "The Kinetic Alphabet (TKA) is a notation system for recording",
            "and reproducing movement patterns performed with dual-wielded",
            "props. Developed under Bellweather Technical Institute charter",
            "and classified under Order Directive 7.",
            "",
            "TKA encodes the spatial relationship between two hands and",
            "the motions they trace. Each letter captures a unique",
            "geometric configuration of hand positions and paths.",
            "",
            "The canonical prop is the double staff. Each staff has two",
            "visible ends: one is the consistent thumb reference, the",
            "other is the consistent pinky reference. With proper",
            "technique, these references never change.",
          ],
        },
        {
          lines: [
            "LESSON 1: WHAT IS TKA?",
            "Page 2 of 3",
            "",
            "Purpose of the system:",
            "",
            "  1. RECORD    - Capture movement in precise, unambiguous text",
            "  2. REPRODUCE - Another performer reads the notation and",
            "                 recreates the exact same movement",
            "  3. ANALYZE   - Break movement into discrete components for",
            "                 study and comparison",
            "  4. GENERATE  - Algorithmically produce new movement phrases",
            "                 from letter combinations",
            "",
            "TKA is NOT choreography. It is the alphabet of movement.",
            "Choreography is sentences. TKA provides the letters.",
          ],
        },
        {
          lines: [
            "LESSON 1: WHAT IS TKA?",
            "Page 3 of 3",
            "",
            "Scope and constraints:",
            "",
            "  - Designed for DUAL-WIELDED STATIC PROPS (staves, fans,",
            "    clubs, buugeng). Not poi. Not contact staff.",
            "  - Each letter describes ONE BEAT of movement for BOTH hands.",
            "  - A sequence is an ordered series of beats.",
            "  - The smallest rotational increment is 45 degrees.",
            "",
            "The system currently defines 26 letters organized into",
            "6 types. Additional letters exist for bridge transitions",
            "between words.",
            "",
            "Proceed to Lesson 2 for letter classification.",
          ],
        },
      ],
    },
    {
      title: "Letters & Types",
      pages: [
        {
          lines: [
            "LESSON 2: LETTERS & TYPES",
            "Page 1 of 3",
            "",
            "Every letter is classified by the motion family of each",
            "hand. There are three fundamental hand motions:",
            "",
            "  SHIFT  - Hand travels from one grid position to another",
            "  DASH   - Hand crosses through the grid diagonally",
            "  STATIC - Hand remains at its current position",
            "",
            "The six types arise from all pairings of these three",
            "motions across the two hands.",
          ],
        },
        {
          lines: [
            "LESSON 2: LETTERS & TYPES",
            "Page 2 of 3",
            "",
            "TYPE CLASSIFICATION TABLE:",
            "",
            "  Type 1 - Both hands SHIFT",
            "           Letters: A, B, C, G, Y, Z",
            "",
            "  Type 2 - One hand SHIFT + one hand DASH",
            "           Letters: D, E, F, I, J, Q",
            "",
            "  Type 3 - One hand SHIFT + one hand STATIC",
            "           Letters: K, L, M, N, O, P",
            "",
            "  Type 4 - One hand DASH + one hand STATIC",
            "           Letters: R, S, T",
            "",
            "  Type 5 - Both hands DASH",
            "           Letters: U, V, W, X",
            "",
            "  Type 6 - Both hands STATIC",
            "           Letters: H (only member)",
          ],
        },
        {
          lines: [
            "LESSON 2: LETTERS & TYPES",
            "Page 3 of 3",
            "",
            "Key principles:",
            "",
            "  - The TYPE tells you WHAT KIND of motions both hands",
            "    perform. It does not specify positions or directions.",
            "",
            '  - "Both hands move" is NOT unique to Type 1. Multiple',
            "    types have both hands moving. Type 1 specifically",
            "    means both SHIFT.",
            "",
            "  - Letters within a type share the same motion family",
            "    but differ in geometric relationship (same direction,",
            "    opposite direction, perpendicular, etc.)",
            "",
            "  - Greek-named letters (Alpha, Beta, Gamma, etc.) and",
            "    Latin-named letters coexist in the same alphabet.",
          ],
        },
      ],
    },
    {
      title: "Grid Positions",
      pages: [
        {
          lines: [
            "LESSON 3: GRID POSITIONS",
            "Page 1 of 3",
            "",
            "Hands occupy positions on a diamond grid. The grid has",
            "8 perimeter positions and 1 center position:",
            "",
            "             N",
            "             |",
            "        NW . + . NE",
            "          \\  |  /",
            "           \\ | /",
            "      W ----[o]---- E",
            "           / | \\",
            "          /  |  \\",
            "        SW . + . SE",
            "             |",
            "             S",
            "",
            "  N  = North      S  = South",
            "  E  = East       W  = West",
            "  NE = Northeast  SW = Southwest",
            "  NW = Northwest  SE = Southeast",
          ],
        },
        {
          lines: [
            "LESSON 3: GRID POSITIONS",
            "Page 2 of 3",
            "",
            "Terminology:",
            "",
            "  CARDINAL positions: N, S, E, W",
            "    Located on the main axes of the grid.",
            "",
            "  INTERCARDINAL positions: NE, NW, SE, SW",
            "    Located between cardinal positions.",
            "",
            "  CENTER position: the origin point [o]",
            "    Available at Level 5 and above.",
            "",
            "  Cardinal and intercardinal describe LOCATIONS on the",
            "  grid. Do not confuse with prop ORIENTATIONS (radial,",
            "  nonradial, interradial), which describe how the prop",
            "  is angled at a position.",
          ],
        },
        {
          lines: [
            "LESSON 3: GRID POSITIONS",
            "Page 3 of 3",
            "",
            "Grid modes:",
            "",
            "  DIAMOND mode - The default. Cardinal positions sit at",
            "  the top, bottom, left, and right. Intercardinal",
            "  positions sit at the diagonals.",
            "",
            "  BOX mode - Rotated 45 degrees. Intercardinal positions",
            "  move to the corners, and cardinal positions sit on the",
            "  edges. The geometric relationships change.",
            "",
            "  The grid mode affects which letters are available for",
            "  certain transitions. Some letters are grid-mode",
            "  invariant (they work the same in both modes). Others",
            "  permute between diamond and box.",
          ],
        },
      ],
    },
    {
      title: "Turns & Rotation",
      pages: [
        {
          lines: [
            "LESSON 4: TURNS & ROTATION",
            "Page 1 of 3",
            "",
            "Turns measure additional prop rotation beyond the base",
            "path. A turn is NOT a full circle.",
            "",
            "  1 TURN = 180 DEGREES of additional rotation",
            "",
            "This is a critical distinction. One turn is half a",
            "revolution, not a full revolution. The term is specific",
            "to TKA notation and differs from colloquial usage.",
            "",
            "  0   turns  -  No extra rotation. The prop follows",
            "                the hand path with no added spin.",
            "  0.5 turns  -  90 degrees additional rotation.",
            "  1   turn   -  180 degrees additional rotation.",
            "  1.5 turns  -  270 degrees additional rotation.",
            "  2   turns  -  360 degrees (one full revolution).",
            "  3   turns  -  540 degrees.",
          ],
        },
        {
          lines: [
            "LESSON 4: TURNS & ROTATION",
            "Page 2 of 3",
            "",
            "Rotation direction:",
            "",
            "  CW  = Clockwise rotation",
            "  CCW = Counter-clockwise rotation",
            "",
            "Each hand specifies its own turn count and direction",
            "independently. A beat might have:",
            "",
            "  Blue hand:  1.0 turn CW",
            "  Red hand:   0.5 turns CCW",
            "",
            "The combination of different turn values between hands",
            "creates visual texture. Low turn values produce clean,",
            "geometric patterns. Higher turn values add complexity",
            "and visual density to the movement.",
          ],
        },
        {
          lines: [
            "LESSON 4: TURNS & ROTATION",
            "Page 3 of 3",
            "",
            "Special rotation states:",
            "",
            "  FLOAT - A special 0-turn state where the prop",
            "  maintains its orientation regardless of hand path.",
            "  The prop does not rotate at all. One state only.",
            "",
            "  ZERO-TURN DASH - A directionless state. Since the",
            "  hand path is linear and there is no additional",
            "  rotation, there is only one possible outcome.",
            "",
            "Turn progression forms the foundation of the level",
            "system: Level 1 covers 0-turn motions, Level 2 adds",
            "whole turns, and Level 3 introduces half-turns and",
            "float. Each level expands the available vocabulary.",
          ],
        },
      ],
    },
    {
      title: "Building Sequences",
      pages: [
        {
          lines: [
            "LESSON 5: BUILDING SEQUENCES",
            "Page 1 of 3",
            "",
            "A sequence is a series of beats read left-to-right.",
            "Each beat contains one letter. The letter encodes the",
            "motion of both hands for that beat.",
            "",
            "Example sequence for the word BOOK:",
            "",
            "  Beat 1: B (Beta)    - both hands shift to same point",
            "  Beat 2: O (Omicron) - shift + static pairing",
            "  Beat 3: O (Omicron) - shift + static pairing",
            "  Beat 4: K (Kappa)   - shift + static pairing",
            "",
            "Each beat connects to the next. The end position of",
            "one beat becomes the start position of the next.",
          ],
        },
        {
          lines: [
            "LESSON 5: BUILDING SEQUENCES",
            "Page 2 of 3",
            "",
            "Methods of sequence creation:",
            "",
            "  GENERATE  - Input a word. The system maps each letter",
            "              to a TKA letter and computes a valid path",
            "              through the grid. Bridges are inserted",
            "              automatically where needed.",
            "",
            "  CONSTRUCT - Build a sequence beat by beat. Select the",
            "              letter, motion type, and turn values for",
            "              each beat manually.",
            "",
            "  SPELL     - Map a word letter-by-letter to its TKA",
            "              equivalents. Shows the notation name and",
            "              pictograph for each letter.",
          ],
        },
        {
          lines: [
            "LESSON 5: BUILDING SEQUENCES",
            "Page 3 of 3",
            "",
            "Bridge letters:",
            "",
            "  Some letter-to-letter transitions are not directly",
            "  possible. The end position of one letter may not",
            "  match any valid start position of the next.",
            "",
            "  In these cases, a BRIDGE letter is inserted. Bridge",
            "  letters are transition beats that move the hands from",
            "  one configuration to another.",
            "",
            "  The constrained sequence builder handles bridges",
            "  automatically using beam search with backtracking.",
            "",
            "End of tutorial. Return to the SCRIBE menu to begin",
            "generating, constructing, or spelling sequences.",
            "",
            "  -- Bellweather Technical Institute",
            "     Notation Division, Field Manual Rev. 7",
          ],
        },
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Display helpers                                                      */
  /* ------------------------------------------------------------------ */

  /** Render the lesson index to the terminal buffer. */
  function drawIndex(): void {
    terminalState.clear();
    terminalState.writeBlank();
    terminalState.writeLine("=== BELLWEATHER NOTATION TUTORIAL ===", "white");
    terminalState.writeBlank();
    terminalState.writeLine("Available Lessons:");
    terminalState.writeBlank();

    for (let i = 0; i < LESSONS.length; i++) {
      terminalState.writeLine(`  ${i + 1}) ${LESSONS[i]!.title}`);
    }

    terminalState.writeBlank();
    terminalState.promptString = "Enter lesson number (or ESC to return): ";
  }

  /** Render the current page of the current lesson. */
  function drawPage(): void {
    const lesson = LESSONS[currentLesson]!;
    const page = lesson.pages[currentPage]!;

    terminalState.clear();
    terminalState.writeBlank();

    for (const line of page.lines) {
      if (line.startsWith("LESSON")) {
        terminalState.writeLine(line, "white");
      } else {
        terminalState.writeLine(line);
      }
    }

    terminalState.writeBlank();

    const isLastPage = currentPage >= lesson.pages.length - 1;
    if (isLastPage) {
      terminalState.writeLine("Press ENTER to return to lesson index, or ESC to return...", "gray");
    } else {
      terminalState.writeLine("Press ENTER for next page, or ESC to return...", "gray");
    }

    terminalState.promptString = "";
  }

  /* ------------------------------------------------------------------ */
  /* Input handler (called by DosTerminal)                               */
  /* ------------------------------------------------------------------ */

  /**
   * Process input from the terminal.
   * In index view: digit selects a lesson.
   * In lesson view: ENTER advances, any text is ignored (ENTER is the trigger).
   * ESC handling: empty input is used to detect ESC (DosTerminal sends empty on ESC).
   */
  function handleInput(input: string): void {
    if (view === "index") {
      handleIndexInput(input);
    } else {
      handleLessonInput();
    }
  }

  /**
   * Handle ESC key press.
   * In lesson view: return to index.
   * In index view: return to SCRIBE menu.
   * Registered on terminalState.escapeHandler during mount.
   */
  function handleEscape(): void {
    if (view === "lesson") {
      soundManager.menuSelect();
      view = "index";
      drawIndex();
    } else {
      soundManager.menuSelect();
      cleanup();
      onreturn();
    }
  }

  function handleIndexInput(input: string): void {
    const trimmed = input.trim();
    const num = parseInt(trimmed, 10);

    if (num >= 1 && num <= LESSONS.length) {
      soundManager.menuSelect();
      currentLesson = num - 1;
      currentPage = 0;
      view = "lesson";
      drawPage();
      return;
    }

    soundManager.error();
    terminalState.writeLine(`Invalid selection. Enter 1-${LESSONS.length}.`);
  }

  function handleLessonInput(): void {
    const lesson = LESSONS[currentLesson]!;
    const isLastPage = currentPage >= lesson.pages.length - 1;

    if (isLastPage) {
      soundManager.menuSelect();
      view = "index";
      drawIndex();
    } else {
      soundManager.keyclick();
      currentPage++;
      drawPage();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  function cleanup(): void {
    terminalState.inputHandler = null;
    terminalState.escapeHandler = null;
    terminalState.promptString = "C:\\BELLWTHR>";
  }

  onMount(() => {
    view = "index";
    currentLesson = 0;
    currentPage = 0;
    drawIndex();
    terminalState.inputHandler = handleInput;
    terminalState.escapeHandler = handleEscape;
  });

  onDestroy(() => {
    if (terminalState.inputHandler === handleInput) {
      terminalState.inputHandler = null;
    }
    if (terminalState.escapeHandler === handleEscape) {
      terminalState.escapeHandler = null;
    }
  });
</script>
