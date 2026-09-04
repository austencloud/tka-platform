<script lang="ts">
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import type { LearningLetterTeachingContent } from "./learning-letter-teaching-content";

  let {
    sequence,
    content,
  }: {
    sequence: SequenceData;
    content: LearningLetterTeachingContent | null;
  } = $props();
</script>

<div class="learning-word-stage">
  <div class="media-grid">
    <section class="media-pane video-pane" aria-label="Performance video">
      <header class="pane-heading">
        <i class="fa-solid fa-video" aria-hidden="true"></i>
        <span>Performance video</span>
      </header>
      <div class="pane-body video-body">
        {#if content?.video}
          <video
            src={content.video.src}
            poster={content.video.poster}
            autoplay
            loop
            muted
            playsinline
            preload="metadata"
            aria-label={`Performance video for ${sequence.word}`}
          >
            {#if content.video.captionsSrc}
              <track
                kind="captions"
                src={content.video.captionsSrc}
                srclang="en"
                label="English"
                default
              />
            {/if}
          </video>
        {:else}
          <div class="empty-state" role="status">
            <span class="empty-icon" aria-hidden="true">
              <i class="fa-solid fa-circle-play"></i>
            </span>
            <span>Video coming soon</span>
          </div>
        {/if}
      </div>
    </section>

    <section class="media-pane animation-pane" aria-label="Animation">
      <header class="pane-heading">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <span>Animation</span>
      </header>
      <div class="pane-body animation-body">
        <InlineAnimationPlayer
          {sequence}
          autoPlay
          chrome="minimal"
          fill
          showWordHeader={false}
          showPositionGlyph
          scrubbable
          beatIndicators={false}
          hideTkaGlyph
          leftPropType="staff"
          rightPropType="staff"
          disableContextMenu
          hoverHint="badge"
        />
      </div>
    </section>

    <section class="media-pane card-pane" aria-label="Choreo card">
      <header class="pane-heading">
        <i class="fa-regular fa-rectangle-list" aria-hidden="true"></i>
        <span>Choreo card</span>
      </header>
      <div class="pane-body card-body">
        <ChoreoCard
          {sequence}
          showWord={false}
          showStepNumbers
          showDifficultyLevel={false}
          includeStartPosition
          showNotes={false}
          showLoopGlyph={false}
          showQRCode={false}
          darkMode
          forceContain
          leftPropType={PropType.STAFF}
          rightPropType={PropType.STAFF}
        />
      </div>
    </section>
  </div>

  <section class="guide-notes" aria-labelledby="guide-notes-title">
    <header>
      <i class="fa-solid fa-book-open" aria-hidden="true"></i>
      <h2 id="guide-notes-title">Guide notes</h2>
    </header>
    {#if content?.explanation}
      <div class="explanation-copy">
        {#each content.explanation.paragraphs as paragraph}
          <p>{paragraph}</p>
        {/each}
      </div>
    {:else}
      <p class="empty-copy">Explanation coming soon</p>
    {/if}
  </section>
</div>

<style>
  .learning-word-stage {
    display: grid;
    gap: clamp(0.65rem, 0.9cqw, 1rem);
    min-width: 0;
  }

  .media-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-stroke);
  }

  .media-pane {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: clamp(24rem, 48dvh, 38rem);
    background: color-mix(in srgb, var(--theme-panel-bg) 86%, transparent);
  }

  .pane-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke);
    background: color-mix(in srgb, var(--theme-card-bg) 88%, transparent);
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .pane-heading i {
    color: var(--theme-accent);
  }

  .pane-body {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .video-body {
    display: grid;
    place-items: center;
    padding: clamp(0.65rem, 1cqw, 1rem);
  }

  .video-body video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--radius-md, 0.5rem);
    background: #000;
  }

  .animation-body {
    background: color-mix(in srgb, var(--theme-card-bg) 72%, transparent);
  }

  .card-body {
    padding: clamp(0.45rem, 0.75cqw, 0.85rem);
    background: color-mix(in srgb, var(--theme-panel-bg) 92%, transparent);
  }

  .empty-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.75rem;
    width: min(100%, 28rem);
    aspect-ratio: 16 / 9;
    padding: 1.25rem;
    border: 1px dashed var(--theme-stroke-strong, var(--theme-stroke));
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(in srgb, var(--theme-card-bg) 58%, transparent);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
    color: var(--theme-accent);
    font-size: 1.2rem;
  }

  .guide-notes {
    display: grid;
    grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    min-height: 6.5rem;
    padding: clamp(0.8rem, 1.1cqw, 1.1rem);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(in srgb, var(--theme-panel-bg) 78%, transparent);
  }

  .guide-notes header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--theme-text);
  }

  .guide-notes header i {
    color: var(--theme-accent);
  }

  .guide-notes h2,
  .guide-notes p {
    margin: 0;
  }

  .guide-notes h2 {
    font-size: var(--font-size-base, 1rem);
  }

  .empty-copy,
  .explanation-copy {
    color: var(--theme-text-dim);
    line-height: 1.55;
  }

  .explanation-copy {
    display: grid;
    gap: 0.5rem;
  }

  @media (max-width: 900px) and (min-height: 621px) {
    .media-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .card-pane {
      grid-column: 1 / -1;
      min-height: 32rem;
    }
  }

  @media (max-width: 760px) {
    .media-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .media-pane {
      min-height: 22rem;
    }

    .video-pane {
      min-height: 15rem;
    }

    .card-pane {
      grid-column: auto;
      min-height: 31rem;
    }

    .guide-notes {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.55rem;
    }
  }

  @media (max-height: 620px) and (min-width: 761px) {
    .media-pane {
      min-height: 18rem;
    }

    .guide-notes {
      min-height: 5rem;
    }
  }
</style>
