<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import LearnTab from "../LearnTab.svelte";
  import { getConceptById } from "../domain/concepts";

  const concept = $derived(
    page.params.conceptId ? getConceptById(page.params.conceptId) : undefined
  );
  const title = $derived(
    concept
      ? `${concept.name} | Interactive TKA Lesson`
      : "Interactive TKA Lessons"
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta
    name="description"
    content="Learn The Kinetic Alphabet through the interactive lessons currently available in Flow Arts Composer."
  />
</svelte:head>

<section class="public-course" aria-label="Interactive TKA lessons">
  {#if browser}
    <LearnTab publicCourse />
  {:else}
    <div class="course-prerender">
      <span>Learn by doing</span>
      <h1>{concept?.name ?? "Interactive TKA lessons"}</h1>
      <p>
        Six guided lessons are available now, from the grid through reading TKA
        words. The interactive course starts when this page loads in your
        browser.
      </p>
      <a href="/guide">Prefer to read? Open the Guide</a>
    </div>
  {/if}
</section>

<style>
  .public-course {
    width: 100%;
    min-height: calc(100dvh - 64px);
    margin-top: 64px;
  }

  .course-prerender {
    display: grid;
    width: min(100% - 2rem, 54rem);
    min-height: 32rem;
    margin: 0 auto;
    padding: clamp(3rem, 10vw, 8rem) 1rem;
    align-content: start;
  }

  .course-prerender > span {
    color: #8facff;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .course-prerender h1 {
    margin: 0.75rem 0 0;
    color: #fff;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-size: clamp(2.5rem, 8vw, 5rem);
    line-height: 1;
  }

  .course-prerender p {
    max-width: 38rem;
    margin: 1.25rem 0 0;
    color: rgba(236, 233, 245, 0.72);
    line-height: 1.65;
  }

  .course-prerender a {
    width: fit-content;
    min-height: 44px;
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    color: #fff;
    font-weight: 700;
    text-decoration: none;
  }
</style>
