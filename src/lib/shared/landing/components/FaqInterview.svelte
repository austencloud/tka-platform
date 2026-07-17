<script lang="ts">
  /**
   * Open dialogue layout for the public-site FAQ — the no-accordion answer to
   * "expandable bubbles feel like a tack-on widget." The questions are written
   * in first-person spinner voice (see faq-items.ts), so the layout renders
   * them as what they are: spoken lines, set large in the landing serif, with
   * the answer open underneath. Nothing collapses; the live proofs are visible
   * while scrolling instead of hidden behind a toggle.
   *
   * Same canonical FAQ_ITEMS and JSON-LD emitter as the retired FaqAccordion,
   * so visible content and structured data still cannot drift.
   *
   * THE COLUMN RULE (editorial tier, ≥900 — the signature): every cell has a
   * stated job, so no space reads as unexplained.
   *   - Voice column (left): the question, and beneath it THE THING ITSELF —
   *     the pictograph, like the subject's photo in a magazine interview.
   *     This is what fills the column instead of a void.
   *   - Answer column (right): explanation → interaction (the read-test quiz)
   *     → door. The CTA always terminates the reading flow, aligned with the
   *     text the reader just finished — never floating under a question.
   *
   * Stacked tiers (phone, tablet, `mode="stack"`) re-order the same DOM via
   * display:contents + order into: question → answer → figure → quiz → door,
   * so the pictograph sits directly above the quiz that asks about it, and
   * the door closes the exchange (full-width thumb target on phones).
   *
   * 4K (≥2200) scales the stage with intent: wider container, larger serif,
   * longer measure, bigger frames and targets.
   *
   * Demo components stay OUT of the initial bundle: they dynamic-import when
   * the section scrolls near (IntersectionObserver, 400px margin), same
   * discipline as LazyHowTkaWorksSection. Slots reserve each piece's height
   * so the mount never reflows the page (no-layout-shift).
   *
   * `dense` is for embedding inside an already-editorial page (/about):
   * tighter rhythm, page-scale heading.
   */
  import type { Component } from "svelte";
  import { FAQ_ITEMS, faqPageJsonLd, type FaqItem } from "../faq/faq-items";

  let {
    items = FAQ_ITEMS,
    heading = "Questions spinners actually ask",
    emitSchema = false,
    mode = "editorial",
    dense = false,
    sectionId = "faq",
  }: {
    items?: FaqItem[];
    heading?: string;
    emitSchema?: boolean;
    mode?: "editorial" | "stack";
    dense?: boolean;
    sectionId?: string;
  } = $props();

  const schema = $derived(emitSchema ? faqPageJsonLd(items) : null);

  let sectionEl = $state<HTMLElement>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pictographDemo = $state<Component<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let readTest = $state<Component<any> | null>(null);

  $effect(() => {
    if (!sectionEl || !items.some((i) => i.demo)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (items.some((i) => i.demo === "pictograph")) {
          import("./FaqPictographDemo.svelte").then((m) => (pictographDemo = m.default));
        }
        if (items.some((i) => i.demo === "read-test")) {
          import("./FaqReadTest.svelte").then((m) => (readTest = m.default));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<svelte:head>
  {#if schema}
    {@html `<script type="application/ld+json">${schema}</script>`}
  {/if}
</svelte:head>

<section
  bind:this={sectionEl}
  class="faq mode-{mode}"
  class:dense
  id={sectionId}
  aria-labelledby="{sectionId}-heading"
>
  <div class="container">
    <h2 id="{sectionId}-heading">{heading}</h2>
    <div class="qa-list">
      {#each items as faq}
        <article class="qa">
          <div class="col-voice">
            <h3 class="question">{faq.question}</h3>
            {#if faq.demo === "pictograph"}
              <div class="figure-slot figure-demo">
                {#if pictographDemo}
                  {@const Demo = pictographDemo}
                  <Demo />
                {/if}
              </div>
            {:else if faq.demo === "read-test"}
              <div class="figure-slot figure-test">
                {#if readTest}
                  {@const Figure = readTest}
                  <Figure part="figure" />
                {/if}
              </div>
            {/if}
          </div>
          <div class="col-answer">
            <p class="answer">{faq.answer}</p>
            {#if faq.demo === "read-test"}
              <div class="quiz-slot">
                {#if readTest}
                  {@const Quiz = readTest}
                  <Quiz part="quiz" />
                {/if}
              </div>
            {/if}
            {#if faq.cta}
              <a class="faq-cta" href={faq.cta.href}>
                {faq.cta.label}
                <i class="fas fa-arrow-right" aria-hidden="true"></i>
              </a>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .faq {
    padding: clamp(64px, 10vw, 120px) 24px;
  }
  .faq.dense {
    padding: 3rem 0 0;
  }

  .container {
    max-width: 1080px;
    margin: 0 auto;
  }
  .mode-stack .container {
    max-width: 720px;
  }

  h2 {
    margin: 0 0 clamp(2rem, 4.5vw, 3.5rem);
    text-align: center;
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(1.9rem, 4.5vw, 3rem);
    font-weight: 500;
    line-height: 1.2;
    color: #ffffff;
  }
  .dense h2 {
    font-size: clamp(1.5rem, 3vw, 1.9rem);
    margin-bottom: 2rem;
  }

  .qa-list {
    margin: 0;
  }

  /* ── Stacked flow (phone base; also tablet + stack mode) ──────────────────
     Columns dissolve (display: contents) and the leaves re-order so the
     figure sits directly above the quiz that asks about it, and the door
     closes the exchange: question → answer → figure → quiz → door. */
  .qa {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding-block: clamp(26px, 4vw, 42px);
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }
  .qa:first-of-type {
    border-top: none;
    padding-top: 0;
  }
  .qa:last-of-type {
    padding-bottom: 0;
  }
  .col-voice,
  .col-answer {
    display: contents;
  }
  .question {
    order: 1;
  }
  .answer {
    order: 2;
  }
  .figure-slot {
    order: 3;
    align-self: center;
  }
  .quiz-slot {
    order: 4;
  }
  .faq-cta {
    order: 5;
  }

  /* The visitor's voice: the landing serif, italic, set large. This is the
     element that makes the section pop — everything else stays quiet. */
  .question {
    margin: 0;
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-style: italic;
    font-weight: 500;
    font-size: clamp(1.2rem, 2.3vw, 1.6rem);
    line-height: 1.3;
    color: #ffffff;
    text-wrap: balance;
  }

  .answer {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: 0.98rem;
    line-height: 1.65;
    max-width: 62ch;
  }

  /* Reserved to each piece's mounted height so the async import + prepare
     never reflows the page. Values track the frames in the demo components. */
  .figure-demo {
    /* 180px frame + gap + caption */
    min-height: 208px;
  }
  .figure-test {
    /* bare 180px frame */
    min-height: 180px;
  }
  .quiz-slot {
    /* prompt + options + reserved feedback (measured) */
    min-height: 154px;
    width: 100%;
  }

  /* The door: a button, not a text link (clickables look like buttons). */
  .faq-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 20px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong, #818cf8) 45%, transparent);
    color: #ffffff;
    font-size: 0.92rem;
    font-weight: 600;
    text-decoration: none;
    transition:
      background var(--duration-normal, 0.2s) ease,
      border-color var(--duration-normal, 0.2s) ease;
  }
  .faq-cta:hover {
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 75%, transparent);
  }
  .faq-cta i {
    font-size: 0.8em;
  }

  /* ── Phone tier (≤600): designed for the small screen, not shrunk to it ── */
  @media (max-width: 600px) {
    .faq:not(.dense) {
      padding: 56px 20px;
    }
    /* Full-width door: on a phone the CTA is a thumb target, not a text-flow
       element. It closes each exchange edge to edge, app-style. */
    .faq-cta {
      align-self: stretch;
    }
    .figure-demo {
      /* 200px frame + gap + caption */
      min-height: 228px;
    }
    .figure-test {
      min-height: 200px;
    }
    .quiz-slot {
      min-height: 190px;
    }
  }
  @media (max-width: 400px) {
    /* iPhone SE class: tighten the frame, keep the serif voice. */
    .faq:not(.dense) {
      padding: 48px 18px;
    }
    .question {
      font-size: 1.15rem;
    }
  }

  /* ── Desktop editorial tier (≥900): the interview grid signature ─────────
     Voice column: question + the pictograph (the thing itself). Answer
     column: explanation + quiz + door. Every cell has a job; no stage rows,
     no floating buttons. */
  @media (min-width: 900px) {
    .mode-editorial .qa {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      column-gap: clamp(40px, 5vw, 72px);
      align-items: start;
    }
    .mode-editorial .col-voice {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 22px;
      grid-column: 1;
    }
    .mode-editorial .col-answer {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 18px;
      grid-column: 2;
    }
    /* Figures sit on the text grid, aligned with the question's left edge. */
    .mode-editorial .figure-slot {
      align-self: flex-start;
    }
    /* Optically align the first answer line with the serif cap height. */
    .mode-editorial .answer {
      margin-top: 0.35em;
    }
  }

  /* ── 4K / ultrawide tier (≥2200): scaled with intent ───────────────────── */
  @media (min-width: 2200px) {
    .mode-editorial .container {
      max-width: 1600px;
    }
    h2 {
      font-size: 3.4rem;
      margin-bottom: 4.5rem;
    }
    .qa {
      padding-block: 56px;
    }
    .mode-editorial .qa {
      column-gap: 96px;
    }
    .question {
      font-size: 2.05rem;
    }
    .answer {
      font-size: 1.12rem;
      max-width: 68ch;
    }
    .faq-cta {
      min-height: 52px;
      padding: 0 26px;
      font-size: 1.02rem;
      border-radius: 12px;
    }
    /* Frames scale to 230px at this tier (see the demo components). */
    .figure-demo {
      min-height: 262px;
    }
    .figure-test {
      min-height: 230px;
    }
    .quiz-slot {
      min-height: 192px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .faq-cta {
      transition: none;
    }
  }
</style>
