<!--
  TIKA Context Panel

  Right-side panel showing relevant information based on the conversation.
  Displays pictographs, letter details, term definitions, etc.
-->
<script lang="ts">
  import type { ContextData } from "../types";

  // Props
  let {
    context,
    pictographBase64,
    onClose,
  }: {
    context: ContextData | null;
    pictographBase64: string | null;
    onClose: () => void;
  } = $props();
</script>

<div class="context-panel">
  <!-- Header -->
  <header class="panel-header">
    <span class="header-title">
      {#if context?.type === "letter"}
        <i class="fas fa-font" aria-hidden="true"></i> Letter Details
      {:else if context?.type === "term"}
        <i class="fas fa-book" aria-hidden="true"></i> Term Definition
      {:else if context?.type === "comparison"}
        <i class="fas fa-balance-scale" aria-hidden="true"></i> Comparison
      {:else if context?.type === "position"}
        <i class="fas fa-crosshairs" aria-hidden="true"></i> Position Info
      {:else if context?.type === "list"}
        <i class="fas fa-list" aria-hidden="true"></i> Letter Type
      {:else}
        <i class="fas fa-info-circle" aria-hidden="true"></i> Context
      {/if}
    </span>
    <button class="close-btn" onclick={onClose} title="Close panel" aria-label="Close context panel">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </header>

  <!-- Content -->
  <div class="panel-content themed-scrollbar">
    {#if context?.type === "letter" && context.letter}
      <!-- Letter Context -->
      <div class="letter-context">
        <!-- Pictograph Display -->
        {#if pictographBase64}
          <div class="pictograph-display">
            <img
              src="data:image/png;base64,{pictographBase64}"
              alt="Pictograph for letter {context.letter.letter}"
            />
          </div>
        {/if}

        <!-- Letter Info -->
        <div class="info-card">
          <div class="info-header">
            <span class="letter-display">{context.letter.letter}</span>
            <span class="type-badge">Type {context.letter.type}</span>
          </div>
          <div class="type-name">{context.letter.typeName}</div>
        </div>

        <!-- Position Info -->
        <div class="info-section">
          <h4>Position</h4>
          <div class="position-flow">
            <span class="position-tag">{context.letter.startPosition}</span>
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
            <span class="position-tag">{context.letter.endPosition}</span>
          </div>
        </div>

        <!-- Motion Details -->
        <div class="info-section">
          <h4>Motions</h4>
          <div class="motion-grid">
            <div class="motion-card blue">
              <div class="motion-label">
                <span class="color-dot blue"></span> Blue
              </div>
              <div class="motion-type">{context.letter.blueMotion.motionType}</div>
              <div class="motion-path">
                {context.letter.blueMotion.startLocation} →
                {context.letter.blueMotion.endLocation}
              </div>
              {#if context.letter.blueMotion.rotationDirection !== "noRotation"}
                <div class="motion-rotation">
                  {context.letter.blueMotion.rotationDirection}
                </div>
              {/if}
            </div>
            <div class="motion-card red">
              <div class="motion-label">
                <span class="color-dot red"></span> Red
              </div>
              <div class="motion-type">{context.letter.redMotion.motionType}</div>
              <div class="motion-path">
                {context.letter.redMotion.startLocation} →
                {context.letter.redMotion.endLocation}
              </div>
              {#if context.letter.redMotion.rotationDirection !== "noRotation"}
                <div class="motion-rotation">
                  {context.letter.redMotion.rotationDirection}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {:else if context?.type === "term" && context.term}
      <!-- Term Context -->
      <div class="term-context">
        <div class="info-card">
          <div class="term-display">{context.term.term}</div>
        </div>

        <div class="info-section">
          <h4>Definition</h4>
          <p class="definition-text">{context.term.definition}</p>
        </div>

        {#if context.term.examples.length > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <ul class="examples-list">
              {#each context.term.examples as example}
                <li>{example}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if context.term.relatedTerms.length > 0}
          <div class="info-section">
            <h4>Related Terms</h4>
            <div class="related-tags">
              {#each context.term.relatedTerms as term}
                <span class="related-tag">{term}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else if context?.type === "comparison" && context.comparison}
      <!-- Comparison Context -->
      <div class="comparison-context">
        <!-- Pictograph for first letter -->
        {#if pictographBase64}
          <div class="pictograph-display">
            <img
              src="data:image/png;base64,{pictographBase64}"
              alt="Pictograph for comparison"
            />
          </div>
        {/if}

        <div class="comparison-header">
          <div class="compare-item">
            <span class="letter-display">{context.comparison.letter1}</span>
            <span class="type-name">{context.comparison.type1}</span>
          </div>
          <span class="vs-badge">vs</span>
          <div class="compare-item">
            <span class="letter-display">{context.comparison.letter2}</span>
            <span class="type-name">{context.comparison.type2}</span>
          </div>
        </div>
      </div>
    {:else if context?.type === "position" && context.position}
      <!-- Position Context -->
      <div class="position-context">
        <div class="info-card">
          <div class="position-display">{context.position.name}</div>
          <div class="angle-display">{context.position.angleDegrees}</div>
        </div>

        <div class="info-section">
          <h4>Description</h4>
          <p class="definition-text">{context.position.description}</p>
        </div>
      </div>
    {:else if context?.type === "list"}
      <!-- List Context (minimal) -->
      <div class="list-context">
        <div class="info-card">
          <div class="list-info">Letter type information shown in chat</div>
        </div>
      </div>
    {:else}
      <!-- Empty State -->
      <div class="empty-state">
        <i class="fas fa-info-circle" aria-hidden="true"></i>
        <p>Context information will appear here</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .context-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Header */
  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .header-title i {
    color: var(--theme-accent, #6366f1);
  }

  .close-btn {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Content */
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Pictograph Display */
  .pictograph-display {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .pictograph-display img {
    max-width: 100%;
    max-height: 250px;
    border-radius: 8px;
  }

  /* Info Card */
  .info-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .letter-display {
    font-size: 32px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .type-badge {
    padding: 4px 10px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .type-name {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Info Sections */
  .info-section {
    margin-bottom: 16px;
  }

  .info-section h4 {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px 0;
  }

  /* Position Flow */
  .position-flow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .position-tag {
    padding: 6px 12px;
    background: rgba(99, 102, 241, 0.2);
    color: var(--theme-accent, #6366f1);
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
  }

  .position-flow i {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  /* Motion Grid */
  .motion-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .motion-card {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .motion-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin-bottom: 6px;
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .color-dot.blue {
    background: var(--prop-blue, #3b82f6);
  }

  .color-dot.red {
    background: var(--prop-red, #ef4444);
  }

  .motion-type {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin-bottom: 4px;
  }

  .motion-path {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .motion-rotation {
    font-size: 12px;
    color: var(--theme-accent, #6366f1);
    margin-top: 4px;
  }

  /* Term Context */
  .term-display {
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    text-transform: capitalize;
  }

  .definition-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .examples-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.8));
  }

  .examples-list li {
    margin-bottom: 6px;
  }

  .related-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .related-tag {
    padding: 4px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Comparison Context */
  .comparison-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
  }

  .compare-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .vs-badge {
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Position Context */
  .position-display {
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .angle-display {
    font-size: 16px;
    color: var(--theme-accent, #6366f1);
    margin-top: 4px;
  }

  /* List Context */
  .list-info {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .empty-state i {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  /* Mobile Adjustments */
  @media (max-width: 768px) {
    .motion-grid {
      grid-template-columns: 1fr;
    }

    .pictograph-display img {
      max-height: 180px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>
