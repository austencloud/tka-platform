<script lang="ts">
  interface Props {
    achievements: string[];
  }

  let { achievements }: Props = $props();
</script>

{#if achievements && achievements.length > 0}
  <div class="achievements-section">
    <h4>Achievements</h4>
    <div class="quiz-achievements-grid">
      {#each achievements as achievement}
        <div class="achievement-badge">
          {achievement}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .achievements-section {
    padding: var(--spacing-lg);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .achievements-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-color);
  }

  .quiz-achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--spacing-sm);
  }

  .achievement-badge {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      var(--semantic-warning) 100%
    );
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: white;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    transition: all var(--transition-fast);
  }

  .achievement-badge:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  @media (max-width: 640px) {
    .quiz-achievements-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
