export const ALT_HINT_HOLD_DELAY_MS = 300;

interface AltHoldIntentOptions {
  onVisibilityChange: (visible: boolean) => void;
  delay?: number;
}

export function createAltHoldIntent({
  onVisibilityChange,
  delay = ALT_HINT_HOLD_DELAY_MS,
}: AltHoldIntentOptions) {
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  function setVisible(nextVisible: boolean): void {
    if (visible === nextVisible) return;
    visible = nextVisible;
    onVisibilityChange(visible);
  }

  function cancelPendingReveal(): void {
    if (revealTimer === null) return;
    clearTimeout(revealTimer);
    revealTimer = null;
  }

  return {
    press(): void {
      cancelPendingReveal();
      setVisible(false);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        setVisible(true);
      }, delay);
    },

    useChord(): void {
      // A practiced chord should stay invisible. Once the guide is already
      // visible, it remains available for another command until Alt is released.
      if (!visible) cancelPendingReveal();
    },

    release(): void {
      cancelPendingReveal();
      setVisible(false);
    },

    cancel(): void {
      cancelPendingReveal();
      setVisible(false);
    },

    get visible(): boolean {
      return visible;
    },
  };
}
