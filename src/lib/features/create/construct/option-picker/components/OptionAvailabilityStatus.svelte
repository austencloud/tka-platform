<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { growFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";

  interface Props {
    active: boolean;
    shownCount: number;
    hiddenCount: number;
    sharesSettingsTrigger?: boolean;
  }

  const {
    active,
    shownCount,
    hiddenCount,
    sharesSettingsTrigger = false,
  }: Props = $props();

  const visualMessage = $derived(
    hiddenCount === 0
      ? `${shownCount} shown · none would reverse a hand.`
      : shownCount === 0
        ? "No options shown · every option would reverse a hand."
        : `${shownCount} shown · ${hiddenCount} hidden: ${hiddenCount === 1 ? "it would" : "they would"} reverse a hand.`
  );
  const announcement = $derived(
    active
      ? hiddenCount === 0
        ? `${shownCount} options shown. None would reverse a hand.`
        : shownCount === 0
          ? "No options shown. Every option would reverse a hand, so Continuous mode hides them."
          : `${shownCount} options shown. ${hiddenCount} options would reverse a hand, so Continuous mode hides them.`
      : ""
  );
</script>

<div class="option-availability-slot">
  <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </span>

  {#if active}
    <div
      class="availability-status"
      class:shares-settings-trigger={sharesSettingsTrigger}
      aria-hidden="true"
      transition:growFade={{ axis: "y", duration: DURATION.emphasis }}
    >
      <i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
      <div class="availability-copy">
        <Crossfade key={visualMessage} duration={DURATION.fast}>
          <span>{visualMessage}</span>
        </Crossfade>
      </div>
    </div>
  {/if}
</div>

<style>
  .option-availability-slot {
    flex: 0 0 auto;
    width: 100%;
  }

  .availability-status {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(
      --theme-panel-bg,
      var(--theme-card-bg, rgba(0, 0, 0, 0.75))
    );
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
  }

  .availability-status.shares-settings-trigger {
    min-height: calc(var(--min-touch-target, 44px) + 4px);
    padding-inline: calc(var(--min-touch-target, 44px) + 18px);
  }

  .availability-status > i {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: 0.875rem;
  }

  .availability-copy {
    min-width: 0;
  }
</style>
