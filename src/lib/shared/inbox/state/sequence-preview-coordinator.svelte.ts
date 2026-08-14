export interface SequencePreviewCoordinatorDeps {
  isMessageAvailable: (messageId: string) => boolean;
}

/**
 * Owns the one live animation slot inside a message thread.
 *
 * Every sequence begins as a Choreo Card. Clicking its play button moves the
 * slot to that message, returning the previous animation to its card.
 */
export function createSequencePreviewCoordinator(
  deps: SequencePreviewCoordinatorDeps
) {
  let selectedMessageId = $state<string | null>(null);

  function available(messageId: string | null): string | null {
    return messageId && deps.isMessageAvailable(messageId) ? messageId : null;
  }

  function activeMessageId(): string | null {
    return available(selectedMessageId);
  }

  return {
    get activeMessageId(): string | null {
      return activeMessageId();
    },

    requestPlayback(messageId: string): void {
      if (!deps.isMessageAvailable(messageId)) return;
      selectedMessageId = messageId;
    },

    isPlaybackActive(messageId: string): boolean {
      return activeMessageId() === messageId;
    },

    isPlayerMounted(messageId: string): boolean {
      return activeMessageId() === messageId;
    },

    reset(): void {
      selectedMessageId = null;
    },
  };
}

export type SequencePreviewCoordinator = ReturnType<
  typeof createSequencePreviewCoordinator
>;
