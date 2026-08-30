import { browser } from "$app/environment";
import type { BackgroundType } from "@austencloud/backgrounds";

import {
  VIEWER_3D_ENVIRONMENT_STORAGE_KEY,
  getSceneEnvironmentRendererKey,
  normalizeSceneEnvironmentId,
} from "../environments/domain/scene-environment";
import { DECODER_RUNTIME_URLS, sceneAssetUrls } from "./scene-asset-manifest";

const warmed = new Set<string>();

interface SaveDataConnection {
  saveData?: boolean;
}

function shouldSkipWarming(): boolean {
  if (!browser) return true;
  if (navigator.onLine === false) return true;
  // Warming spends bandwidth the user has not asked to spend yet. Data Saver is
  // an explicit request not to.
  const connection = (navigator as Navigator & { connection?: SaveDataConnection })
    .connection;
  return connection?.saveData === true;
}

function onIdle(run: () => void): void {
  const schedule = (
    globalThis as {
      requestIdleCallback?: (callback: () => void) => number;
    }
  ).requestIdleCallback;
  if (typeof schedule === "function") schedule(run);
  else setTimeout(run, 200);
}

async function warmUrls(urls: readonly string[]): Promise<void> {
  // Sequential on purpose: these downloads must never compete with whatever the
  // user is actually looking at. A failure means the asset simply loads the
  // normal way later, so it is not worth reporting.
  for (const url of urls) {
    if (warmed.has(url)) continue;
    warmed.add(url);
    try {
      await fetch(url, { priority: "low" } as RequestInit);
    } catch {
      warmed.delete(url);
    }
  }
}

/**
 * Pull the selected environment's models into the HTTP cache while the browser
 * is idle, so opening 3D reads them from disk instead of the network. Only the
 * selected background — the ten scenes together run to hundreds of megabytes.
 */
export function warmSceneAssets(background: BackgroundType): void {
  if (shouldSkipWarming()) return;
  const urls = sceneAssetUrls(background);
  if (urls.length === 0) return;
  onIdle(() => void warmUrls(urls));
}

/**
 * Warm the environment the viewer will actually open, read from the same
 * remembered choice the viewer boots with, plus the shared decoders. Callers
 * that only know 3D is one click away — the split pane, fullscreen, a saved
 * scene preview — use this rather than resolving the environment themselves.
 */
export function warmSelectedSceneAssets(): void {
  if (shouldSkipWarming()) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VIEWER_3D_ENVIRONMENT_STORAGE_KEY);
  } catch {
    stored = null;
  }
  warmSceneAssets(
    getSceneEnvironmentRendererKey(normalizeSceneEnvironmentId(stored))
  );
  warmDecoderRuntimes();
}

export function warmDecoderRuntimes(): void {
  if (shouldSkipWarming()) return;
  onIdle(() => void warmUrls(DECODER_RUNTIME_URLS));
}

export function _resetForTests(): void {
  warmed.clear();
}
