<!--
QuizLetterCard - Question letter display
-->
<script lang="ts">
  let { letter }: { letter: string } = $props();
</script>

<div class="letter-section">
  <div class="letter-card">
    <span class="letter">{letter}</span>
  </div>
</div>

<style>
  .letter-section {
    display: flex;
    justify-content: center;
    align-items: center;
    animation: letterEntrance var(--duration-dramatic) cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes letterEntrance {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .letter-card {
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 15%, transparent),
      color-mix(in srgb, var(--theme-accent) 15%, transparent)
    );
    border-radius: 20px;
    border: 2px solid var(--theme-stroke-strong);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 0 0 1px color-mix(in srgb, var(--theme-text) 8%, transparent),
      0 0 80px -20px color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .letter {
    font-size: 5rem;
    font-weight: 800;
    color: var(--theme-text, #ffffff);
    font-family: Georgia, serif;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  @media (min-width: 600px) {
    .letter-card {
      width: 160px;
      height: 160px;
      border-radius: 24px;
    }

    .letter {
      font-size: 6rem;
    }
  }

  @media (min-width: 900px) {
    .letter-card {
      width: 180px;
      height: 180px;
      box-shadow:
        0 12px 50px rgba(0, 0, 0, 0.15),
        0 0 0 1px color-mix(in srgb, var(--theme-text) 6%, transparent),
        0 0 120px -30px color-mix(in srgb, var(--theme-accent) 20%, transparent);
    }

    .letter {
      font-size: 7rem;
    }
  }

  @media (min-width: 1200px) {
    .letter-card {
      width: 200px;
      height: 200px;
    }

    .letter {
      font-size: 8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-section {
      animation: none;
    }
  }
</style>
