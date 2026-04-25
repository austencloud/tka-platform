<script lang="ts">
  import { page } from "$app/stores";
  import { guideChapters } from "../_data/nav-config";

  let { activeSectionId = $bindable("") }: { activeSectionId?: string } = $props();

  const currentPath = $derived($page.url.pathname);

  function isChapterActive(slug: string): boolean {
    return currentPath.endsWith(`/${slug}`);
  }
</script>

<nav class="guide-nav" aria-label="Guide navigation">
  <div class="nav-title">
    <a href="/guide/level-1">Level 1 Guide</a>
  </div>

  {#each guideChapters as chapter}
    <div class="chapter-group">
      <a
        class="chapter-title"
        class:active={isChapterActive(chapter.slug)}
        href="/guide/level-1/{chapter.slug}"
      >
        {chapter.title}
      </a>

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
