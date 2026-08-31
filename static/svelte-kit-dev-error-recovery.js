const DEV_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "dev.tkaflowarts.com",
]);

const GENERATED_ROUTE_PROXY_ERROR =
  /ENOENT: no such file or directory[\s\S]*\.svelte-kit[\\/]types[\\/]src[\\/]routes[\\/]proxy\+layout\.server\.ts/i;

export function isTransientGeneratedRouteError(hostname, message) {
  return DEV_HOSTS.has(hostname) && GENERATED_ROUTE_PROXY_ERROR.test(message);
}

export function installGeneratedRouteRecovery({
  location,
  document,
  fetch,
  schedule,
  reload,
}) {
  const status = document.querySelector("[data-error-status]");
  const message = document.querySelector("[data-error-message]");
  const errorText = message?.textContent ?? "";

  if (
    !message ||
    !isTransientGeneratedRouteError(location.hostname, errorText)
  ) {
    return false;
  }

  document.title = "Refreshing local app";
  if (status) status.textContent = "DEV";
  message.textContent = "Refreshing local app…";

  let retryDelay = 350;
  const retry = async () => {
    try {
      const response = await fetch(location.href, { cache: "no-store" });
      if (response.ok) {
        reload();
        return;
      }
    } catch {
      // The launcher may be replacing Vite. Keep the fallback page calm until
      // the same URL serves successfully again.
    }

    retryDelay = Math.min(retryDelay + 250, 1500);
    schedule(retry, retryDelay);
  };

  schedule(retry, retryDelay);
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installGeneratedRouteRecovery({
    location: window.location,
    document,
    fetch: window.fetch.bind(window),
    schedule: window.setTimeout.bind(window),
    reload: () => window.location.reload(),
  });
}
