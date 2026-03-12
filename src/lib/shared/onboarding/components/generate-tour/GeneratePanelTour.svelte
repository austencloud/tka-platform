<!--
  GeneratePanelTour - Modal wizard that walks through generator settings.

  Purpose-built mini card grid that visually matches the real cards
  (same gradients, same layout) but is pure CSS — no container queries,
  no services, no responsive complexity. Works at any size.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";
  import {
    generateTourState,
    type GenerateTourStop,
  } from "../../state/generate-tour-state.svelte";
  import {
    generatorHelpContent,
    type GeneratorHelpItem,
  } from "$lib/features/create/generate/domain/generator-help-content";
  import type { GeneratorHelpId } from "$lib/features/create/generate/domain/generator-help-content";

  // Mini card definition — matches real card grid visuals
  interface MiniCard {
    id: GenerateTourStop;
    header: string;
    value: string;
    gradient: string;
    span: number;
  }

  const MINI_CARDS: MiniCard[] = [
    {
      id: "word-input",
      header: "WORD",
      value: "A - Z",
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
      span: 4,
    },
    {
      id: "length",
      header: "LENGTH",
      value: "16",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
      span: 2,
    },
    {
      id: "level",
      header: "LEVEL",
      value: "2",
      gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
      span: 2,
    },
    {
      id: "grid-mode",
      header: "GRID",
      value: "Diamond",
      gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)",
      span: 2,
    },
    {
      id: "turn-intensity",
      header: "TURNS",
      value: "≤1",
      gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
      span: 2,
    },
    {
      id: "customize",
      header: "CUSTOMIZE",
      value: "Default",
      gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
      span: 2,
    },
    {
      id: "loop",
      header: "LOOP",
      value: "Rotated",
      gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)",
      span: 2,
    },
    {
      id: "slice-size",
      header: "SLICE",
      value: "Quartered",
      gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)",
      span: 2,
    },
    {
      id: "generate-button",
      header: "",
      value: "Generate",
      gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
      span: 6,
    },
  ];

  const stopToHelpId: Record<GenerateTourStop, GeneratorHelpId> = {
    "word-input": "generation-mode",
    "length": "length",
    "level": "level",
    "grid-mode": "grid-mode",
    "turn-intensity": "turn-intensity",
    "customize": "prop-continuity",
    "loop": "loop-type",
    "slice-size": "slice-size",
    "generate-button": "generate",
  };

  const tourOverrides: Partial<Record<GenerateTourStop, Partial<GeneratorHelpItem>>> = {
    "word-input": {
      name: "Spell a Word",
      fullDesc: "Type a word and the generator turns each letter into a move. Leave it blank for a random sequence.",
      bullets: undefined,
      images: undefined,
    },
    "customize": {
      name: "Customize",
      fullDesc: "Tweak how your sequence feels. Prop continuity, rhythm templates, and start/end positions all live here.",
      bullets: undefined,
      images: undefined,
    },
    "loop": {
      name: "LOOP",
      fullDesc: "A LOOP sequence ends where it started, so you can repeat it forever. There are 6 types: Rotated, Mirrored, Swapped, Inverted, and combinations of those.",
      bullets: undefined,
      images: undefined,
    },
  };

  const currentContent = $derived.by((): GeneratorHelpItem | undefined => {
    const stop = generateTourState.currentStop;
    const helpId = stopToHelpId[stop];
    const base = generatorHelpContent.find((c) => c.id === helpId);
    if (!base) return undefined;

    const override = tourOverrides[stop];
    if (!override) return base;

    return { ...base, ...override } as GeneratorHelpItem;
  });

  let isOpen = $derived(generateTourState.isActive);

  function handleNext() {
    generateTourState.advance();
  }

  function handleSkip() {
    generateTourState.skip();
  }

  function handleClose() {
    generateTourState.skip();
  }
</script>

<BaseModal
  open={isOpen}
  onclose={handleClose}
  size="fit"
  class="tour-modal"
  animation="pop"
  labelledBy="tour-modal-title"
>
  {#if currentContent}
    <!-- Mini card grid -->
    <div class="card-grid" role="img" aria-label="Generator cards — {currentContent.name} highlighted">
      {#each MINI_CARDS as card}
        <div
          class="mini-card"
          class:active={card.id === generateTourState.currentStop}
          class:dim={card.id !== generateTourState.currentStop}
          class:generate-btn={card.id === "generate-button"}
          style:grid-column="span {card.span}"
          style:background={card.gradient}
        >
          {#if card.header}
            <span class="card-header">{card.header}</span>
          {/if}
          <span class="card-value" class:generate-value={card.id === "generate-button"}>{card.value}</span>
        </div>
      {/each}
    </div>

    <!-- Info section -->
    <div class="tour-info">
      <div class="info-header">
        <div class="info-icon" style:background={currentContent.color}>
          <i class="fas {currentContent.icon}" aria-hidden="true"></i>
        </div>
        <div class="info-titles">
          <h2 id="tour-modal-title" class="info-title">{currentContent.name}</h2>
          <p class="info-subtitle">{currentContent.shortDesc}</p>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Close tour">
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>

      <div class="info-body">
        <p class="description">{currentContent.fullDesc}</p>

        {#if currentContent.images && currentContent.images.length > 0}
          <div class="image-grid">
            {#each currentContent.images as image}
              <figure class="image-item">
                <img src={image.src} alt={image.label} />
                <figcaption>{image.label}</figcaption>
              </figure>
            {/each}
          </div>
        {/if}

        {#if currentContent.bullets && currentContent.bullets.length > 0}
          <ul class="bullet-list">
            {#each currentContent.bullets as bullet}
              <li>{bullet}</li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <ModalFooter align="between">
      <div class="tour-dots" aria-label="Step {generateTourState.currentStopIndex + 1} of {generateTourState.totalStops}">
        {#each Array(generateTourState.totalStops) as _, i}
          <div
            class="dot"
            class:active={i === generateTourState.currentStopIndex}
            class:completed={i < generateTourState.currentStopIndex}
          ></div>
        {/each}
      </div>
      <div class="tour-actions">
        <button class="ghost" onclick={handleSkip}>Skip</button>
        <button class="primary" onclick={handleNext}>
          {generateTourState.isLastStop ? "Got it" : "Next"}
          {#if !generateTourState.isLastStop}
            <i class="fas fa-arrow-right" aria-hidden="true" style="font-size: 0.75rem; margin-left: 4px;"></i>
          {/if}
        </button>
      </div>
    </ModalFooter>
  {/snippet}
</BaseModal>

<style>
  /* Modal: content-driven height, reasonable width */
  :global(dialog.tour-modal) {
    width: min(92vw, 560px) !important;
    max-height: 90vh !important;
  }

  /* ===== Mini Card Grid ===== */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 5px;
    padding: 14px 16px;
    background: rgba(0, 0, 0, 0.25);
  }

  .mini-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 8px 6px;
    border-radius: 10px;
    transition: opacity 0.25s ease, box-shadow 0.25s ease;
    position: relative;
    min-height: 48px;
  }

  .mini-card.generate-btn {
    min-height: 40px;
  }

  .card-header {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1;
  }

  .card-value {
    font-size: 16px;
    font-weight: 700;
    color: white;
    line-height: 1.2;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .generate-value {
    font-size: 14px;
  }

  /* Active card: glow border */
  .mini-card.active {
    box-shadow:
      0 0 0 2px rgba(59, 130, 246, 0.7),
      0 0 14px rgba(59, 130, 246, 0.35);
    z-index: 1;
  }

  .mini-card.dim {
    opacity: 0.3;
  }

  /* ===== Info Section ===== */
  /* Fixed height so the modal doesn't shift between stops */
  .tour-info {
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 320px;
    min-height: 320px;
  }

  .info-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .info-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: white;
    flex-shrink: 0;
  }

  .info-titles {
    flex: 1;
    min-width: 0;
  }

  .info-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--theme-text, white);
    line-height: 1.2;
  }

  .info-subtitle {
    margin: 2px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text, white);
  }

  .info-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .image-item {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .image-item img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .image-item figcaption {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    line-height: 1.3;
  }

  .bullet-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bullet-list li {
    position: relative;
    padding-left: 16px;
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.85));
  }

  .bullet-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--theme-accent, #3b82f6);
  }

  /* ===== Footer ===== */
  .tour-dots {
    display: flex;
    gap: 5px;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: var(--semantic-info, #3b82f6);
    transform: scale(1.25);
  }

  .dot.completed {
    background: rgba(255, 255, 255, 0.4);
  }

  .tour-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* ===== Mobile ===== */
  @media (max-width: 520px) {
    :global(dialog.tour-modal) {
      width: calc(100% - 24px) !important;
    }

    .card-grid {
      gap: 4px;
      padding: 10px 12px;
    }

    .mini-card {
      padding: 6px 4px;
      min-height: 40px;
    }

    .card-value {
      font-size: 13px;
    }

    .card-header {
      font-size: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot, .mini-card, .close-btn {
      transition: none;
    }
  }
</style>
