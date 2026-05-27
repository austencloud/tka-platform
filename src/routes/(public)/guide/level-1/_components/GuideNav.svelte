<script lang="ts">
  import { page } from "$app/state";
  import { guideChapters } from "../_data/nav-config";

  let {
    activeSectionId = $bindable(""),
    activeChapter = $bindable<string | null>(null),
    onChapterSelect,
  }: {
    activeSectionId?: string;
    activeChapter?: string | null;
    onChapterSelect?: (slug: string) => void;
  } = $props();

  const currentPath = $derived(page.url.pathname);

  function isChapterActive(slug: string): boolean {
    if (activeChapter !== null && activeChapter !== undefined) {
      return activeChapter === slug;
    }
    return currentPath.endsWith(`/${slug}`);
  }

  function handleChapterClick(e: MouseEvent, slug: string) {
    if (onChapterSelect) {
      e.preventDefault();
      onChapterSelect(slug);
    }
  }
</script>

<nav class="guide-nav" aria-label="Guide navigation">
  <div class="nav-title">
    {#if onChapterSelect}
      <button class="nav-title-btn" onclick={(e) => { e.preventDefault(); onChapterSelect?.(""); }}>
        Level 1 Guide
      </button>
    {:else}
      <a href="/guide/level-1">Level 1 Guide</a>
    {/if}
  </div>

  {#each guideChapters as chapter}
    <div class="chapter-group">
      {#if onChapterSelect}
        <button
          class="chapter-title"
          class:active={isChapterActive(chapter.slug)}
          onclick={(e) => handleChapterClick(e, chapter.slug)}
        >
          {chapter.title}
        </button>
      {:else}
        <a
          class="chapter-title"
          class:active={isChapterActive(chapter.slug)}
          href="/guide/level-1/{chapter.slug}"
        >
          {chapter.title}
        </a>
      {/if}

      {#if isChapterActive(chapter.slug)}
        <ul class="section-list">
          {#each chapter.sections as section}
            <li>
              <a
                class="section-link"
                class:active={activeSectionId === section.id}
                href="#{section.id}"
              >
                {section.title}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</nav>

<style>
  .nav-title-btn {
    all: unset;
    cursor: pointer;
    font-weight: 700;
    font-size: 1rem;
    padding: 0.5rem 0.75rem;
    color: #1a1a1a;
  }
</style>
