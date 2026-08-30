/**
 * Dev-only reload breadcrumb.
 *
 * The dev tab full-reloads "out of nowhere" — Vite full-reloads, dev-server
 * restarts, and the HMR-crash recovery guards all call location.reload(), and
 * the console line naming the culprit dies with the page. This records WHY a
 * reload is about to happen in sessionStorage (which survives the reload) and
 * prints it as the first line after the next boot, so a bounce back to the
 * splash screen is never a mystery.
 *
 * Recorders live at every automatic reload site:
 *   - installViteReloadTracers(): Vite's own full-reload + ws-disconnect
 *   - hooks.client.ts: the HMR-apply-crash guard and the stale-SW escape
 *   - hmr-helper.ts: scheduleReload() and recoverFromModuleChunkFailure()
 *
 * User-initiated reloads (F5, Retry buttons) record nothing and print nothing.
 * Every function is a no-op outside DEV; prod builds tree-shake the module.
 */

const KEY = "tka-reload-why";

interface ReloadBreadcrumb {
  reason: string;
  detail?: string;
  at: number;
}

export function recordReloadReason(reason: string, detail?: string): void {
  if (!import.meta.env.DEV || typeof sessionStorage === "undefined") return;
  try {
    const crumb: ReloadBreadcrumb = { reason, detail, at: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(crumb));
  } catch {
    // A blocked sessionStorage write must never interfere with the reload.
  }
}

function formatAge(ms: number): string {
  if (ms < 0) return "just now";
  if (ms < 90_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

/**
 * Consume and print the breadcrumb from the previous page, if one exists.
 * Called at the top of hooks.client.ts so it lands before the boot noise.
 */
export function printReloadBreadcrumb(): void {
  if (!import.meta.env.DEV || typeof sessionStorage === "undefined") return;
  let crumb: ReloadBreadcrumb | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (raw) crumb = JSON.parse(raw) as ReloadBreadcrumb;
  } catch {
    return;
  }
  if (!crumb?.reason) return;
  const detail = crumb.detail ? ` — ${crumb.detail}` : "";
  const age = formatAge(Date.now() - crumb.at);
  console.info(
    `%c why did it reload? %c ${crumb.reason}${detail} (recorded ${age} before this boot)`,
    "background:#7c5cff;color:#fff;padding:1px 6px;border-radius:3px;font-weight:600",
    ""
  );
}

/**
 * Record the two reloads Vite's own client performs, which no app code sees:
 * the full-reload it sends when a change can't be hot-applied, and the reload
 * it does after the websocket drops (server restart/crash) and comes back.
 */
export function installViteReloadTracers(): void {
  if (!import.meta.env.DEV || !import.meta.hot) return;

  import.meta.hot.on("vite:beforeFullReload", (payload: unknown) => {
    const p = payload as { path?: string; triggeredBy?: string } | undefined;
    const file = p?.triggeredBy ?? p?.path;
    recordReloadReason(
      "Vite full-reload",
      file && file !== "*"
        ? file
        : "a module outside HMR boundaries changed (server file, app.html, config, …)"
    );
  });

  import.meta.hot.on("vite:ws:disconnect", () => {
    recordReloadReason(
      "dev server connection lost",
      "restart or crash; Vite reloads the page when the server comes back"
    );
  });
}
