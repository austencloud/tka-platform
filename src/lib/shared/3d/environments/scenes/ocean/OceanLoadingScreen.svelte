<script lang="ts">
  interface Props {
    progress: number;
    visible: boolean;
  }

  let { progress, visible }: Props = $props();

  const percent = $derived(Math.round(progress * 100));
</script>

{#if visible}
  <div class="ocean-loading-overlay" class:fade-out={progress >= 1}>
    <div class="loading-content">
      <div class="wave-container">
        <svg viewBox="0 0 200 20" class="wave-svg">
          <path
            d="M0,10 Q25,2 50,10 T100,10 T150,10 T200,10"
            fill="none"
            stroke="rgba(100,180,220,0.6)"
            stroke-width="1.5"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-50,0;0,0;-50,0"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M0,12 Q25,4 50,12 T100,12 T150,12 T200,12"
            fill="none"
            stroke="rgba(100,180,220,0.3)"
            stroke-width="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;-50,0;0,0"
              dur="4s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>

      <div class="progress-bar-track">
        <div class="progress-bar-fill" style:width="{percent}%"></div>
      </div>

      <span class="progress-text">{percent}%</span>
    </div>
  </div>
{/if}

<style>
  .ocean-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #1a5580 100%);
    transition: opacity 300ms ease-out;
    pointer-events: all;
  }

  .ocean-loading-overlay.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: min(280px, 60vw);
  }

  .wave-container {
    width: 100%;
    height: 20px;
    overflow: hidden;
  }

  .wave-svg {
    width: 150%;
    height: 100%;
  }

  .progress-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(100, 180, 220, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a90b8, #7ec8e3);
    border-radius: 2px;
    transition: width 200ms ease-out;
  }

  .progress-text {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    color: rgba(126, 200, 227, 0.6);
    letter-spacing: 0.1em;
  }
</style>
