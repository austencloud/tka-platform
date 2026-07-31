<script lang="ts">
  /**
   * Smart Collection interface gallery.
   *
   * The production flow spans a filter bar, modal, full-height builder, rail
   * card, and live detail pane. This page renders the real presentation
   * components together so narrow, long-copy, loading, error, empty, personal,
   * and built-in states can be inspected in one document. The production
   * builder can also be opened over the gallery to exercise its real Drawer,
   * engine, filter drill, and responsive placement.
   */
  import SmartCollectionRuleSummary from "$lib/features/library/components/SmartCollectionRuleSummary.svelte";
  import SmartCollectionSaveForm from "$lib/features/library/components/SmartCollectionSaveForm.svelte";
  import SmartCollectionDetailSurface from "$lib/features/browse/collections/components/SmartCollectionDetailSurface.svelte";
  import SmartCollectionBuilderSheet from "$lib/features/browse/collections/components/SmartCollectionBuilderSheet.svelte";
  import CollectionCardSurface from "$lib/features/browse/collections/components/CollectionCardSurface.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type {
    LibraryCollection,
    SmartFilterSpec,
  } from "$lib/shared/library/domain/models/collection";

  const communityRule: SmartFilterSpec = {
    source: "community",
    filters: [
      {
        key: "difficulty",
        type: "difficulty",
        value: 1,
        label: "Level 1",
        chipColor: "#36c3ff",
      },
      {
        key: "length",
        type: "length",
        value: 8,
        label: "8 steps",
        chipColor: "#f59e0b",
      },
      {
        key: "cap_type:component:mirrored",
        type: "cap_type",
        value: "component:mirrored",
        label: "Mirrored",
        chipColor: "#a970ff",
      },
    ],
    sortMethod: "alphabetical",
    sortDirection: "asc",
  };

  const libraryRule: SmartFilterSpec = {
    source: "my-library",
    filters: [
      {
        key: "favorites",
        type: "favorites",
        value: true,
        label: "Favorites",
        chipColor: "#ec4899",
      },
      {
        key: "max_turn_intensity",
        type: "max_turn_intensity",
        value: 2,
        label: "No more than 2 turns in any motion",
        chipColor: "#22c55e",
      },
    ],
    sortMethod: "date",
    sortDirection: "desc",
  };

  const personalCard: LibraryCollection = {
    id: "smart-personal-preview",
    name: "Level 1 practice",
    description: "Sequences for the next practice session",
    ownerId: "preview-user",
    sequenceIds: [],
    sequenceCount: 127,
    color: "#8b6cff",
    icon: "fa-wand-magic-sparkles",
    isPublic: false,
    sortOrder: 0,
    kind: "smart",
    filterSpec: communityRule,
    createdAt: new Date(2026, 6, 30),
    updatedAt: new Date(2026, 6, 30),
  };

  const builtInCard: LibraryCollection = {
    ...personalCard,
    id: "founding-preview",
    name: "TKA Core Level 1",
    description: "Maintained by TKA",
    sequenceCount: 48,
    color: "#36c3ff",
    systemType: "founding",
  };

  let saveName = $state("");
  let longSaveName = $state(
    "Workshop combinations that stay within the Level 2 turn limit"
  );
  let builderOpen = $state(false);
</script>

<svelte:head>
  <title>Smart Collection interface gallery</title>
</svelte:head>

<main class="gallery">
  <header class="gallery-head">
    <div>
      <span class="kicker">Production component gallery</span>
      <h1>Smart Collections</h1>
      <p>
        Real components at the widths and states that are difficult to reach
        reliably through account data.
      </p>
    </div>
    <PanelButton variant="primary" onclick={() => (builderOpen = true)}>
      <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      Open production builder
    </PanelButton>
  </header>

  <section class="gallery-section">
    <div class="section-head">
      <div>
        <span class="kicker">Rule receipt</span>
        <h2>One rule, four container widths</h2>
      </div>
      <p>Long criteria wrap. Counts reserve their space.</p>
    </div>

    <div class="width-row">
      {#each [{ label: "Phone rail · 320px", width: 320 }, { label: "Phone detail · 375px", width: 375 }, { label: "Tablet pane · 560px", width: 560 }, { label: "Desktop pane · 820px", width: 820 }] as frame (frame.label)}
        <article class="frame">
          <h3>{frame.label}</h3>
          <div class="frame-body" style:width={`${frame.width}px`}>
            <SmartCollectionRuleSummary
              spec={frame.width < 500 ? libraryRule : communityRule}
              matchCount={frame.width === 375 ? null : 127}
              compact={frame.width === 320}
            />
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="gallery-section">
    <div class="section-head">
      <div>
        <span class="kicker">Save</span>
        <h2>Name and confirm the rule</h2>
      </div>
      <p>The same form sits inside the production modal.</p>
    </div>

    <div class="surface-grid save-grid">
      <article class="frame">
        <h3>Phone · empty name</h3>
        <div class="save-frame phone">
          <SmartCollectionSaveForm
            spec={communityRule}
            matchCount={127}
            bind:name={saveName}
            inputId="smart-collection-name-phone"
            onSave={() => {}}
          />
        </div>
      </article>
      <article class="frame">
        <h3>Desktop · long name</h3>
        <div class="save-frame desktop">
          <SmartCollectionSaveForm
            spec={libraryRule}
            matchCount={8}
            bind:name={longSaveName}
            inputId="smart-collection-name-desktop"
            onSave={() => {}}
          />
        </div>
      </article>
    </div>
  </section>

  <section class="gallery-section">
    <div class="section-head">
      <div>
        <span class="kicker">Library rail</span>
        <h2>Personal and built-in cards</h2>
      </div>
      <p>The metadata states why membership changes.</p>
    </div>

    <div class="card-widths">
      <article class="frame">
        <h3>Narrow rail · 300px</h3>
        <div class="card-stack narrow">
          <CollectionCardSurface
            collection={personalCard}
            onOpen={() => {}}
            onOptions={() => {}}
          />
          <CollectionCardSurface
            collection={builtInCard}
            readonly
            onOpen={() => {}}
          />
        </div>
      </article>
      <article class="frame">
        <h3>Card grid · 520px</h3>
        <div class="card-stack wide">
          <CollectionCardSurface
            collection={{
              ...personalCard,
              name: "Favorites with a very long turn-intensity criterion for workshops",
              sequenceCount: 8,
              filterSpec: libraryRule,
            }}
            onOpen={() => {}}
            onOptions={() => {}}
          />
          <CollectionCardSurface
            collection={builtInCard}
            readonly
            onOpen={() => {}}
          />
        </div>
      </article>
    </div>
  </section>

  <section class="gallery-section">
    <div class="section-head">
      <div>
        <span class="kicker">Detail pane</span>
        <h2>Every non-grid state</h2>
      </div>
      <p>Personal rules recover. Built-in rules stay read-only.</p>
    </div>

    <div class="detail-matrix">
      <article class="frame">
        <h3>Phone · empty personal rule</h3>
        <div class="detail-frame phone-detail">
          <SmartCollectionDetailSurface
            name="Level 1 practice"
            color="#8b6cff"
            spec={communityRule}
            matchCount={0}
            onBack={() => {}}
            onEdit={() => {}}
            onOptions={() => {}}
          />
        </div>
      </article>

      <article class="frame">
        <h3>Handheld landscape · loading</h3>
        <div class="detail-frame landscape-detail">
          <SmartCollectionDetailSurface
            name="Workshop favorites"
            color="#ec4899"
            spec={libraryRule}
            matchCount={null}
            loading
            onBack={() => {}}
            onEdit={() => {}}
            onOptions={() => {}}
          />
        </div>
      </article>

      <article class="frame">
        <h3>Tablet · connection error</h3>
        <div class="detail-frame tablet-detail">
          <SmartCollectionDetailSurface
            name="Level 1 practice"
            color="#8b6cff"
            spec={communityRule}
            matchCount={null}
            error
            showBack={false}
            onEdit={() => {}}
            onOptions={() => {}}
            onRetry={() => {}}
          />
        </div>
      </article>

      <article class="frame">
        <h3>Desktop · empty built-in rule</h3>
        <div class="detail-frame desktop-detail">
          <SmartCollectionDetailSurface
            name="TKA Core Level 1"
            description="Maintained by TKA."
            color="#36c3ff"
            spec={communityRule}
            matchCount={0}
            readOnly
            showBack={false}
          />
        </div>
      </article>
    </div>
  </section>
</main>

{#if builderOpen}
  <SmartCollectionBuilderSheet
    mode="create"
    onClose={() => (builderOpen = false)}
  />
{/if}

<style>
  :global(body) {
    margin: 0;
    background: #0d1017;
  }

  .gallery {
    min-height: 100vh;
    padding: clamp(20px, 3vw, 56px);
    background:
      radial-gradient(
        circle at 15% 0%,
        rgba(139, 108, 255, 0.11),
        transparent 26rem
      ),
      #0d1017;
    color: var(--theme-text, #f7f8fb);
    font-family: system-ui, sans-serif;
  }

  .gallery-head,
  .section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
  }

  .gallery-head {
    width: min(100%, var(--shell-w, min(1720px, 92vw)));
    margin: 0 auto clamp(34px, 5vw, 70px);
  }

  .gallery-head h1,
  .section-head h2 {
    margin: 4px 0 0;
    letter-spacing: -0.025em;
  }

  .gallery-head h1 {
    font-size: clamp(32px, 5vw, 64px);
  }

  .section-head h2 {
    font-size: clamp(22px, 3vw, 34px);
  }

  .gallery-head p,
  .section-head p {
    max-width: 520px;
    margin: 8px 0 0;
    color: #9da7b8;
    font-size: 14px;
    line-height: 1.5;
  }

  .section-head > p {
    text-align: right;
  }

  .kicker {
    color: #9b8cff;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .gallery-section {
    width: min(100%, var(--shell-w, min(1720px, 92vw)));
    margin: 0 auto 72px;
  }

  .section-head {
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .width-row,
  .surface-grid,
  .card-widths,
  .detail-matrix {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 24px;
  }

  .frame {
    min-width: 0;
  }

  .frame h3 {
    margin: 0 0 8px;
    color: #9da7b8;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
  }

  .frame-body,
  .save-frame,
  .card-stack,
  .detail-frame {
    max-width: calc(100vw - 40px);
    overflow: hidden;
    border: 1px solid #2c3443;
    border-radius: 16px;
    background: var(--theme-panel-bg, #151923);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24);
  }

  .frame-body {
    padding: 12px;
  }

  .save-grid {
    display: grid;
    grid-template-columns: minmax(320px, 420px) minmax(520px, 660px);
  }

  .save-grid > .frame {
    width: 100%;
  }

  .save-frame.phone {
    width: min(375px, 100%);
  }

  .save-frame.desktop {
    width: min(640px, 100%);
  }

  .card-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  .card-stack.narrow {
    width: 300px;
  }

  .card-stack.wide {
    width: 520px;
  }

  .detail-matrix {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-matrix > .frame {
    width: 100%;
  }

  .detail-frame {
    width: 100%;
    max-width: 100%;
  }

  .phone-detail {
    width: 375px;
    height: 667px;
  }

  .landscape-detail {
    width: min(960px, 100%);
    height: 412px;
  }

  .tablet-detail {
    width: 820px;
    height: 720px;
  }

  .desktop-detail {
    width: min(100%, 1160px);
    height: 680px;
  }

  @media (max-width: 900px) {
    .gallery-head,
    .section-head {
      align-items: stretch;
      flex-direction: column;
    }

    .section-head > p {
      text-align: left;
    }

    .save-grid,
    .detail-matrix {
      display: flex;
      flex-direction: column;
    }

    .width-row > .frame,
    .surface-grid > .frame,
    .card-widths > .frame,
    .detail-matrix > .frame {
      width: 100%;
    }
  }
</style>
