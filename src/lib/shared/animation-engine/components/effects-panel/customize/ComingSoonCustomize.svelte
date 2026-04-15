<script lang="ts">
  interface Props {
    effectLabel: string;
    onBack: () => void;
  }
  const { effectLabel, onBack }: Props = $props();
</script>

<div class="coming-soon">
  <header>
    <button type="button" class="back-btn" onclick={onBack} aria-label="Back">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <span>{effectLabel}</span>
  </header>
  <p>Controls for {effectLabel} land in a follow-up phase. The effect is visible here so you can see where it'll live.</p>
</div>

<style>
  .coming-soon { padding: 8px 4px; font-size: 12px; opacity: 0.8; }
  .coming-soon header {
    display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 8px;
  }
  .back-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    background: transparent; color: inherit; cursor: pointer;
  }
  .coming-soon p { line-height: 1.5; }
</style>
