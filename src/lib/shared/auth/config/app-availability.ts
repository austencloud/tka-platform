import { env } from "$env/dynamic/public";

/**
 * Whether the native app is live in the stores.
 *
 * The whole app-forward escape path flips on this one value, so store-launch is
 * an env change, not a code change: set PUBLIC_APP_LAUNCHED=1 and the escape
 * resolver starts routing to the app instead of the browser. Dynamic env (not
 * static) so an unset flag reads as undefined at runtime rather than breaking
 * the build. `?appLaunched=1` overrides it for testing before the real flip.
 */
export function isAppLaunched(searchParams?: URLSearchParams): boolean {
  if (searchParams?.get("appLaunched") === "1") return true;
  const flag = env.PUBLIC_APP_LAUNCHED;
  return flag === "1" || flag === "true";
}

export function appStoreUrl(): string | undefined {
  return env.PUBLIC_APP_STORE_URL || undefined;
}

export function playStoreUrl(): string | undefined {
  return env.PUBLIC_PLAY_STORE_URL || undefined;
}
