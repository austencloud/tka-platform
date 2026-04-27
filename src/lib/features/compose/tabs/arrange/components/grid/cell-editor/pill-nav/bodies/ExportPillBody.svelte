<script lang="ts">
  let {
    frameRate = 60,
    resolution = '1080p',
    startHold = false,
    endHold = false,
    loops = 1,
    onFrameRateChange,
    onResolutionChange,
    onStartHoldChange,
    onEndHoldChange,
    onLoopsChange,
  }: {
    frameRate?: number;
    resolution?: string;
    startHold?: boolean;
    endHold?: boolean;
    loops?: number;
    onFrameRateChange?: (fps: number) => void;
    onResolutionChange?: (res: string) => void;
    onStartHoldChange?: (hold: boolean) => void;
    onEndHoldChange?: (hold: boolean) => void;
    onLoopsChange?: (count: number) => void;
  } = $props();

  const FPS_OPTIONS = [30, 60, 120];
  const RES_OPTIONS = ['720p', '1080p', '4K', '8K'];
</script>

<div class="export-body">
  <span class="section-label">FRAME RATE</span>
  <div class="option-row three-col">
    {#each FPS_OPTIONS as fps}
      <button
        class="option-btn"
        class:active={frameRate === fps}
        onclick={() => onFrameRateChange?.(fps)}
      >
        {fps} fps
      </button>
    {/each}
  </div>

  <span class="section-label">RESOLUTION</span>
  <div class="option-row four-col">
    {#each RES_OPTIONS as res}
      <button
        class="option-btn"
        class:active={resolution === res}
        onclick={() => onResolutionChange?.(res)}
      >
        {res}
      </button>
    {/each}
  </div>

  <span class="section-label">TIMING</span>
  <div class="option-row two-col">
    <button
      class="option-btn"
      class:active={startHold}
      onclick={() => onStartHoldChange?.(!startHold)}
    >
      <i class="fas fa-step-backward" aria-hidden="true"></i>
      Start Hold
    </button>
    <button
      class="option-btn"
      class:active={endHold}
      onclick={() => onEndHoldChange?.(!endHold)}
    >
      <i class="fas fa-step-forward" aria-hidden="true"></i>
      End Hold
    </button>
  </div>

  <div class="loops-row">
    <span class="loops-label">Loops</span>
    <div class="loops-stepper">
      <button
        class="stepper-btn"
        onclick={() => onLoopsChange?.(Math.max(1, loops - 1))}
        disabled={loops <= 1}
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="loops-value">{loops}x</span>
      <button
        class="stepper-btn"
        onclick={() => onLoopsChange?.(loops + 1)}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .export-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .option-row { display: grid; gap: 4px; }
  .two-col { grid-template-columns: 1fr 1fr; }
  .three-col { grid-template-columns: 1fr 1fr 1fr; }
  .four-col { grid-template-columns: repeat(4, 1fr); }

  .option-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .option-btn:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .option-btn.active {
    border: 1.5px solid var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 14%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .option-btn i { font-size: 12px; }

  .loops-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }

  .loops-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
  }

  .loops-stepper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stepper-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--action-radius, 8px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    cursor: pointer;
  }

  .stepper-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .stepper-btn i { font-size: 12px; }

  .loops-value {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    min-width: 28px;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .option-btn { transition: none; }
  }
</style>
