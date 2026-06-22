/**
 * Fullscreen capability helpers.
 *
 * iPhone Safari does not implement the Fullscreen API on non-video elements
 * (verified 2026-06-22). These helpers feature-detect + handle the webkit
 * prefix so callers can fall back to a CSS-immersive path when native
 * fullscreen is unavailable. All functions are safe to call on any element.
 */

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FsDocument = Document & {
  webkitExitFullscreen?: () => void;
  webkitFullscreenElement?: Element | null;
};

export function supportsNativeFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  const e = el as FsElement;
  return typeof e.requestFullscreen === "function" ||
    typeof e.webkitRequestFullscreen === "function";
}

export async function requestNativeFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (!el) return false;
  const e = el as FsElement;
  try {
    if (typeof e.requestFullscreen === "function") {
      await e.requestFullscreen();
      return true;
    }
    if (typeof e.webkitRequestFullscreen === "function") {
      e.webkitRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    // User gesture / permission rejection — caller falls back to CSS-immersive.
    return false;
  }
}

export async function exitNativeFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const d = document as FsDocument;
  try {
    if (d.fullscreenElement && typeof d.exitFullscreen === "function") {
      await d.exitFullscreen();
    } else if (d.webkitFullscreenElement && typeof d.webkitExitFullscreen === "function") {
      d.webkitExitFullscreen();
    }
  } catch {
    // Already exited or not permitted — nothing to do.
  }
}

export function isNativeFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FsDocument;
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}
