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

// SvelteKit flips its internal "router started" flag only after the root
// component's effects have run, so a URL write issued from a component that
// mounts during hydration — an onMount, or afterNavigate on the initial load —
// arrives too early. In dev that throws "Cannot call pushState(...) before
// router is initialized", and because the throw escapes the mount flush the
// router never finishes starting: every later shallow-routing call on that page
// fails too, so one early write kills client-side navigation for the whole
// session. SvelteKit exposes no readiness signal, so an early write is caught
// and retried on the next task, by which time the router is up.
const ROUTER_NOT_READY = /before router is initialized/;
const MAX_DEFERRED_ATTEMPTS = 10;

interface UrlWrite {
  destination: string | URL;
  state: App.PageState;
  mode: UrlMutationMode;
  attempts: number;
}

let deferredWrite: UrlWrite | null = null;
let retryScheduled = false;

function mergePageState(options: UrlStateOptions): App.PageState {
  const nextState: App.PageState = { ...(page.state ?? {}) };

  for (const key of options.removeState ?? []) {
    delete nextState[key];
  }

  Object.assign(nextState, options.state ?? {});

  return nextState;
}

/** Returns false when the router isn't up yet. Any other failure is a real bug. */
function commitWrite(write: UrlWrite): boolean {
  try {
    if (write.mode === "push") {
      svelteKitPushState(write.destination, write.state);
    } else {
      svelteKitReplaceState(write.destination, write.state);
    }
    return true;
  } catch (error) {
    if (error instanceof Error && ROUTER_NOT_READY.test(error.message)) {
      return false;
    }
    throw error;
  }
}

function retryDeferredWrite(): void {
  retryScheduled = false;

  const write = deferredWrite;
  if (!write) return;
  deferredWrite = null;

  if (!commitWrite(write)) deferWrite(write);
}

function deferWrite(write: UrlWrite): void {
  if (write.attempts >= MAX_DEFERRED_ATTEMPTS) {
    console.warn(
      "[url-state] Router never initialized; dropped URL write to",
      String(write.destination)
    );
    return;
  }

  deferredWrite = { ...write, attempts: write.attempts + 1 };

  if (retryScheduled) return;
  retryScheduled = true;
  setTimeout(retryDeferredWrite, 0);
}

export function writeUrl(
  destination: string | URL,
  options: UrlStateOptions = {}
): void {
  if (!browser) return;

  // A write still waiting on the router describes a URL the app has already
  // moved past — the newest write wins.
  deferredWrite = null;

  const write: UrlWrite = {
    destination,
    state: mergePageState(options),
    mode: options.mode === "push" ? "push" : "replace",
    attempts: 0,
  };

  if (!commitWrite(write)) deferWrite(write);
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
