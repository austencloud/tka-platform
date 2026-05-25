import { browser } from "$app/environment";
import { captureEvent } from "./services/posthog";
import { replaceState } from "$app/navigation";

const SCAN_SOURCE_CODE_KEY = "tka_scan_source_code";

export function detectAndCaptureScanEntry(): void {
  if (!browser) return;

  const url = new URL(window.location.href);
  const fromScan = url.searchParams.get("from");
  const code = url.searchParams.get("code");

  if (fromScan !== "scan" || !code) return;

  sessionStorage.setItem(SCAN_SOURCE_CODE_KEY, code);

  captureEvent("scan_app_opened", {
    short_code: code,
  });

  url.searchParams.delete("from");
  url.searchParams.delete("code");
  replaceState(url.pathname + (url.search || "") + url.hash, {});
}

export function getScanSourceCode(): string | null {
  if (!browser) return null;
  return sessionStorage.getItem(SCAN_SOURCE_CODE_KEY);
}
