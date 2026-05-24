import { BlobUrlTracker } from "./blob-url-tracker";

export function useBlobTracker(): BlobUrlTracker {
	const tracker = new BlobUrlTracker();

	$effect(() => {
		return () => tracker.revokeAll();
	});

	return tracker;
}
