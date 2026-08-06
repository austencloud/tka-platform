<script lang="ts">
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import GalleryFilterSheet from "$lib/features/browse/gallery-home/GalleryFilterSheet.svelte";
  import CollectionChipsRow from "$lib/features/library/components/collection-picker/CollectionChipsRow.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import { getCollectionSequences } from "$lib/shared/library/services/collection-manager";
  import { getUserCollectionSequences } from "$lib/features/library/services/public-collection-loader";
  import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
  import { communityCollectionsState } from "$lib/features/browse/collections/state/community-collections-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ResolveOutcome } from "../../services/sheet-sequence-resolver";
  import { getChoreoSheetContext } from "../../state/choreo-sheet-state.svelte";

  let {
    isOpen = $bindable(false),
    resolveSequence,
  }: {
    isOpen?: boolean;
    resolveSequence: (
      id: string,
      signal: AbortSignal
    ) => Promise<ResolveOutcome>;
  } = $props();

  const { state: builder } = getChoreoSheetContext();
  const engine = createBrowseEngine({
    persistKey: "tka-choreo-sheet-picker",
    initialSource: "my-library",
    minColumns: 2,
  });

  let filterOpen = $state(false);
  let settled = $state(false);
  let initialized = false;
  let sideBySide = $state(false);
  let addingCollectionId = $state<string | null>(null);

  function initialize(): void {
    settled = true;
    if (initialized) return;
    initialized = true;
    engine.initialize();
  }

  onMount(() => {
    sideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    const unsubscribe = responsiveLayoutManager.onLayoutChange(() => {
      sideBySide = responsiveLayoutManager.shouldUseSideBySideLayout();
    });
    if (isOpen) initialize();
    return () => {
      unsubscribe();
      engine.destroy();
    };
  });

  async function handleSelect(sequence: SequenceData): Promise<void> {
    try {
      const outcome = await resolveSequence(
        sequence.id,
        new AbortController().signal
      );
      builder.addHydratedSequences([outcome.sequence ?? sequence]);
    } catch (error) {
      console.warn(
        "[SheetBrowserDrawer] Failed to hydrate selected sequence:",
        error
      );
      builder.addHydratedSequences([sequence]);
    }
  }

  async function handleAddCollection(collectionId: string): Promise<void> {
    if (addingCollectionId) return;
    addingCollectionId = collectionId;
    try {
      const own = collectionsState.collections.find(
        (collection) => collection.id === collectionId
      );
      const community = communityCollectionsState.items.find(
        (item) => item.collection.id === collectionId
      );
      const isOwnSource = engine.source === "my-library";
      const collectionName = isOwnSource
        ? own?.name
        : community?.collection.name;
      const sequences = isOwnSource
        ? await getCollectionSequences(collectionId)
        : community
          ? await getUserCollectionSequences(community.ownerId, collectionId)
          : [];

      if (!collectionName) {
        toast.error("That collection is no longer available.");
        return;
      }

      const existingIds = new Set(builder.sequenceIds);
      const additions = sequences.filter(
        (sequence) => !existingIds.has(sequence.id)
      );
      const wasEmpty = builder.sequenceIds.length === 0;
      builder.addHydratedSequences(sequences);
      if (wasEmpty && sequences.length > 0) {
        builder.setName(collectionName);
        builder.setLayout({ columns: 4, rowsPerPage: 3 });
      }

      if (additions.length === 0) {
        toast.info("That collection is already on this act.");
      } else {
        const noun = additions.length === 1 ? "sequence" : "sequences";
        toast.success(
          `Added ${additions.length} ${noun} from "${collectionName}".`
        );
      }
    } catch (error) {
      console.error("[SheetBrowserDrawer] Failed to add collection:", error);
      toast.error("Couldn't add that collection. Try again.");
    } finally {
      addingCollectionId = null;
    }
  }
</script>

<Drawer
  bind:isOpen
  placement={sideBySide ? "right" : "bottom"}
  ariaLabel="Add sequences"
  class="choreo-browser-drawer"
  showHandle={!sideBySide}
  onOpenChange={(open) => {
    if (open) initialize();
  }}
>
  <div class="browser">
    <header>
      <strong>Add sequences</strong>
      <span>Tap a card to add a row</span>
      <button
        type="button"
        aria-label="Close browser"
        onclick={() => (isOpen = false)}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </header>

    {#if settled}
      <CollectionChipsRow
        {engine}
        onAddCollection={(collectionId) =>
          void handleAddCollection(collectionId)}
        addCollectionBusy={addingCollectionId !== null}
      />
      <div class="panel">
        <BrowsePanel
          {engine}
          layout="compact"
          showSourceToggle
          onSelect={(sequence) => void handleSelect(sequence)}
          hideToolbarSearch
          onOpenFilters={() => (filterOpen = true)}
        />
      </div>
    {:else}
      <div class="skeleton" aria-hidden="true">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="grid">
          {#each { length: 6 } as _}<div class="card"></div>{/each}
        </div>
      </div>
    {/if}
  </div>
  <GalleryFilterSheet
    {engine}
    bind:isOpen={filterOpen}
    isMobile={!sideBySide}
  />
</Drawer>

<style>
  :global(.choreo-browser-drawer) {
    width: min(clamp(400px, 30vw, 640px), 92vw) !important;
    height: 100% !important;
    max-height: 100% !important;
    background: var(--theme-panel-bg) !important;
  }
  :global(.choreo-browser-drawer[data-placement="bottom"]) {
    width: 100% !important;
    height: min(78vh, 720px) !important;
  }
  .browser {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--theme-panel-bg);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: 52px;
    padding: 0 var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke);
    color: var(--theme-text);
  }
  header span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
  }
  header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-left: auto;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim);
  }
  .panel {
    flex: 1;
    min-height: 0;
  }
  .skeleton {
    display: grid;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }
  .bar,
  .card {
    border-radius: 8px;
    background: var(--theme-card-bg);
  }
  .bar {
    height: 36px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }
  .card {
    aspect-ratio: 1;
  }
</style>
