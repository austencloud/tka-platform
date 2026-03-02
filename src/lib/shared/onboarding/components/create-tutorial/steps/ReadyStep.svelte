<!--
  ReadyStep - Step 5 of the create tutorial

  Simple send-off with a rocket icon and "Got it" button that completes
  the tutorial.
-->
<script lang="ts">
  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <div class="icon-area">
    <i class="fas fa-rocket" aria-hidden="true"></i>
  </div>

  <h1 class="title">You're ready</h1>
  <p class="subtitle">
    Clear, transform, extend — it's all here. Go build something.
  </p>

  <button class="go-button" onclick={onAdvance}>
    Got it <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .tutorial-step {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-area {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    box-shadow: 0 0 24px
        color-mix(
          in srgb,
          var(--theme-accent-strong, #8b5cf6) 20%,
          transparent
        ),
      0 0 48px
        color-mix(
          in srgb,
          var(--theme-accent-strong, #8b5cf6) 10%,
          transparent
        );
  }

  .icon-area i {
    font-size: 1.8rem;
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    line-height: 1.5;
  }

  .go-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 32px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 4px;
  }

  .go-button:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .go-button:active {
    transform: scale(0.97);
  }

  .go-button:focus-visible {
    outline: 2px solid var(--theme-accent-strong, #8b5cf6);
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 16px;
      gap: 10px;
    }
    .title {
      font-size: 1.25rem;
    }
    .icon-area {
      width: 60px;
      height: 60px;
    }
    .icon-area i {
      font-size: 1.5rem;
    }
    .go-button {
      padding: 12px 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step,
    .go-button {
      transition: none;
    }
  }
</style>
