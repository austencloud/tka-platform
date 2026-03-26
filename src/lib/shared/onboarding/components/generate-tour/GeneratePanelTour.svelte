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
  import { CARD_REGISTRY, type GeneratorCardId } from "$lib/features/create/generate/shared/domain/card-registry";
  import { getCardColors } from "$lib/features/create/generate/shared/domain/card-colors";
  import { BackgroundType } from "@austencloud/backgrounds";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  // Mini card definition — derived from the card registry
  interface MiniCard {
    id: GeneratorCardId;
    header: string;
    value: string;
    gradient: string;
    span: number;
  }

  // Derive mini cards from the shared registry so they stay in sync
  // with the real generator panel automatically.
  const defaultColors = getCardColors(BackgroundType.NIGHT_SKY);
  const MINI_CARDS: MiniCard[] = CARD_REGISTRY.map((entry) => ({
    id: entry.id,
    header: entry.tourHeader,
    value: entry.tourDefaultValue,
    gradient: (defaultColors as unknown as Record<string, { color: string }>)[entry.colorKey]?.color ?? "",
    span: entry.tourSpan,
  }));

  // Help ID mapping also derived from registry
  const stopToHelpId = Object.fromEntries(
    CARD_REGISTRY.map((entry) => [entry.id, entry.helpId])
  ) as Record<string, string>;

  const tourOverrides: Partial<Record<string, Partial<GeneratorHelpItem>>> = {
    "word-input": {
      name: "Spell a Word",
      shortDesc: "Type a word or go random",
      fullDesc: "Type a word and the generator turns each letter into a move. Leave it blank for a random sequence.",
      bullets: undefined,
      images: undefined,
    },
    "customize": {
      name: "Customize",
      shortDesc: "Fine-tune your sequence",
      fullDesc: "Tweak how your sequence feels. Prop continuity, rhythm templates, and start/end positions all live here.",
      bullets: undefined,
      images: undefined,
    },
    "loop": {
      name: "LOOP",
      fullDesc: "A LOOP sequence ends where it started, so you can repeat it forever. Four base types -- Rotated, Mirrored, Swapped, and Inverted -- can be combined for even more variety.",
      bullets: undefined,
      images: undefined,
    },
  };

  let hapticService: IHapticFeedback | null = null;
  try {
    hapticService = container.items.hapticFeedback;
  } catch {
    // Optional service
  }

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
    hapticService?.trigger("selection");
    generateTourState.advance();
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    generateTourState.skip();
  }

  function handleClose() {
    hapticService?.trigger("selection");
    generateTourState.skip();
  }

  function handleCardTap(stop: GenerateTourStop) {
    hapticService?.trigger("selection");
    generateTourState.goToStop(stop);
  }
</script>

<BaseModal
  open={isOpen}
  onclose={handleClose}
  size="md"
  class="tour-modal"
  animation="pop"
  labelledBy="tour-modal-title"
>
  {#if currentContent}
    <!-- Mini card grid -->
    <div class="card-grid" role="img" aria-label="Generator cards — {currentContent.name} highlighted">
      {#each MINI_CARDS as card}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="mini-card"
          class:active={card.id === generateTourState.currentStop}
          class:dim={card.id !== generateTourState.currentStop}
          class:generate-btn={card.id === "generate-button"}
          style:grid-column="span {card.span}"
          style:background={card.gradient}
          onclick={() => handleCardTap(card.id)}
          role="button"
          tabindex="0"
          aria-label="View {card.header || card.value} help"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardTap(card.id); } }}
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
  /*
   * Dialog sizing: viewport-proportional, never overflows.
   * Uses size="md" from BaseModal which gives us flex column layout
   * with modal-body { flex: 1 }. We override width/height here.
   *
   * Layout stack (all flex):
   *   dialog  →  modal-content-wrapper  →  modal-body
   *     ├─ card-grid      (flex-shrink: 0 — always fully visible)
   *     ├─ tour-info       (flex: 1 — fills remaining space)
   *     │   ├─ info-header (flex-shrink: 0)
   *     │   └─ info-body   (flex: 1, overflow-y: auto — scrolls if needed)
   *     └─ footer          (flex-shrink: 0 — always visible, handled by BaseModal)
   */
  :global(dialog.tour-modal) {
    width: min(92vw, 560px) !important;
    height: min(75vh, 580px) !important;
    max-height: 75vh !important;
  }

  /* ===== Mini Card Grid ===== */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 5px;
    padding: 14px 16px;
    background: rgba(0, 0, 0, 0.25);
    flex-shrink: 0;
  }

  .mini-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 6px;
    border-radius: 10px;
    transition: opacity 0.25s ease, box-shadow 0.25s ease;
    position: relative;
    min-height: 65px;
    cursor: pointer;
  }

  .mini-card.generate-btn {
    min-height: 65px;
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
  /* Takes all remaining space between card grid and footer */
  .tour-info {
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  .info-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
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

  /* Scrollable content area — only this part scrolls */
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
      height: min(85vh, 600px) !important;
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
