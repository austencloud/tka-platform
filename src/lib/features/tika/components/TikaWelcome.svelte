<!--
  TIKA Welcome State

  Initial welcome screen with suggested questions.
-->
<script lang="ts">
  let {
    onSubmit,
    isLoading = false,
  }: {
    onSubmit: (question: string) => void;
    isLoading?: boolean;
  } = $props();

  const suggestions = [
    { icon: "fa-crosshairs", text: "What is alpha?", question: "What does alpha mean?" },
    { icon: "fa-crosshairs", text: "What is beta?", question: "What does beta mean?" },
    { icon: "fa-crosshairs", text: "What is gamma?", question: "What does gamma mean?" },
    { icon: "fa-font", text: "What is letter A?", question: "What is letter A?" },
    { icon: "fa-arrows-alt", text: "What is shift?", question: "What is shift?" },
    { icon: "fa-layer-group", text: "Type 1 letters", question: "What are Type 1 letters?" },
  ];
</script>

<div class="welcome-state">
  <div class="welcome-icon">
    <i class="fas fa-graduation-cap" aria-hidden="true"></i>
  </div>
  <h2>Welcome to Tika</h2>
  <p>
    I'm your AI tutor for The Kinetic Alphabet. Ask me anything about:
  </p>
  <ul class="suggestion-list">
    {#each suggestions as suggestion}
      <li>
        <button onclick={() => onSubmit(suggestion.question)} disabled={isLoading}>
          <i class="fas {suggestion.icon}" aria-hidden="true"></i> {suggestion.text}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .welcome-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 16px;
    flex: 1;
  }

  .welcome-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  .welcome-icon i {
    font-size: 28px;
    color: white;
  }

  .welcome-state h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 8px 0;
  }

  .welcome-state p {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 16px 0;
  }

  .suggestion-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 280px;
  }

  .suggestion-list button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .suggestion-list button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .suggestion-list button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .suggestion-list button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .suggestion-list button i {
    color: var(--theme-accent, #6366f1);
    width: 16px;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .suggestion-list button {
      transition: none;
    }
  }
</style>
