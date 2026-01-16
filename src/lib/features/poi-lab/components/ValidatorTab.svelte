<script lang="ts">
  /**
   * Validator Tab - Validate sequences for poi legality
   *
   * Accepts a sequence word input and validates each pictograph
   * and transition for poi physics constraints.
   */

  import { container } from "$lib/shared/di";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { PoiValidationResult } from "../domain/poi-models";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  // Services
  const sequenceValidator = container.items.poiSequenceValidator;
  const letterQueryHandler = container.items.letterQueryHandler;

  // State
  let sequenceInput = $state("");
  let isValidating = $state(false);
  let validationResult = $state<{
    isValid: boolean;
    stepResults: Array<{
      letter: string;
      stepIndex: number;
      isValid: boolean;
      violations: Array<{ message: string }>;
    }>;
    transitionViolations: Array<{ message: string }>;
  } | null>(null);
  let error = $state<string | null>(null);

  async function validateSequence() {
    if (!sequenceInput.trim()) {
      error = "Please enter a sequence to validate";
      validationResult = null;
      return;
    }

    isValidating = true;
    error = null;
    validationResult = null;

    try {
      // Parse input into letters
      const letters = sequenceInput
        .toUpperCase()
        .split("")
        .filter((c) => /[A-Z]/.test(c));

      if (letters.length === 0) {
        error = "No valid letters found in input";
        isValidating = false;
        return;
      }

      // Fetch pictographs for each letter
      const pictographs: PictographData[] = [];
      for (const letter of letters) {
        const variations = await letterQueryHandler.getPictographsByLetter(letter);
        if (variations.length > 0) {
          // Use first variation (could be enhanced to pick based on context)
          pictographs.push(variations[0]!);
        }
      }

      if (pictographs.length === 0) {
        error = "Could not find pictographs for the given letters";
        isValidating = false;
        return;
      }

      // Validate the sequence
      const result = sequenceValidator.validateSequence(pictographs);

      // Build detailed result
      const stepResults = pictographs.map((p, i) => {
        const beatValidation = sequenceValidator.validatePictograph(p);
        return {
          letter: p.letter || letters[i] || "?",
          stepIndex: i + 1,
          isValid: beatValidation.isValid,
          violations: beatValidation.violations,
        };
      });

      // Extract transition violations (those not tied to a specific beat)
      const transitionViolations = result.violations.filter(
        (v) => v.message.includes("transition") || v.message.includes("reversal")
      );

      validationResult = {
        isValid: result.isValid,
        stepResults,
        transitionViolations,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : "Validation failed";
    } finally {
      isValidating = false;
    }
  }

  function clearValidation() {
    sequenceInput = "";
    validationResult = null;
    error = null;
  }

  // Example sequences for quick testing
  const examples = [
    { label: "CAT", word: "CAT" },
    { label: "DOG", word: "DOG" },
    { label: "SPIN", word: "SPIN" },
    { label: "FLOW", word: "FLOW" },
  ];
</script>

<div class="validator-tab">
  <div class="input-section">
    <h3>Sequence Validator</h3>
    <p class="description">
      Enter a word to validate. Each letter will be checked for poi physics legality,
      including motion constraints and transitions.
    </p>

    <div class="input-row">
      <input
        type="text"
        bind:value={sequenceInput}
        placeholder="Enter a word (e.g., CAT, SPIN)"
        class="sequence-input"
        onkeydown={(e) => e.key === "Enter" && validateSequence()}
        aria-label="Sequence to validate"
      />
      <button
        class="validate-btn"
        onclick={validateSequence}
        disabled={isValidating || !sequenceInput.trim()}
      >
        {#if isValidating}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-check-double" aria-hidden="true"></i>
        {/if}
        Validate
      </button>
      {#if validationResult || error}
        <button class="clear-btn" onclick={clearValidation} aria-label="Clear validation">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    <div class="examples">
      <span class="examples-label">Try:</span>
      {#each examples as ex}
        <button
          class="example-chip"
          onclick={() => {
            sequenceInput = ex.word;
            validateSequence();
          }}
        >
          {ex.label}
        </button>
      {/each}
    </div>
  </div>

  {#if error}
    <div class="error-message" role="alert">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      {error}
    </div>
  {/if}

  {#if validationResult}
    <div class="results-section themed-scrollbar">
      <div class="overall-result" class:valid={validationResult.isValid} class:invalid={!validationResult.isValid}>
        <div class="result-icon">
          {#if validationResult.isValid}
            <i class="fas fa-check-circle" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-times-circle" aria-hidden="true"></i>
          {/if}
        </div>
        <div class="result-text">
          <span class="result-title">
            {validationResult.isValid ? "Valid Poi Sequence" : "Invalid Poi Sequence"}
          </span>
          <span class="result-subtitle">
            {validationResult.stepResults.length} steps analyzed
          </span>
        </div>
      </div>

      <!-- Beat-by-beat results -->
      <div class="beat-results">
        <h4>Beat Analysis</h4>
        <div class="steps-grid">
          {#each validationResult.stepResults as beat}
            <div class="beat-card" class:valid={beat.isValid} class:invalid={!beat.isValid}>
              <div class="beat-header">
                <span class="beat-number">Beat {beat.stepIndex}</span>
                <span class="beat-letter">{beat.letter}</span>
                <span class="beat-status">
                  {#if beat.isValid}
                    <i class="fas fa-check" aria-hidden="true"></i>
                  {:else}
                    <i class="fas fa-times" aria-hidden="true"></i>
                  {/if}
                </span>
              </div>
              {#if !beat.isValid && beat.violations.length > 0}
                <div class="beat-violations">
                  {#each beat.violations as v}
                    <span class="violation">{v.message}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Transition violations -->
      {#if validationResult.transitionViolations.length > 0}
        <div class="transition-results">
          <h4>Transition Issues</h4>
          <div class="transition-list">
            {#each validationResult.transitionViolations as v}
              <div class="transition-violation">
                <i class="fas fa-exchange-alt" aria-hidden="true"></i>
                {v.message}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else if !error && !isValidating}
    <div class="empty-state">
      <i class="fas fa-clipboard-check" aria-hidden="true"></i>
      <p>Enter a word and click Validate to check for poi legality</p>
    </div>
  {/if}
</div>

<style>
  .validator-tab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .input-section {
    flex-shrink: 0;
    padding-bottom: 1rem;
  }

  h3 {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .description {
    margin: 0 0 1rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .sequence-input {
    flex: 1;
    padding: 0.75rem 1rem;
    min-height: 48px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-family: monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .sequence-input::placeholder {
    color: var(--theme-text-secondary, #666);
    text-transform: none;
    letter-spacing: normal;
  }

  .sequence-input:focus {
    outline: none;
    border-color: var(--theme-accent, #22d3ee);
  }

  .validate-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    min-height: 48px;
    border: none;
    border-radius: 8px;
    background: #22d3ee;
    color: #000;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .validate-btn:hover:not(:disabled) {
    background: #06b6d4;
  }

  .validate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .validate-btn:focus-visible {
    outline: 2px solid #22d3ee;
    outline-offset: 2px;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  .clear-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .examples {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .examples-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #888);
  }

  .example-chip {
    padding: 0.375rem 0.75rem;
    min-height: 36px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  @media (pointer: coarse) {
    .example-chip {
      min-height: 44px;
      padding: 0.5rem 1rem;
    }
  }

  .example-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .example-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: var(--font-size-min, 14px);
    margin-bottom: 1rem;
  }

  .results-section {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .overall-result {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 12px;
  }

  .overall-result.valid {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .overall-result.invalid {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .result-icon {
    font-size: 2rem;
  }

  .overall-result.valid .result-icon {
    color: #22c55e;
  }

  .overall-result.invalid .result-icon {
    color: #ef4444;
  }

  .result-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .result-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .result-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #888);
  }

  .beat-results h4,
  .transition-results h4 {
    margin: 0 0 0.75rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .beat-card {
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .beat-card.valid {
    border-color: rgba(34, 197, 94, 0.3);
  }

  .beat-card.invalid {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .beat-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .beat-number {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #888);
  }

  .beat-letter {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    font-family: monospace;
    color: var(--theme-text, #fff);
  }

  .beat-status {
    margin-left: auto;
    font-size: 0.875rem;
  }

  .beat-card.valid .beat-status {
    color: #22c55e;
  }

  .beat-card.invalid .beat-status {
    color: #ef4444;
  }

  .beat-violations {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(239, 68, 68, 0.2);
  }

  .beat-violations .violation {
    font-size: 10px;
    color: #ef4444;
    line-height: 1.3;
  }

  .transition-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .transition-violation {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: var(--font-size-compact, 12px);
  }

  .transition-violation i {
    margin-top: 0.125rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    flex: 1;
    color: var(--theme-text-secondary, #888);
  }

  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.3;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .validate-btn,
    .clear-btn,
    .example-chip {
      transition: none;
    }

    .validate-btn i.fa-spin {
      animation: none;
    }
  }
</style>
