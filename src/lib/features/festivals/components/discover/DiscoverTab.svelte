<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import FestivalFilterBar from "./FestivalFilterBar.svelte";
  import FestivalCard from "./FestivalCard.svelte";

  const { state } = getFestivalContext();

  async function handleBookmark(festivalId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await state.updateTracker(uid, festivalId, { status: "interested" });
  }

  async function handleLoadMore() {
    await state.loadMore();
  }
</script>

<div class="discover-tab">
  <FestivalFilterBar />

  {#if state.festivals.length === 0}
    <div class="empty-state">
      <i class="fas fa-compass" aria-hidden="true"></i>
      <p>No festivals match your filters.</p>
      <p class="empty-hint">Try adjusting the region or time window.</p>
    </div>
  {:else}
    <div class="festival-list" role="list" aria-label="Festival results">
      {#each state.festivals as festival (festival.id)}
        <div role="listitem">
          <FestivalCard
            {festival}
            tracker={state.trackers.get(festival.id)}
            attendanceCount={state.attendanceCounts.get(festival.id) ?? 0}
            onselect={() => (state.selectedFestival = festival)}
            onbookmark={() => handleBookmark(festival.id)}
          />
        </div>
      {/each}
    </div>

    {#if state.hasMore}
      <div class="load-more-row">
        <button class="load-more-btn" onclick={handleLoadMore}>
          Load more
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .discover-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .festival-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .festival-list::-webkit-scrollbar {
    width: 6px;
  }

  .festival-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .festival-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px 24px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  .empty-state i {
    font-size: 40px;
    opacity: 0.3;
    margin-bottom: 8px;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }

  .empty-hint {
    font-size: var(--font-size-compact, 12px) !important;
    opacity: 0.7;
  }

  .load-more-row {
    padding: 16px;
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .load-more-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    padding: 10px 32px;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .load-more-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }
</style>
