/**
 * Prefetches Forest tree images into browser cache.
 *
 * The tree silhouette system loads 82 PNG images on-demand when Forest
 * activates, causing a 4-5 second delay before trees appear. By prefetching
 * with <link rel="prefetch">, the browser fetches them at low priority during
 * idle time. When the image loader later requests them via new Image().src,
 * they resolve from HTTP cache instantly.
 */

// Matches TREE_COUNTS in @austencloud/backgrounds TreeSilhouetteImageLoader
const TREE_COUNTS: Record<string, number> = {
	pine: 12,
	fir: 5,
	spruce: 4,
	oak: 12,
	maple: 12,
	poplar: 6,
	willow: 13,
	dead: 18,
};

const BASE_PATH = '/images/trees/curated';

let prefetched = false;

export function prefetchTreeImages(): void {
	if (prefetched) return;
	prefetched = true;

	for (const [category, count] of Object.entries(TREE_COUNTS)) {
		for (let i = 1; i <= count; i++) {
			const link = document.createElement('link');
			link.rel = 'prefetch';
			link.as = 'image';
			link.href = `${BASE_PATH}/${category}_${String(i).padStart(2, '0')}.png`;
			document.head.appendChild(link);
		}
	}
}
