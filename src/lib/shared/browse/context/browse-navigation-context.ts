import { getContext, setContext } from "svelte";
import type { BrowseNavigationState } from "$lib/shared/browse/state/browse-navigation-state.svelte";

const BROWSE_NAVIGATION_CONTEXT = Symbol("browse-navigation");

export function setBrowseNavigationContext(
  navigation: BrowseNavigationState
): BrowseNavigationState {
  setContext(BROWSE_NAVIGATION_CONTEXT, navigation);
  return navigation;
}

export function getBrowseNavigationContext(): BrowseNavigationState {
  const navigation = getContext<BrowseNavigationState>(
    BROWSE_NAVIGATION_CONTEXT
  );
  if (!navigation) {
    throw new Error("Browse navigation context is not available");
  }
  return navigation;
}
