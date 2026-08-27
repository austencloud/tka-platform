/**
 * Root-font ramp scale.
 *
 * Ordinary app and public surfaces keep the standard 16px root at every
 * viewport width. A deliberately scaled artifact shell may still opt into a
 * different root, and hardcoded pixel geometry inside it must follow that
 * explicit scale.
 *
 * Consumers multiply their px constant by `scale`. Standard surfaces resolve
 * to 1, so the authored size is unchanged.
 */

/** The root font size every hardcoded px constant in the app was authored against. */
const BASE_ROOT_FONT_PX = 16;

export interface RootFontRamp {
  /** 1 on a standard surface; higher only in an explicitly scaled shell. */
  readonly scale: number;
  /** A px constant scaled by the ramp and rounded to a whole pixel. */
  scaled(px: number): number;
}

/**
 * Track the ramp for the lifetime of the calling component. Must be called
 * during component initialisation — it owns an effect and a resize listener.
 */
export function createRootFontRamp(): RootFontRamp {
  let rootFontPx = $state(BASE_ROOT_FONT_PX);

  $effect(() => {
    const read = (): void => {
      const parsed = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      rootFontPx =
        Number.isFinite(parsed) && parsed > 0 ? parsed : BASE_ROOT_FONT_PX;
    };

    read();
    // Root size can change when an explicit presentation or artifact mode
    // enters, exits, or crosses its responsive boundary.
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  });

  // Never below 1: a surface with a smaller root font should still render the
  // size its px constant was authored for, not a shrunken one.
  const scale = $derived(Math.max(1, rootFontPx / BASE_ROOT_FONT_PX));

  return {
    get scale() {
      return scale;
    },
    scaled(px: number) {
      return Math.round(px * scale);
    },
  };
}
