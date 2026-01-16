<!--
  TIKA Quick Reference Panel

  Shows at-a-glance TKA reference when no context is active.
  Clickable items populate the question input with starter questions.
-->
<script lang="ts">
  // Props
  let {
    onSuggestionClick,
  }: {
    onSuggestionClick: (question: string) => void;
  } = $props();

  // Letter type data
  const letterTypes = [
    { type: 1, name: "Dual-Shift", letters: "A-V", desc: "Both hands shift" },
    { type: 2, name: "Shift", letters: "W,X,Y,Z,Σ,Δ,Θ,Ω", desc: "One shifts, one static" },
    { type: 3, name: "Cross-Shift", letters: "W-,X-...", desc: "One shifts, one dashes" },
    { type: 4, name: "Dash", letters: "Φ,Ψ,Λ", desc: "One dashes, one static" },
    { type: 5, name: "Dual-Dash", letters: "Φ-,Ψ-,Λ-", desc: "Both hands dash" },
    { type: 6, name: "Static", letters: "α,β,γ", desc: "Both hands stationary" },
  ];

  // Position data
  const positions = [
    { name: "Alpha", symbol: "α", desc: "Opposite points" },
    { name: "Beta", symbol: "β", desc: "Same point" },
    { name: "Gamma", symbol: "γ", desc: "Right angle" },
  ];

  // Motion types
  const motions = [
    { name: "Static", desc: "No movement" },
    { name: "Shift", desc: "Adjacent point" },
    { name: "Dash", desc: "Opposite point" },
  ];

  // Starter questions
  const suggestions = [
    "What is letter A?",
    "Explain the difference between pro and anti",
    "What does alpha position mean?",
    "How do Type 1 and Type 2 letters differ?",
    "Show me letter Sigma",
    "What is a shift motion?",
  ];

  function handleTypeClick(type: number) {
    onSuggestionClick(`Tell me about Type ${type} letters`);
  }

  function handlePositionClick(name: string) {
    onSuggestionClick(`What is ${name.toLowerCase()} position?`);
  }

  function handleMotionClick(name: string) {
    onSuggestionClick(`Explain ${name.toLowerCase()} motion`);
  }
</script>

<div class="quick-reference">
  <header class="panel-header">
    <span class="header-title">
      <i class="fas fa-compass" aria-hidden="true"></i> Quick Reference
    </span>
  </header>

  <div class="panel-content themed-scrollbar">
    <!-- Core Philosophy -->
    <div class="philosophy-card">
      <p>
        <strong>Tip:</strong> You don't need to memorize anything!
        Pictographs are visual - just look at the arrows and positions.
      </p>
    </div>

    <!-- Letter Types -->
    <section class="section">
      <h4>Letter Types</h4>
      <div class="type-grid">
        {#each letterTypes as lt}
          <button
            class="type-card"
            onclick={() => handleTypeClick(lt.type)}
            title="Ask about Type {lt.type}"
          >
            <div class="type-header">
              <span class="type-number">{lt.type}</span>
              <span class="type-name">{lt.name}</span>
            </div>
            <div class="type-desc">{lt.desc}</div>
            <div class="type-letters">{lt.letters}</div>
          </button>
        {/each}
      </div>
    </section>

    <!-- Positions -->
    <section class="section">
      <h4>Positions</h4>
      <div class="position-grid">
        {#each positions as pos}
          <button
            class="position-card"
            onclick={() => handlePositionClick(pos.name)}
            title="Ask about {pos.name}"
          >
            <span class="position-symbol">{pos.symbol}</span>
            <span class="position-name">{pos.name}</span>
            <span class="position-desc">{pos.desc}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Motion Types -->
    <section class="section">
      <h4>Motion Types</h4>
      <div class="motion-grid">
        {#each motions as motion}
          <button
            class="motion-card"
            onclick={() => handleMotionClick(motion.name)}
            title="Ask about {motion.name}"
          >
            <span class="motion-name">{motion.name}</span>
            <span class="motion-desc">{motion.desc}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Starter Questions -->
    <section class="section">
      <h4>Try asking...</h4>
      <div class="suggestion-list">
        {#each suggestions as question}
          <button
            class="suggestion-btn"
            onclick={() => onSuggestionClick(question)}
          >
            <i class="fas fa-comment-dots" aria-hidden="true"></i>
            {question}
          </button>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .quick-reference {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Header */
  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
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

  /* Content */
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Philosophy Card */
  .philosophy-card {
    padding: 12px 14px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .philosophy-card p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
  }

  /* Sections */
  .section {
    margin-bottom: 20px;
  }

  .section h4 {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 10px 0;
  }

  /* Type Grid */
  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .type-card {
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .type-card:hover {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .type-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .type-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .type-number {
    width: 20px;
    height: 20px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .type-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .type-desc {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin-bottom: 4px;
  }

  .type-letters {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-family: monospace;
  }

  /* Position Grid */
  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .position-card {
    padding: 12px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .position-card:hover {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .position-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .position-symbol {
    font-size: 20px;
    color: var(--theme-accent, #6366f1);
  }

  .position-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .position-desc {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Motion Grid */
  .motion-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .motion-card {
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .motion-card:hover {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .motion-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .motion-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .motion-desc {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Suggestions */
  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .suggestion-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    color: var(--theme-text, #ffffff);
  }

  .suggestion-btn:hover {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .suggestion-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .suggestion-btn i {
    color: var(--theme-accent, #6366f1);
    font-size: 12px;
  }

  /* Mobile Adjustments */
  @media (max-width: 768px) {
    .type-grid {
      grid-template-columns: 1fr;
    }

    .position-grid,
    .motion-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .type-card,
    .position-card,
    .motion-card,
    .suggestion-btn {
      transition: none;
    }
  }
</style>
