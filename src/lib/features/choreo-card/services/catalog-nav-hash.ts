// URL-hash serialization for catalog navigation in the Choreo Card tab.
// Pure functions, no component state — extracted verbatim from ChoreoCardTab.svelte
// (god-component-decomposition Phase 1). Note the deliberate asymmetry: encode
// returns the hash WITHOUT a leading "#" (the browser adds it when assigned to
// url.hash), while decode reads location.hash which DOES include the "#".

export interface CatalogNavState {
	catalogId: string | null;
	tndFamily: string | null;
}

export function encodeNavHash(state: CatalogNavState): string {
	const params = new URLSearchParams();
	if (state.catalogId) params.set("catalog", state.catalogId);
	if (state.tndFamily) params.set("tndFamily", state.tndFamily);
	const str = params.toString();
	return str ? `catalog-nav:${str}` : "";
}

export function decodeNavHash(hash: string): CatalogNavState | null {
	if (!hash.startsWith("#catalog-nav:")) return null;
	try {
		const params = new URLSearchParams(hash.slice("#catalog-nav:".length));
		return {
			catalogId: params.get("catalog"),
			tndFamily: params.get("tndFamily"),
		};
	} catch {
		return null;
	}
}
