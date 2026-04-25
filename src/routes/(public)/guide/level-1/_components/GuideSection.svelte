<script lang="ts">
  import type { Snippet } from "svelte";
  import { getActiveSectionSetter } from "../_data/guide-data-context";

  let {
    id,
    title,
    subtitle,
    children,
  }: {
    id: string;
    title: string;
    subtitle?: string;
    children: Snippet;
  } = $props();

  const reportActive = getActiveSectionSetter();
  let sectionEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (!sectionEl || !reportActive) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reportActive(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section bind:this={sectionEl} {id} class="guide-section">
  <h2>{title}</h2>
  {#if subtitle}
    <h3>{subtitle}</h3>
  {/if}
  {@render children()}
</section>
