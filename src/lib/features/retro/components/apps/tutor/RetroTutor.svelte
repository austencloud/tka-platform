<!--
  RetroTutor — TUTOR.EXE HyperCard-style lessons app

  Three-tab educational app: Concepts (page-card metaphor with navigation),
  Quiz (multiple-choice with scoring), and Codex (master-detail reference).
  Fills its parent RetroWindow body area.

  Domain: Retro TUTOR App
-->
<script lang="ts">
  import RetroTabControl from "../../primitives/RetroTabControl.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroListBox from "../../primitives/RetroListBox.svelte";
  import RetroRadioButton from "../../primitives/RetroRadioButton.svelte";
  import RetroPictograph from "../../rendering/RetroPictograph.svelte";
  import { createMockPictographData } from "../../../shared/data/mock-pictograph-data";
  import { RETRO_ICONS } from "../../rendering/retro-icons";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* Tab state                                                           */
  /* ------------------------------------------------------------------ */

  let activeTab = $state("concepts");

  const tabs = [
    { id: "concepts", label: "Concepts" },
    { id: "quiz", label: "Quiz" },
    { id: "codex", label: "Codex" },
  ];

  /* ------------------------------------------------------------------ */
  /* Concepts tab state                                                  */
  /* ------------------------------------------------------------------ */

  const CONCEPT_CARDS = [
    {
      title: "What is TKA?",
      iconSvg: RETRO_ICONS.book,
      body: "The Kinetic Alphabet (TKA) is a notation system for recording and sharing movement patterns. Each letter captures the spatial relationship between two hands and the motions they trace. With 26 letters and 6 types, TKA encodes any dual-prop movement into readable, reproducible text.",
    },
    {
      title: "Letters & Types",
      iconSvg: RETRO_ICONS.letters,
      body: "Each letter represents a specific hand path. There are 6 Types, classified by motion family: Type 1 (both shift), Type 2 (shift + dash), Type 3 (shift + static), Type 4 (dash + static), Type 5 (both dash), and Type 6 (both static). The type tells you what kind of motions both hands perform.",
    },
    {
      title: "Grid Positions",
      iconSvg: RETRO_ICONS.mappin,
      body: "Hands move between 8 cardinal and intercardinal positions on a diamond grid: North, South, East, West, and the four diagonals. The grid provides a spatial coordinate system so every hand placement can be precisely notated and reproduced by another performer.",
    },
    {
      title: "Turns & Rotation",
      iconSvg: RETRO_ICONS.rotate,
      body: "Turns measure additional prop rotation. 1 turn = 180 degrees of rotation beyond the base path. A 0-turn motion follows the path with no extra spin. Half turns (0.5) and full turns (1.0) add increasing amounts of rotation, changing the visual texture of the movement.",
    },
    {
      title: "Building Sequences",
      iconSvg: RETRO_ICONS.musicnotes,
      body: "A sequence is a series of beats, each beat containing one letter per hand. Reading a sequence left-to-right reconstructs the full movement phrase. Sequences can be spelled from words, generated algorithmically, or built beat-by-beat in the constructor.",
    },
  ];

  let conceptPage = $state(0);
  let showIndex = $state(false);
  let indexSelectedItem = $state(-1);

  const currentCard = $derived(CONCEPT_CARDS[conceptPage]!);

  function conceptBack() {
    if (conceptPage > 0) conceptPage--;
    showIndex = false;
  }

  function conceptNext() {
    if (conceptPage < CONCEPT_CARDS.length - 1) conceptPage++;
    showIndex = false;
  }

  function conceptGoToIndex() {
    showIndex = !showIndex;
  }

  function conceptJumpTo(index: number) {
    conceptPage = index;
    showIndex = false;
  }

  /* ------------------------------------------------------------------ */
  /* Quiz tab state                                                      */
  /* ------------------------------------------------------------------ */

  interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
  }

  const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
      question: "How many degrees is 1 turn?",
      options: ["90", "180", "360", "45"],
      correctIndex: 1,
    },
    {
      question: "What grid has cardinal + intercardinal points?",
      options: ["Box", "Diamond", "Circular", "Hex"],
      correctIndex: 0,
    },
    {
      question: 'Type 1 means both hands do what?',
      options: ["Shift", "Dash", "Static", "Float"],
      correctIndex: 0,
    },
  ];

  let quizAnswers: (number | null)[] = $state(
    QUIZ_QUESTIONS.map(() => null),
  );
  let quizChecked = $state(false);

  const quizScore = $derived(
    quizChecked
      ? QUIZ_QUESTIONS.reduce(
          (acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0),
          0,
        )
      : 0,
  );

  function selectQuizAnswer(questionIndex: number, optionValue: string) {
    const optIndex = QUIZ_QUESTIONS[questionIndex]!.options.indexOf(optionValue);
    quizAnswers[questionIndex] = optIndex;
    quizAnswers = [...quizAnswers];
  }

  function checkQuiz() {
    quizChecked = true;
  }

  function resetQuiz() {
    quizAnswers = QUIZ_QUESTIONS.map(() => null);
    quizChecked = false;
  }

  /* ------------------------------------------------------------------ */
  /* Codex tab state                                                     */
  /* ------------------------------------------------------------------ */

  interface CodexEntry {
    name: string;
    letterKey: string;
    type: string;
    description: string;
  }

  const CODEX_ENTRIES: CodexEntry[] = [
    {
      name: "Alpha",
      letterKey: "A",
      type: "Type 1 (Shift + Shift)",
      description:
        "Both hands shift in the same direction. The fundamental motion pattern. Hands start at opposite grid points and travel together through parallel paths.",
    },
    {
      name: "Beta",
      letterKey: "B",
      type: "Type 1 (Shift + Shift)",
      description:
        "Both hands shift, ending at the same grid point. A convergence pattern where two parallel paths collapse into a single position.",
    },
    {
      name: "Gamma",
      letterKey: "G",
      type: "Type 1 (Shift + Shift)",
      description:
        "Both hands shift with a right-angle relationship. The hands trace paths that create perpendicular geometries in the movement space.",
    },
    {
      name: "Delta",
      letterKey: "D",
      type: "Type 2 (Shift + Dash)",
      description:
        "One hand shifts while the other dashes. Creates an asymmetric texture where linear and diagonal movements combine.",
    },
    {
      name: "Epsilon",
      letterKey: "E",
      type: "Type 2 (Shift + Dash)",
      description:
        "A shift-dash pairing with distinct directional contrast. The dashing hand crosses the grid while the shifting hand traces an arc.",
    },
    {
      name: "Zeta",
      letterKey: "Z",
      type: "Type 3 (Shift + Static)",
      description:
        "One hand shifts while the other holds position. The static hand becomes an anchor point as the moving hand traces its path around it.",
    },
    {
      name: "Eta",
      letterKey: "H",
      type: "Type 4 (Dash + Static)",
      description:
        "One hand dashes while the other remains static. A punctuated movement where the dash creates a sharp linear motion against a fixed reference.",
    },
    {
      name: "Theta",
      letterKey: "T",
      type: "Type 5 (Dash + Dash)",
      description:
        "Both hands dash simultaneously. Creates bold criss-crossing linear paths as both props cut through the grid space.",
    },
  ];

  let codexSelectedIndex = $state(0);

  const codexItems = CODEX_ENTRIES.map((e) => e.name);

  const selectedCodexEntry = $derived(CODEX_ENTRIES[codexSelectedIndex]!);
  const selectedCodexPictograph = $derived(
    createMockPictographData(selectedCodexEntry.letterKey),
  );

  /* ------------------------------------------------------------------ */
  /* Status bar                                                          */
  /* ------------------------------------------------------------------ */

  const statusPanels = $derived(() => {
    switch (activeTab) {
      case "concepts":
        return [
          { text: `Page ${conceptPage + 1} of ${CONCEPT_CARDS.length}` },
        ];
      case "quiz":
        return quizChecked
          ? [
              {
                text: `Score: ${quizScore}/${QUIZ_QUESTIONS.length} \u2014 ${Math.round((quizScore / QUIZ_QUESTIONS.length) * 100)}%`,
              },
            ]
          : [{ text: `Quiz: 0/${QUIZ_QUESTIONS.length}` }];
      case "codex":
        return [{ text: `Codex: ${CODEX_ENTRIES.length} entries` }];
      default:
        return [{ text: "Ready" }];
    }
  });
</script>

<div class="tutor-shell">
  <!-- Tab control + content area -->
  <div class="tutor-content">
    <RetroTabControl {tabs} bind:activeTab>
      {#snippet children()}
        <!-- ====================================================== -->
        <!-- Concepts tab                                            -->
        <!-- ====================================================== -->
        {#if activeTab === "concepts"}
          <div class="concepts-tab">
            {#if showIndex}
              <!-- Index view -->
              <div class="concepts-index">
                <div class="concepts-index-label">Jump to page:</div>
                <RetroListBox
                  items={CONCEPT_CARDS.map((c, i) => `${i + 1}. ${c.title}`)}
                  bind:selectedIndex={indexSelectedItem}
                  height={5}
                  ondblclick={(i) => conceptJumpTo(i)}
                />
                <div class="concepts-index-hint">
                  Double-click to navigate
                </div>
              </div>
            {:else}
              <!-- Card view -->
              <div class="concept-card sunken-panel">
                <div class="concept-card-icon" aria-hidden="true">{@html currentCard.iconSvg}</div>
                <div class="concept-card-title">{currentCard.title}</div>
                <div class="concept-card-body">{currentCard.body}</div>
              </div>
            {/if}

            <!-- Navigation buttons -->
            <div class="concepts-nav">
              <RetroButton
                label="\u25C4 Back"
                disabled={conceptPage === 0}
                onclick={conceptBack}
              />
              <RetroButton
                label="Index"
                onclick={conceptGoToIndex}
              />
              <RetroButton
                label="Next \u25BA"
                disabled={conceptPage === CONCEPT_CARDS.length - 1}
                onclick={conceptNext}
              />
            </div>
          </div>

        <!-- ====================================================== -->
        <!-- Quiz tab                                                -->
        <!-- ====================================================== -->
        {:else if activeTab === "quiz"}
          <div class="quiz-tab">
            <div class="quiz-questions">
              {#each QUIZ_QUESTIONS as q, qi (qi)}
                <fieldset class="quiz-question-group">
                  <legend class="quiz-question-text">
                    {qi + 1}. {q.question}
                  </legend>
                  <div class="quiz-options">
                    {#each q.options as opt, oi (oi)}
                      {@const isSelected = quizAnswers[qi] === oi}
                      {@const isCorrect = q.correctIndex === oi}
                      <div
                        class="quiz-option"
                        class:quiz-correct={quizChecked && isSelected && isCorrect}
                        class:quiz-wrong={quizChecked && isSelected && !isCorrect}
                        class:quiz-reveal={quizChecked && !isSelected && isCorrect}
                      >
                        <RetroRadioButton
                          name={`quiz-q${qi}`}
                          value={opt}
                          label={opt}
                          selected={isSelected}
                          disabled={quizChecked}
                          onchange={(val) => selectQuizAnswer(qi, val)}
                        />
                      </div>
                    {/each}
                  </div>
                </fieldset>
              {/each}
            </div>

            <div class="quiz-controls">
              {#if quizChecked}
                <div class="quiz-score">
                  Score: {quizScore}/{QUIZ_QUESTIONS.length} &mdash;
                  {Math.round((quizScore / QUIZ_QUESTIONS.length) * 100)}%
                </div>
                <RetroButton label="Reset Quiz" onclick={resetQuiz} />
              {:else}
                <RetroButton
                  label="Check Answer"
                  isDefault={true}
                  onclick={checkQuiz}
                />
              {/if}
            </div>
          </div>

        <!-- ====================================================== -->
        <!-- Codex tab                                               -->
        <!-- ====================================================== -->
        {:else if activeTab === "codex"}
          <div class="codex-tab">
            <!-- Master list -->
            <div class="codex-list">
              <RetroListBox
                items={codexItems}
                bind:selectedIndex={codexSelectedIndex}
                height={10}
              />
            </div>

            <!-- Detail panel -->
            <div class="codex-detail sunken-panel">
              <div class="codex-detail-header">
                <div class="codex-pictograph">
                  <RetroPictograph
                    data={selectedCodexPictograph}
                    size={64}
                  />
                </div>
                <div class="codex-detail-meta">
                  <div class="codex-detail-name">{selectedCodexEntry.name}</div>
                  <div class="codex-detail-type">{selectedCodexEntry.type}</div>
                </div>
              </div>
              <div class="codex-detail-desc">
                {selectedCodexEntry.description}
              </div>
            </div>
          </div>
        {/if}
      {/snippet}
    </RetroTabControl>
  </div>

  <!-- Status bar -->
  <div class="tutor-statusbar">
    <RetroStatusBar panels={statusPanels()} />
  </div>
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Shell layout                                                        */
  /* ------------------------------------------------------------------ */
  .tutor-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  .tutor-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 4px 4px 0;
    overflow: hidden;
  }

  .tutor-content :global(.retro-tab-control) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tutor-content :global(.retro-tab-body) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .tutor-statusbar {
    flex-shrink: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Concepts tab                                                        */
  /* ------------------------------------------------------------------ */
  .concepts-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 8px;
  }

  .concept-card {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--retro-field-bg, #fff);
  }

  .concept-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin: 0 auto;
    image-rendering: pixelated;
  }

  .concept-card-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .concept-card-title {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    color: var(--retro-navy, #000080);
  }

  .concept-card-body {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    line-height: 1.5;
    color: var(--retro-black, #000);
  }

  .concepts-nav {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 4px 0;
  }

  .concepts-index {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
  }

  .concepts-index-label {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    font-weight: bold;
    color: var(--retro-black, #000);
  }

  .concepts-index-hint {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-disabled-text, #808080);
    font-style: italic;
  }

  /* ------------------------------------------------------------------ */
  /* Quiz tab                                                            */
  /* ------------------------------------------------------------------ */
  .quiz-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 8px;
  }

  .quiz-questions {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .quiz-question-group {
    border: 1px solid var(--retro-button-shadow, #808080);
    padding: 6px 8px;
    margin: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  .quiz-question-text {
    font-weight: bold;
    color: var(--retro-black, #000);
    padding: 0 4px;
  }

  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  .quiz-option {
    padding: 2px 4px;
  }

  .quiz-correct {
    background: #00a000;
    color: #fff;
  }

  .quiz-wrong {
    background: #c00000;
    color: #fff;
  }

  .quiz-reveal {
    background: #c0ffc0;
  }

  .quiz-controls {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 4px 0;
  }

  .quiz-score {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    font-weight: bold;
    color: var(--retro-navy, #000080);
  }

  /* ------------------------------------------------------------------ */
  /* Codex tab                                                           */
  /* ------------------------------------------------------------------ */
  .codex-tab {
    display: flex;
    height: 100%;
    gap: 8px;
  }

  .codex-list {
    flex: 0 0 30%;
    min-width: 0;
  }

  .codex-detail {
    flex: 1;
    min-width: 0;
    padding: 8px;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .codex-detail-header {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .codex-pictograph {
    flex-shrink: 0;
  }

  .codex-detail-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .codex-detail-name {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 14px;
    font-weight: bold;
    color: var(--retro-navy, #000080);
  }

  .codex-detail-type {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-disabled-text, #808080);
  }

  .codex-detail-desc {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    line-height: 1.5;
    color: var(--retro-black, #000);
  }
</style>
