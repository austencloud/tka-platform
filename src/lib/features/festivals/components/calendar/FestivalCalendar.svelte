<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import FestivalMonthView from "./FestivalMonthView.svelte";

  const { state } = getFestivalContext();

  const trackedFestivals = $derived(state.trackedFestivals);
  const trackers = $derived(state.trackers);
  const hasTracked = $derived(trackedFestivals.length > 0);
</script>

<div class="festival-calendar">
  {#if hasTracked}
    <FestivalMonthView festivals={trackedFestivals} {trackers} />
  {:else}
    <div class="empty-state">
      <i class="fas fa-calendar-alt empty-icon" aria-hidden="true"></i>
      <p class="empty-title">No festivals tracked yet.</p>
      <p class="empty-hint">Browse the Discover tab to find festivals.</p>
    </div>
  {/if}
</div>

<style>
  .festival-calendar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-icon {
    font-size: 40px;
    opacity: 0.4;
    margin-bottom: 8px;
  }

  .empty-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .empty-hint {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }
</style>
