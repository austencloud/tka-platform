<!--
  ScribeTutorial - Text-based educational content for SCRIBE.

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
  import { DosSoundManager } from "../../services/dos-sound-manager";

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
            "TKA encodes hand positions and movements into letters. Each",
            "pictograph represents one beat of motion, showing two props",
            "(blue and red) at specific grid locations with motion arrows",
            "indicating how each hand moves.",
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
            "A sequence IS choreography, written in notation. Words",
            "become movement phrases. Each letter is one beat.",
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
            "The system defines 47 letters organized into 6 types.",
            "Type 1 uses Latin A-V. Type 2 uses W-Z plus four",
            "Greek letters (Sigma, Delta, Theta, Omega). Types 3-5",
            "add dash-suffix variants. Type 6: alpha, beta, gamma.",
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
            "Every letter is classified by the HAND PATH of each hand.",
            "There are three fundamental hand paths:",
            "",
            "  SHIFT  - Hand arcs along the grid perimeter to an",
            "           adjacent point. A curved path.",
            "  DASH   - Hand moves in a straight line to the",
            "           diametrically opposite point (180 degrees).",
            "  STATIC - Hand remains at its current grid point.",
            "",
            "The six types arise from pairing these three paths",
            "across two hands. Types are numbered, not lettered.",
          ],
        },
        {
          lines: [
            "LESSON 2: LETTERS & TYPES",
            "Page 2 of 3",
            "",
            "TYPE CLASSIFICATION TABLE:",
            "",
            "  Type 1 - DUAL-SHIFT: Both hands shift.",
            "    22 letters: A B C D E F G H I J K L M N O P Q R S T U V",
            "",
            "  Type 2 - SHIFT: One shifts, one static.",
            "    8 letters: W X Y Z Sigma Delta Theta Omega",
            "",
            "  Type 3 - CROSS-SHIFT: One shifts, one dashes.",
            "    8 letters: W- X- Y- Z- Sigma- Delta- Theta- Omega-",
            '    The "-" suffix marks Type 3. "Sigma dash" = Sigma-.',
            "",
            "  Type 4 - DASH: One dashes, one static.",
            "    3 letters: Phi Psi Lambda",
            "",
            "  Type 5 - DUAL-DASH: Both hands dash.",
            "    3 letters: Phi- Psi- Lambda-",
            "",
            "  Type 6 - STATIC: Both hands stationary.",
            "    3 letters: alpha beta gamma (lowercase Greek)",
          ],
        },
        {
          lines: [
            "LESSON 2: LETTERS & TYPES",
            "Page 3 of 3",
            "",
            "Key principles:",
            "",
            "  - The TYPE tells you WHAT PATHS both hands take.",
            "    It does not specify positions or rotation.",
            "",
            "  - Types are defined by WHICH PATHS, not how many",
            "    hands move. Type 1 = both shift. Type 3 = one",
            "    shifts + one dashes. Type 5 = both dash.",
            "",
            "  - Letters within a type share the same path family",
            "    but differ in geometric relationship (same direction,",
            "    opposite direction, perpendicular, etc.)",
            "",
            "  - Total: 47 letters across 6 types.",
            "    Types 3 and 5 use the dash-suffix naming convention.",
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
            "Hands occupy locations on a grid. The grid has",
            "8 perimeter locations and 1 center location:",
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
            "Hand positions describe where both hands sit relative",
            "to each other. Named with Greek letters:",
            "",
            "  ALPHA  - Hands at opposite locations (180 degrees)",
            "  BETA   - Hands at the same location (0 degrees)",
            "  GAMMA  - Hands at adjacent locations (90 degrees)",
            "",
            "Terminology for grid locations:",
            "",
            "  CARDINAL locations: N, S, E, W",
            "  INTERCARDINAL locations: NE, NW, SE, SW",
            "  CENTER location: the origin [o]",
            "",
            "  A LOCATION is one grid point. A POSITION is the",
            "  combination of two locations (alpha, beta, gamma).",
            "  Do not confuse locations with prop ORIENTATIONS",
            "  (in, out, clock, counter), which describe facing.",
          ],
        },
        {
          lines: [
            "LESSON 3: GRID POSITIONS",
            "Page 3 of 3",
            "",
            "Grid modes:",
            "",
            "  DIAMOND mode - The default. Cardinal locations (N, S,",
            "  E, W) sit at the top, bottom, left, and right.",
            "",
            "  BOX mode - Rotated 45 degrees. Intercardinal locations",
            "  (NE, NW, SE, SW) sit at the corners instead.",
            "",
            "  SKEWED mode - One hand on a cardinal point, the other",
            "  on an intercardinal. Mixes both grids.",
            "",
            "Some letters work identically in diamond and box",
            "mode. Others change behavior when the grid rotates.",
            "Which letters are invariant depends on the geometric",
            "relationship between the two hands' directions.",
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
            "Props rotate during motion. Three rotation types:",
            "",
            "  PRO (prospin)  - Prop rotates WITH the hand's arc.",
            "  ANTI (antispin) - Prop rotates AGAINST the hand's arc.",
            "  FLOAT          - Prop does not rotate at all. Holds its",
            "                   absolute spatial angle during a shift.",
            "",
            "Turns measure ADDITIONAL rotation beyond the base",
            "behavior. 1 turn = 180 degrees additional rotation.",
            "",
            "  0   turns  -  Base rotation only from the hand path.",
            "                Pro still rotates 90 deg during a shift.",
            "  0.5 turns  -  90 degrees additional (Level 3).",
            "  1   turn   -  180 degrees additional.",
            "  1.5 turns  -  270 degrees additional (Level 3).",
            "  2   turns  -  360 degrees additional (full revolution).",
            "  3   turns  -  540 degrees additional.",
          ],
        },
        {
          lines: [
            "LESSON 4: TURNS & ROTATION",
            "Page 2 of 3",
            "",
            "Prop orientations (how the prop faces):",
            "",
            "  Four cardinal orientations:",
            "    IN      - Prop points toward center",
            "    OUT     - Prop points away from center",
            "    CLOCK   - Prop points clockwise along perimeter",
            "    COUNTER - Prop points counter-clockwise",
            "",
            "Pro at 0 turns preserves center-relative orientation",
            "(in stays in). This is called an ISOLATION.",
            "",
            "Anti at 0 turns reverses orientation (in becomes out).",
            "",
            "Each hand specifies rotation type, turn count, and",
            "direction (CW or CCW) independently.",
          ],
        },
        {
          lines: [
            "LESSON 4: TURNS & ROTATION",
            "Page 3 of 3",
            "",
            "Float in detail:",
            "",
            "  Float is pure translation. The hand arcs along the",
            "  grid perimeter, but the prop holds its absolute",
            "  spatial angle. Distinct from 0-turn pro (isolation),",
            "  which preserves center-relative angle instead.",
            "",
            "  ZERO-TURN DASH - A directionless state. The hand",
            "  moves in a straight line with no rotation. One",
            "  possible outcome regardless of CW/CCW.",
            "",
            "Level system progression:",
            "  Level 1: 0 turns only",
            "  Level 2: whole turns (0, 1, 2, 3)",
            "  Level 3: half turns + float (0, 0.5, 1, 1.5, 2, 2.5, 3)",
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
            "Example: generating the word BOOK produces 7 beats:",
            "",
            "  Beat 0: alpha - Start position (Type 6, static)",
            "  Beat 1: B     - Type 1 (both hands shift)",
            "  Beat 2: Sigma - Bridge (Type 2, connects B to O)",
            "  Beat 3: O     - Type 1 (both hands shift)",
            "  Beat 4: O     - Type 1 (both hands shift)",
            "  Beat 5: W     - Bridge (Type 2, connects O to K)",
            "  Beat 6: K     - Type 1 (both hands shift)",
            "",
            "  4-letter word, 7 beats. Bridge letters fill gaps",
            "  where hand positions don't connect directly.",
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
            "  In these cases, a BRIDGE letter is inserted. Bridges",
            "  use the same 47 letters. They are transition beats",
            "  that move the hands into a valid starting position",
            "  for the next letter in the word.",
            "",
            "  The constrained sequence builder handles bridges",
            "  automatically using beam search with backtracking.",
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
