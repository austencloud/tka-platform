<script lang="ts">
  /**
   * EmptyMessages
   *
   * Illustrated empty state for message thread
   * Supports both direct and group conversations
   */

  interface Props {
    recipientName?: string;
    isGroup?: boolean;
  }

  let { recipientName = "this user", isGroup = false }: Props = $props();

  const heading = $derived(
    isGroup ? "Start the group chat" : "Start the conversation"
  );
  const description = $derived(
    isGroup
      ? `Be the first to message ${recipientName || "this group"}`
      : `Send a message to ${recipientName}`
  );
</script>

<div class="empty-state" role="status" aria-label="No messages in conversation">
  <div class="illustration">
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Paper airplane -->
      <g class="plane">
        <path d="M30 60L90 30L70 90L55 65L30 60Z" class="plane-body" />
        <path d="M55 65L90 30" class="plane-line" />
        <path d="M55 65L70 90" class="plane-line" />
      </g>

      <!-- Trail dots -->
      <circle cx="20" cy="62" r="2" class="trail trail-1" />
      <circle cx="12" cy="64" r="1.5" class="trail trail-2" />
      <circle cx="6" cy="66" r="1" class="trail trail-3" />
    </svg>
  </div>
  <h3>{heading}</h3>
  <p>{description}</p>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    min-height: 200px;
    padding: 48px 24px;
    text-align: center;
  }

  .illustration {
    width: 120px;
    height: 120px;
  }

  .illustration svg {
    width: 100%;
    height: 100%;
  }

  .plane {
    animation: fly 2s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes fly {
    0%,
    100% {
      transform: translate(0, 0) rotate(0deg);
    }
    50% {
      transform: translate(5px, -5px) rotate(-3deg);
    }
  }

  .plane-body {
    fill: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 30%,
      transparent
    );
    stroke: var(--theme-accent, var(--semantic-info));
    stroke-width: 2;
  }

  .plane-line {
    stroke: var(--theme-accent, var(--semantic-info));
    stroke-width: 1.5;
    stroke-opacity: 0.5;
  }

  .trail {
    fill: var(--theme-accent, var(--semantic-info));
    opacity: 0.3;
  }

  .trail-1 {
    animation: fade 2s ease-in-out infinite;
  }

  .trail-2 {
    animation: fade 2s ease-in-out infinite var(--duration-normal);
  }

  .trail-3 {
    animation: fade 2s ease-in-out infinite var(--duration-dramatic);
  }

  @keyframes fade {
    0%,
    100% {
      opacity: 0.1;
    }
    50% {
      opacity: 0.5;
    }
  }

  h3 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  @media (prefers-reduced-motion: reduce) {
    .plane,
    .trail {
      animation: none !important;
    }
  }
</style>
