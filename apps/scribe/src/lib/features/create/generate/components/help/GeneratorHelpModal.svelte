<!--
  GeneratorHelpModal.svelte

  Modal for learning about a specific generator control.
  Shows icon, name, description, bullet points, and tips.

  Now built on the unified BaseModal system (2026 architecture).
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";
  import {
    generatorHelpContent,
    type GeneratorHelpId,
  } from "../../domain/generator-help-content";

  interface Props {
    controlId: GeneratorHelpId;
    onClose: () => void;
  }

  let { controlId, onClose }: Props = $props();

  // Control open state (BaseModal requires a bindable)
  let isOpen = $state(true);

  // Get control content
  const control = $derived(
    generatorHelpContent.find((c) => c.id === controlId) ?? generatorHelpContent[0]
  );

  // Handle close from any source
  function handleClose() {
    isOpen = false;
    // Small delay to allow exit animation
    setTimeout(onClose, 250);
  }
</script>

<BaseModal
  bind:open={isOpen}
  onclose={handleClose}
  size="md"
  animation="pop"
  labelledBy="help-modal-title"
>
  {#snippet header()}
    <ModalHeader
      title={control?.name ?? "Control"}
      subtitle={control?.shortDesc}
      icon={control?.icon ?? "fa-question"}
      iconColor={control?.color ?? "#3b82f6"}
      onClose={handleClose}
      id="help-modal-title"
    />
  {/snippet}

  <!-- Content -->
  <div class="help-content" style:--control-color={control?.color ?? "#3b82f6"}>
    <!-- Description -->
    <p class="description" data-animate="2">{control?.fullDesc ?? ""}</p>

    <!-- Images grid -->
    {#if control?.images && control.images.length > 0}
      <div class="image-grid" data-animate="3">
        {#each control.images as image}
          <figure class="image-item">
            <img src={image.src} alt={image.label} />
            <figcaption>{image.label}</figcaption>
          </figure>
        {/each}
      </div>
    {/if}

    <!-- Bullet points -->
    {#if control?.bullets && control.bullets.length > 0}
      <ul class="bullet-list">
        {#each control.bullets as bullet, i}
          <li data-animate={3 + i}>{bullet}</li>
        {/each}
      </ul>
    {/if}

    <!-- Tip -->
    {#if control?.tip}
      <div class="tip-box" data-animate="6">
        <i class="fas fa-lightbulb tip-icon" aria-hidden="true"></i>
        <span>{control.tip}</span>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <ModalFooter>
      <button class="secondary" onclick={handleClose}>
        Got it
      </button>
    </ModalFooter>
  {/snippet}
</BaseModal>

<style>
  .help-content {
    padding: var(--modal-padding, 24px);
    display: flex;
    flex-direction: column;
    gap: var(--modal-gap, 18px);
  }

  .description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  /* Image grid */
  .image-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .image-item {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
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

  /* Bullet list */
  .bullet-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bullet-list li {
    position: relative;
    padding-left: 20px;
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.85));
  }

  .bullet-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--control-color, #3b82f6);
  }

  /* Tip box */
  .tip-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .tip-icon {
    flex-shrink: 0;
    color: #4ade80;
    margin-top: 2px;
    animation: lightbulbGlow 2s ease-in-out 1s infinite;
  }

  @keyframes lightbulbGlow {
    0%, 100% {
      filter: drop-shadow(0 0 2px rgba(74, 222, 128, 0.3));
    }
    50% {
      filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.6));
    }
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .help-content {
      padding: var(--modal-padding-mobile, 20px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tip-icon {
      animation: none;
      filter: none;
    }
  }
</style>
