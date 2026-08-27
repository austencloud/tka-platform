<!--
  RetroTutor - TUTOR.EXE HyperCard-style lessons app

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
  import { createMockPictographData } from "../../../../shared/data/mock-pictograph-data";
  import { RETRO_ICONS } from "../../rendering/retro-icons";
  import {
    loadConcepts,
    loadQuizQuestions,
    loadCodexLetters,
    type RetroConcept,
    type RetroQuizQuestion,
    type RetroCodexLetter,
  } from "../../../adapters/tutor-adapter";

  /* Props                                                               */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* Tab state                                                           */

  let activeTab = $state("concepts");

  const tabs = [
    { id: "concepts", label: "Concepts" },
    { id: "quiz", label: "Quiz" },
    { id: "codex", label: "Codex" },
  ];

  /* Concepts tab state                                                  */

  const CONCEPT_CARDS: RetroConcept[] = loadConcepts();

  // Map concept icon id to the RETRO_ICONS SVG strings
  function getConceptIconSvg(icon: string): string {
    return (RETRO_ICONS as Record<string, string>)[icon] ?? RETRO_ICONS.book;
  }

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

  /* Quiz tab state                                                      */

  let quizQuestions: RetroQuizQuestion[] = $state(loadQuizQuestions(5));
  // Use $derived to compute initial answers from quizQuestions (avoids state_referenced_locally)
  const initialAnswers = $derived(quizQuestions.map(() => null));
  let quizAnswers: (number | null)[] = $state([]);
  $effect.pre(() => { quizAnswers = [...initialAnswers]; });
  let quizChecked = $state(false);

  const quizScore = $derived(
    quizChecked
      ? quizQuestions.reduce(
          (acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0),
          0,
        )
      : 0,
  );

  function selectQuizAnswer(questionIndex: number, optionValue: string) {
    const optIndex = quizQuestions[questionIndex]!.options.indexOf(optionValue);
    quizAnswers[questionIndex] = optIndex;
    quizAnswers = [...quizAnswers];
  }

  function checkQuiz() {
    quizChecked = true;
  }

  function newQuiz() {
    quizQuestions = loadQuizQuestions(5);
    quizAnswers = quizQuestions.map(() => null);
    quizChecked = false;
  }

  /* Codex tab state                                                     */

  let codexLetters: RetroCodexLetter[] = $state([]);
  let codexLoading = $state(true);
  let codexError = $state(false);
  let codexSelectedIndex = $state(0);

  // Load codex letters asynchronously on mount
  loadCodexLetters().then((letters) => {
    codexLetters = letters;
    codexLoading = false;
    if (letters.length === 0) codexError = true;
  }).catch(() => {
    codexLoading = false;
    codexError = true;
  });

  const codexListItems = $derived(
    codexLetters.map((e) => `${e.letter}  (${e.type})`),
  );

  const selectedCodexEntry = $derived(
    codexLetters.length > 0 ? codexLetters[codexSelectedIndex] : null,
  );

  const selectedCodexPictograph = $derived(
    selectedCodexEntry
      ? createMockPictographData(selectedCodexEntry.letter)
      : null,
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
                text: `Score: ${quizScore}/${quizQuestions.length} \u2014 ${Math.round((quizScore / quizQuestions.length) * 100)}%`,
              },
            ]
          : [{ text: `Quiz: 0/${quizQuestions.length} answered` }];
      case "codex":
        return codexLoading
          ? [{ text: "Loading codex..." }]
          : [{ text: `Codex: ${codexLetters.length} letters` }];
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
        <!-- Concepts tab                                            -->
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
                <div class="concept-card-icon" aria-hidden="true">{@html getConceptIconSvg(currentCard.icon)}</div>
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

        <!-- Quiz tab                                                -->
        {:else if activeTab === "quiz"}
          <div class="quiz-tab">
            <div class="quiz-questions">
              {#each quizQuestions as q, qi (qi)}
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
                  {#if quizChecked}
                    <div class="quiz-explanation">{q.explanation}</div>
                  {/if}
                </fieldset>
              {/each}
            </div>

            <div class="quiz-controls">
              {#if quizChecked}
                <div class="quiz-score">
                  Score: {quizScore}/{quizQuestions.length} &mdash;
                  {Math.round((quizScore / quizQuestions.length) * 100)}%
                </div>
                <RetroButton label="New Quiz" onclick={newQuiz} />
              {:else}
                <RetroButton
                  label="Check Answers"
                  isDefault={true}
                  onclick={checkQuiz}
                />
              {/if}
            </div>
          </div>

        <!-- Codex tab                                               -->
        {:else if activeTab === "codex"}
          <div class="codex-tab">
            {#if codexLoading}
              <div class="codex-loading">Loading codex data...</div>
            {:else if codexError || codexLetters.length === 0}
              <div class="codex-loading">Could not load codex letters.</div>
            {:else}
              <!-- Master list -->
              <div class="codex-list">
                <RetroListBox
                  items={codexListItems}
                  bind:selectedIndex={codexSelectedIndex}
                  height={10}
                />
              </div>

              <!-- Detail panel -->
              <div class="codex-detail sunken-panel">
                {#if selectedCodexEntry}
                  <div class="codex-detail-header">
                    {#if selectedCodexPictograph}
                      <div class="codex-pictograph">
                        <RetroPictograph
                          data={selectedCodexPictograph}
                          size={64}
                        />
                      </div>
                    {/if}
                    <div class="codex-detail-meta">
                      <div class="codex-detail-name">{selectedCodexEntry.letter}</div>
                      <div class="codex-detail-type">{selectedCodexEntry.type}</div>
                    </div>
                  </div>
                  <div class="codex-detail-desc">
                    {selectedCodexEntry.description}
                  </div>
                {/if}
              </div>
            {/if}
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
  /* Shell layout                                                        */
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

  /* Concepts tab                                                        */
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

  /* Quiz tab                                                            */
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

  .quiz-explanation {
    margin-top: 4px;
    padding: 4px 6px;
    background: #ffffc0;
    border: 1px solid var(--retro-button-shadow, #808080);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    font-style: italic;
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

  /* Codex tab                                                           */
  .codex-loading {
    padding: 16px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-disabled-text, #808080);
    font-style: italic;
    text-align: center;
  }

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
