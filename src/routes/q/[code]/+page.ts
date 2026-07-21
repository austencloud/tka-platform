import { browser } from "$app/environment";
import { beginScanVisit } from "$lib/shared/analytics/scan-analytics";
import type { PageLoad } from "./$types";

/**
 * A universal load runs before SvelteKit commits a client-side navigation.
 * That gives the automatic history-change $pageview the scan join keys, while
 * the server load's lightweight metadata fills attribution immediately.
 */
export const load: PageLoad = ({ params, data }) => {
  if (browser && params.code) {
    beginScanVisit(params.code, {
      sequenceWord: data.meta?.word ?? null,
      deckId: data.meta?.deckId ?? null,
      deckName: data.meta?.deckName ?? null,
      blueProp: data.meta?.bluePropType ?? null,
      redProp: data.meta?.redPropType ?? null,
    });
  }

  return data;
};
