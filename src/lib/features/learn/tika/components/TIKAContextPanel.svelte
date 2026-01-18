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
    pictographGallery = new Map(),
    onClose,
  }: {
    context: ContextData | null;
    pictographBase64: string | null;
    pictographGallery?: Map<string, string>;
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
      {:else if context?.type === "termWithVisuals"}
        <i class="fas fa-book" aria-hidden="true"></i> Term Examples
      {:else if context?.type === "comparison"}
        <i class="fas fa-balance-scale" aria-hidden="true"></i> Comparison
      {:else if context?.type === "positionExamples"}
        <i class="fas fa-crosshairs" aria-hidden="true"></i> Position Examples
      {:else if context?.type === "motionExamples"}
        <i class="fas fa-arrows-alt" aria-hidden="true"></i> Motion Examples
      {:else if context?.type === "list" || context?.type === "typeList"}
        <i class="fas fa-layer-group" aria-hidden="true"></i> Letter Type
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
        <!-- Side-by-side pictographs -->
        {#if pictographGallery.size > 0}
          {@const base641 = pictographGallery.get(context.comparison.letter1)}
          {@const base642 = pictographGallery.get(context.comparison.letter2)}

          <div class="comparison-gallery">
            {#if base641 && base642}
              <div class="comparison-row">
                <div class="comparison-item">
                  <img
                    src="data:image/png;base64,{base641}"
                    alt="Pictograph for {context.comparison.letter1}"
                  />
                  <div class="comparison-info">
                    <span class="letter-display">{context.comparison.letter1}</span>
                    <span class="type-badge">Type {context.comparison.letter1Data.type}</span>
                    <span class="type-name">{context.comparison.letter1Data.typeName}</span>
                  </div>
                </div>

                <span class="vs-badge">vs</span>

                <div class="comparison-item">
                  <img
                    src="data:image/png;base64,{base642}"
                    alt="Pictograph for {context.comparison.letter2}"
                  />
                  <div class="comparison-info">
                    <span class="letter-display">{context.comparison.letter2}</span>
                    <span class="type-badge">Type {context.comparison.letter2Data.type}</span>
                    <span class="type-name">{context.comparison.letter2Data.typeName}</span>
                  </div>
                </div>
              </div>

              <!-- Motion comparison -->
              <div class="info-section">
                <h4>Motion Comparison</h4>
                <div class="motion-comparison-grid">
                  <div class="motion-compare-item">
                    <div class="motion-compare-header">{context.comparison.letter1}</div>
                    <div class="motion-detail">
                      <span class="color-dot blue"></span>
                      Blue: {context.comparison.letter1Data.blueMotion}
                    </div>
                    <div class="motion-detail">
                      <span class="color-dot red"></span>
                      Red: {context.comparison.letter1Data.redMotion}
                    </div>
                  </div>

                  <div class="motion-compare-item">
                    <div class="motion-compare-header">{context.comparison.letter2}</div>
                    <div class="motion-detail">
                      <span class="color-dot blue"></span>
                      Blue: {context.comparison.letter2Data.blueMotion}
                    </div>
                    <div class="motion-detail">
                      <span class="color-dot red"></span>
                      Red: {context.comparison.letter2Data.redMotion}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
        {#if pictographGallery.size === 0}
          <div class="gallery-loading">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Loading pictographs...</span>
          </div>
        {/if}
      </div>
    {:else if context?.type === "typeList" && context.typeList}
      <!-- Type List Context with Gallery -->
      <div class="type-list-context">
        <!-- Type Header Card -->
        <div class="info-card">
          <div class="info-header">
            <span class="type-number">Type {context.typeList.typeNumber}</span>
            <span class="type-badge">{context.typeList.typeName}</span>
          </div>
          <p class="type-description">{context.typeList.description}</p>
        </div>

        <!-- Motion Pattern -->
        <div class="info-section">
          <h4>Motion Pattern</h4>
          <div class="motion-pattern">
            {#if context.typeList.motionPattern.blueMotion === context.typeList.motionPattern.redMotion}
              <!-- Both hands do the same motion -->
              <div class="pattern-unified">
                Both hands {context.typeList.motionPattern.blueMotion}
              </div>
            {:else}
              <!-- Hands do different motions -->
              <div class="pattern-item">
                <span class="color-dot blue"></span>
                <span>{context.typeList.motionPattern.blueMotion}</span>
              </div>
              <div class="pattern-item">
                <span class="color-dot red"></span>
                <span>{context.typeList.motionPattern.redMotion}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Rotation Pattern (Type 1 specific) -->
        {#if context.typeList.rotationPattern}
          <div class="info-section">
            <h4>Organization Pattern</h4>
            <p class="pattern-description">{context.typeList.rotationPattern.description}</p>

            <div class="rotation-groups">
              {#each context.typeList.rotationPattern.groups as group}
                <div class="rotation-group">
                  <span class="group-letters">{group.letters}</span>
                  <span class="group-pattern">{group.pattern}</span>
                </div>
              {/each}
            </div>

            {#if context.typeList.rotationPattern.note}
              <p class="pattern-note">
                <i class="fas fa-info-circle" aria-hidden="true"></i>
                {context.typeList.rotationPattern.note}
              </p>
            {/if}
          </div>
        {/if}

        <!-- Pictograph Gallery -->
        {#if pictographGallery.size > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="pictograph-gallery">
              {#each context.typeList.exampleLetters as letter}
                {@const base64 = pictographGallery.get(letter)}
                {#if base64}
                  <div class="gallery-item">
                    <img
                      src="data:image/png;base64,{base64}"
                      alt="Pictograph for letter {letter}"
                    />
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {:else if context.typeList.exampleLetters.length > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="gallery-loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <span>Loading pictographs...</span>
            </div>
          </div>
        {/if}

      </div>
    {:else if context?.type === "positionExamples" && context.positionExamples}
      <!-- Position Examples Context -->
      <div class="position-examples-context">
        <!-- Position Header -->
        <div class="info-card">
          <div class="position-display">{context.positionExamples.position}</div>
          <p class="definition-text">{context.positionExamples.definition}</p>
        </div>

        <!-- Pictograph Gallery -->
        {#if pictographGallery.size > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="pictograph-gallery">
              {#each context.positionExamples.examples as example}
                {@const base64 = pictographGallery.get(example.letter)}
                {#if base64}
                  <div class="gallery-item">
                    <img
                      src="data:image/png;base64,{base64}"
                      alt="Pictograph for {example.letter}"
                    />
                    <div class="gallery-info">
                      <span class="gallery-letter">{example.letter}</span>
                      <span class="gallery-positions">
                        {example.startPosition} → {example.endPosition}
                      </span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {:else if context.positionExamples.examples.length > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="gallery-loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <span>Loading pictographs...</span>
            </div>
          </div>
        {/if}
      </div>
    {:else if context?.type === "motionExamples" && context.motionExamples}
      <!-- Motion Examples Context -->
      <div class="motion-examples-context">
        <!-- Motion Header -->
        <div class="info-card">
          <div class="motion-display">{context.motionExamples.motionType}</div>
          <p class="definition-text">{context.motionExamples.definition}</p>
        </div>

        <!-- Pictograph Gallery -->
        {#if pictographGallery.size > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="pictograph-gallery">
              {#each context.motionExamples.examples as example}
                {@const base64 = pictographGallery.get(example.letter)}
                {#if base64}
                  <div class="gallery-item">
                    <img
                      src="data:image/png;base64,{base64}"
                      alt="Pictograph for {example.letter}"
                    />
                    <div class="gallery-info">
                      <span class="gallery-letter">{example.letter}</span>
                      <span class="gallery-motions">
                        Blue: {example.blueMotion} | Red: {example.redMotion}
                      </span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {:else if context.motionExamples.examples.length > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="gallery-loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <span>Loading pictographs...</span>
            </div>
          </div>
        {/if}
      </div>
    {:else if context?.type === "termWithVisuals" && context.termWithVisuals}
      <!-- Term With Visuals Context -->
      <div class="term-visuals-context">
        <!-- Term Header -->
        <div class="info-card">
          <div class="term-display">{context.termWithVisuals.term}</div>
          <p class="definition-text">{context.termWithVisuals.definition}</p>
        </div>

        <!-- Pictograph Gallery -->
        {#if pictographGallery.size > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="pictograph-gallery">
              {#each context.termWithVisuals.examples as example}
                {@const base64 = pictographGallery.get(example.letter)}
                {#if base64}
                  <div class="gallery-item">
                    <img
                      src="data:image/png;base64,{base64}"
                      alt="Pictograph for {example.letter}"
                    />
                    <span class="gallery-letter">{example.letter}</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {:else if context.termWithVisuals.examples.length > 0}
          <div class="info-section">
            <h4>Examples</h4>
            <div class="gallery-loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <span>Loading pictographs...</span>
            </div>
          </div>
        {/if}
      </div>
    {:else if context?.type === "list"}
      <!-- Legacy list context fallback -->
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

  .motion-display {
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
  .comparison-gallery {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comparison-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
  }

  .comparison-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    flex: 1;
    max-width: 200px;
  }

  .comparison-item img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    padding: 8px;
  }

  .comparison-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  .vs-badge {
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
  }

  .motion-comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .motion-compare-item {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .motion-compare-header {
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .motion-detail {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-text, #ffffff);
  }

  /* Position Display (used in position examples) */
  .position-display {
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    text-transform: capitalize;
  }

  /* List Context (legacy) */
  .list-info {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  /* Type List Context */
  .type-number {
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .type-description {
    font-size: 14px;
    line-height: 1.5;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.8));
    margin: 8px 0 0 0;
  }

  /* Motion Pattern - horizontal layout */
  .motion-pattern {
    display: flex;
    flex-direction: row;
    gap: 16px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .pattern-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-text, #ffffff);
  }

  .pattern-unified {
    font-size: 13px;
    color: var(--theme-text, #ffffff);
    text-align: center;
    width: 100%;
  }

  /* Rotation Pattern (Type 1) */
  .pattern-description {
    font-size: 13px;
    line-height: 1.5;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.8));
    margin: 0 0 12px 0;
  }

  .rotation-groups {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rotation-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .group-letters {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-family: monospace;
    letter-spacing: 0.05em;
  }

  .group-pattern {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .pattern-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
  }

  .pattern-note i {
    color: var(--theme-accent, #6366f1);
    margin-top: 2px;
    flex-shrink: 0;
  }

  /* Pictograph Gallery - optimized for 22 items */
  .pictograph-gallery {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }

  .gallery-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    transition: border-color var(--duration-fast) ease;
  }

  .gallery-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .gallery-item img {
    width: 100%;
    max-width: 80px;
    height: auto;
    border-radius: 4px;
  }

  .gallery-letter {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .gallery-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  .gallery-positions,
  .gallery-motions {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  .gallery-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 13px;
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

  /* Tablet Adjustments */
  @media (max-width: 1024px) {
    .pictograph-gallery {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* Mobile Adjustments */
  @media (max-width: 768px) {
    .motion-grid {
      grid-template-columns: 1fr;
    }

    .pictograph-display img {
      max-height: 180px;
    }

    .pictograph-gallery {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>
