<!--
  ComposerPracticeStepperDemo

  The Practice bento cell: step through the fixture one beat at a time,
  the way practice mode drills a sequence. Real pictographs, prev/next,
  progress. Pure client, no engine.
-->
<script lang="ts">
  import GuidePictograph from "../../guide/level-1/_components/GuidePictograph.svelte";
  import { DEMO_LETTER_BEATS } from "../_data/demo-beats";

  let step = $state(0);
  const total = DEMO_LETTER_BEATS.length;
  const current = $derived(DEMO_LETTER_BEATS[step]);

  function prev() {
    step = (step - 1 + total) % total;
  }
  function next() {
    step = (step + 1) % total;
  }
</script>

<div class="stepper-demo">
  <div class="stepper-row">
    <button type="button" class="step-btn" onclick={prev} aria-label="Previous step">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <div class="step-stage">
      {#key current?.id}
        <GuidePictograph data={current} size="md" bordered eager />
      {/key}
    </div>
    <button type="button" class="step-btn" onclick={next} aria-label="Next step">
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>
  <div class="progress">
    <div class="bar"><div class="fill" style:width={`${((step + 1) / total) * 100}%`}></div></div>
    <span class="count">step {step + 1} / {total}</span>
  </div>
</div>

<style>
  .stepper-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.9rem 0.8rem 0.2rem;
  }

  .stepper-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .step-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: oklch(0.82 0.02 270);
    background: oklch(0.3 0.04 270 / 0.18);
    border: 1px solid oklch(0.5 0.06 270 / 0.3);
    cursor: pointer;
    transition: background 140ms ease;
  }
  .step-btn:hover {
    background: oklch(0.34 0.05 270 / 0.28);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 0.8rem;
    width: 100%;
    max-width: 15rem;
  }
  .bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: oklch(0.3 0.03 270 / 0.5);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 2px;
    background: oklch(0.65 0.15 275);
    transition: width 200ms ease;
  }
  .count {
    font-size: 0.78rem;
    color: oklch(0.62 0.02 270);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-btn,
    .fill {
      transition: none;
    }
  }
</style>
