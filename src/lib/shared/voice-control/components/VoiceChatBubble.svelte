<!--
  VoiceChatBubble

  Compact response bubble shown near the VoiceControlIndicator when
  TIKA answers a spoken question (Tier 3). Fades in, stays while TTS
  plays, then auto-dismisses after a delay.

  Deliberately minimal — full conversations should use the TIKA chat module.
-->
<script lang="ts">
  import { voiceControlState } from "../state/voice-control-state.svelte";

  const state = voiceControlState;

  const isVisible = $derived(state.chatBubble !== null);
  const bubbleText = $derived(state.chatBubble?.text ?? "");
  const isSpeaking = $derived(state.chatBubble?.speaking ?? false);
</script>

{#if isVisible}
  <div
    class="voice-chat-bubble"
    class:speaking={isSpeaking}
    role="status"
    aria-live="polite"
  >
    <div class="bubble-content">
      <div class="bubble-icon">
        <i class="fas" class:fa-volume-high={isSpeaking} class:fa-comment={!isSpeaking}></i>
      </div>
      <p class="bubble-text">{bubbleText}</p>
      <button
        class="bubble-dismiss"
        onclick={() => state.dismissChatBubble()}
        aria-label="Dismiss"
      >
        <i class="fas fa-xmark"></i>
      </button>
    </div>
  </div>
{/if}

<style>
  .voice-chat-bubble {
    position: fixed;
    bottom: 80px;
    left: 24px;
    z-index: 2001;
    max-width: 320px;
    animation: bubble-enter 0.3s ease-out;
  }

  @media (max-width: 768px) {
    .voice-chat-bubble {
      bottom: 136px;
      left: 16px;
      max-width: calc(100vw - 32px);
    }
  }

  /* Hide on desktop — same as the indicator */
  @media (min-width: 769px) {
    .voice-chat-bubble {
      display: none;
    }
  }

  .bubble-content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    pointer-events: auto;
  }

  .speaking .bubble-content {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .bubble-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    background: var(--theme-accent, rgba(59, 130, 246, 0.15));
    color: var(--theme-text, #60a5fa);
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.8;
  }

  .bubble-text {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.5;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    word-break: break-word;
  }

  .bubble-dismiss {
    width: 48px;
    height: 48px;
    margin: -12px -14px -12px 0;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .bubble-dismiss:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
  }

  @keyframes bubble-enter {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .voice-chat-bubble {
      animation: none;
    }

    .bubble-dismiss {
      transition: none;
    }
  }
</style>
