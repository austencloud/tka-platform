import { browser } from "$app/environment";
import {
  pushState as svelteKitPushState,
  replaceState as svelteKitReplaceState,
} from "$app/navigation";
import { page } from "$app/state";

export type UrlMutationMode = "push" | "replace";

export interface UrlStateOptions {
  mode?: UrlMutationMode;
  state?: Partial<App.PageState>;
  removeState?: readonly (keyof App.PageState)[];
}

function mergePageState(options: UrlStateOptions): App.PageState {
  const nextState: App.PageState = { ...(page.state ?? {}) };

  for (const key of options.removeState ?? []) {
    delete nextState[key];
  }

  Object.assign(nextState, options.state ?? {});

  return nextState;
}

export function writeUrl(
  destination: string | URL,
  options: UrlStateOptions = {}
): void {
  if (!browser) return;

  const state = mergePageState(options);
  if (options.mode === "push") {
    svelteKitPushState(destination, state);
    return;
  }

  svelteKitReplaceState(destination, state);
}

export function mutateCurrentUrl(
  mutation: (url: URL) => void,
  options: UrlStateOptions = {}
): void {
  if (!browser) return;

  const currentUrl = new URL(window.location.href);
  const nextUrl = new URL(currentUrl);
  mutation(nextUrl);

  if (
    nextUrl.href === currentUrl.href &&
    options.state === undefined &&
    !options.removeState?.length
  ) {
    return;
  }

  writeUrl(nextUrl, options);
}

export function removeCurrentUrlParams(
  names: readonly string[],
  options: UrlStateOptions = {}
): void {
  mutateCurrentUrl((url) => {
    for (const name of names) {
      url.searchParams.delete(name);
    }
  }, options);
}
