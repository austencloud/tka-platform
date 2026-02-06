<script lang="ts">
  let { currentPage, totalPages } = $props<{
    currentPage: number;
    totalPages: number;
  }>();
</script>

<div class="progress-indicator">
  {#each Array(totalPages) as _, i}
    <div
      class="progress-dot"
      class:active={i + 1 === currentPage}
      class:completed={i + 1 < currentPage}
    ></div>
  {/each}
</div>

<style>
  .progress-indicator {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    border-radius: 20px;
    z-index: 100;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all var(--duration-emphasis) ease;
  }

  .progress-dot.active {
    background: #50c878;
    transform: scale(1.25);
  }

  .progress-dot.completed {
    background: rgba(80, 200, 120, 0.5);
  }
</style>
