/**
 * Keeps the Customize overlay open across a hot reload — development only.
 *
 * The overlay's open flag lives in the panel-coordination state, which is
 * created fresh every time Vite swaps a module in the Create tree. So editing
 * any file under Create closed whatever you had open and dropped you back on
 * the settings grid. That is merely annoying with one editor; with several
 * agents editing at once it is constant, because someone else's save closes
 * your panel while you are reading it.
 *
 * So we write down that it was open, and which screen of the drill you were
 * on, and the card puts you back there when it remounts. Session storage, so a
 * new tab starts clean; and gated on DEV, because a real user who reloads the
 * page expects the page, not a settings overlay they opened yesterday.
 */

const KEY = "tka.dev.customize-overlay";

type Memo = { open: boolean; screen: string | null };

// Not just DEV: this runs during SSR too, where there is no sessionStorage.
const enabled = import.meta.env.DEV && typeof sessionStorage !== "undefined";

function read(): Memo {
  if (!enabled) return { open: false, screen: null };
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { open: false, screen: null };
    const parsed = JSON.parse(raw) as Partial<Memo>;
    return {
      open: parsed.open === true,
      screen: typeof parsed.screen === "string" ? parsed.screen : null,
    };
  } catch {
    // A corrupt or blocked store must never take the app down over a dev nicety.
    return { open: false, screen: null };
  }
}

function write(memo: Memo): void {
  if (!enabled) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memo));
  } catch {
    // Private-mode / quota. Nothing to do; the panel just won't come back.
  }
}

/**
 * The overlay opened, showing `screen` (null is the root list). The caller
 * passes the screen rather than us reading the stored one, because opening runs
 * through closeAllPanels first — which tears the note up by design, since every
 * other way of leaving the overlay goes through there too.
 */
export function rememberCustomizeOverlayOpen(screen: string | null): void {
  write({ open: true, screen });
}

/** The overlay closed — by any path, including another panel taking its place. */
export function forgetCustomizeOverlay(): void {
  if (!enabled) return;
  write({ open: false, screen: null });
}

/** Which screen of the drill is showing; null is the root list. */
export function rememberCustomizeScreen(screen: string | null): void {
  const memo = read();
  if (!memo.open) return;
  write({ open: true, screen });
}

export function customizeOverlayWasOpen(): boolean {
  return read().open;
}

export function recallCustomizeScreen(): string | null {
  return read().screen;
}
