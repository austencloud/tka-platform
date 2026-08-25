/**
 * Root-font ramp scale.
 *
 * Marketing and editorial surfaces ramp the document's root font size from
 * 16px to 24px across 1680 -> 3840 (see `src/app.css`), so every rem-based
 * measure grows in lockstep on a large display. Anything sized by a hardcoded
 * px constant does not, and a pictograph frozen at its 1080p size inside a
 * grid that grew around it is the visible result.
 *
 * Consumers multiply their px constant by `scale` so those constants ramp with
 * everything else. The app shell does not ramp — its root stays 16px at any
 * width — so `scale` is 1 there and the stock size is what renders.
 */

/** The root font size every hardcoded px constant in the app was authored against. */
const BASE_ROOT_FONT_PX = 16;

export interface RootFontRamp {
  /** 1 on a non-ramping surface; up to 1.5 at the top of the marketing ramp. */
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
    // The ramp is a viewport-width clamp, so a resize is the only thing that
    // moves it.
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
