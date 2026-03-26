<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import { container } from "$lib/shared/di";
  import { Timestamp } from "firebase/firestore";
  import FestivalFilterBar from "./FestivalFilterBar.svelte";
  import FestivalGridCard from "./FestivalGridCard.svelte";
  import FestivalSubmissionForm from "../submit/FestivalSubmissionForm.svelte";
  import ModerationQueue from "../moderation/ModerationQueue.svelte";
  import { FESTIVAL_SEEDS } from "../../data/festival-seed";

  // Destructure as festivalState to avoid conflict with Svelte 5 $state rune
  const { state: festivalState } = getFestivalContext();

  let showSubmitForm = $state(false);
  let isSeeding = $state(false);
  let seedResult = $state<string | null>(null);

  async function seedDatabase() {
    isSeeding = true;
    seedResult = null;
    try {
      const repo = container.items.festivalRepository;
      let count = 0;
      for (const seed of FESTIVAL_SEEDS) {
        const doc: Record<string, any> = {
          name: seed.name,
          organizationId: seed.organizationId,
          organization: seed.organization,
          location: seed.location,
          dates: {
            start: Timestamp.fromDate(new Date(seed.startDate)),
            end: Timestamp.fromDate(new Date(seed.endDate)),
          },
          seekingInstructors: seed.seekingInstructors,
          seekingPerformers: seed.seekingPerformers,
          description: seed.description,
          region: seed.region,
          status: "upcoming",
          tags: seed.tags,
          source: "curated",
          moderationStatus: "approved",
        };
        // Only add optional fields if they have values
        if (seed.applicationDeadline) doc.applicationDeadline = Timestamp.fromDate(new Date(seed.applicationDeadline));
        if (seed.applicationUrl) doc.applicationUrl = seed.applicationUrl;
        if (seed.applicationContact) doc.applicationContact = seed.applicationContact;
        if (seed.websiteUrl) doc.websiteUrl = seed.websiteUrl;
        if (seed.imageUrl) doc.imageUrl = seed.imageUrl;
        if (seed.socialLinks) doc.socialLinks = seed.socialLinks;
        if (seed.estimatedSize) doc.estimatedSize = seed.estimatedSize;

        await repo.create(doc as any);
        count++;
      }
      seedResult = `Seeded ${count} festivals`;
      // Reload
      const uid = auth.currentUser?.uid;
      if (uid) await festivalState.loadFestivals(uid);
    } catch (e) {
      seedResult = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      isSeeding = false;
    }
  }

  async function handleBookmark(festivalId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await festivalState.updateTracker(uid, festivalId, { status: "interested" });
  }

  async function handleLoadMore() {
    await festivalState.loadMore();
  }
</script>

<div class="discover-tab">
  <ModerationQueue />

  <FestivalFilterBar />

  {#if festivalState.festivals.length === 0}
    <div class="empty-state">
      <i class="fas fa-compass" aria-hidden="true"></i>
      <p>No festivals match your filters.</p>
      <p class="empty-hint">Try adjusting the region or time window.</p>
    </div>
  {:else}
    <div class="festival-grid" role="list" aria-label="Festival results">
      {#each festivalState.festivals as festival (festival.id)}
        <div role="listitem">
          <FestivalGridCard
            {festival}
            tracker={festivalState.trackers.get(festival.id)}
            attendanceCount={festivalState.attendanceCounts.get(festival.id) ?? 0}
            onselect={() => (festivalState.selectedFestival = festival)}
            onbookmark={() => handleBookmark(festival.id)}
          />
        </div>
      {/each}
    </div>

    {#if festivalState.hasMore}
      <div class="load-more-row">
        <button class="load-more-btn" onclick={handleLoadMore}>
          Load more
        </button>
      </div>
    {/if}
  {/if}

  <!-- Admin: Seed database with scraped festival data -->
  {#if festivalState.festivals.length === 0}
    <div class="seed-row">
      <button
        type="button"
        class="seed-btn"
        onclick={seedDatabase}
        disabled={isSeeding}
      >
        <i class="fas fa-database" aria-hidden="true"></i>
        {isSeeding ? "Seeding..." : "Seed 51 festivals from scraped data"}
      </button>
      {#if seedResult}
        <p class="seed-result">{seedResult}</p>
      {/if}
    </div>
  {/if}

  <div class="submit-row">
    <button
      type="button"
      class="submit-festival-btn"
      onclick={() => (showSubmitForm = true)}
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
      Submit a festival
    </button>
  </div>
</div>

{#if showSubmitForm}
  <FestivalSubmissionForm onclose={() => (showSubmitForm = false)} />
{/if}

<style>
  .discover-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .festival-grid {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .festival-grid::-webkit-scrollbar {
    width: 6px;
  }

  .festival-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .festival-grid::-webkit-scrollbar-thumb {
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

  .seed-row {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .seed-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    padding: 12px 24px;
    font-weight: 600;
  }

  .seed-btn:hover {
    opacity: 0.9;
  }

  .seed-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .seed-result {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-success, #10b981);
  }

  .submit-row {
    padding: 16px;
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .submit-festival-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    padding: 10px 24px;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .submit-festival-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #ffffff);
  }

  @media (prefers-reduced-motion: reduce) {
    .submit-festival-btn {
      transition: none;
    }
  }
</style>
