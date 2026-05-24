export class BlobUrlTracker {
	private urls = new Set<string>();
	private keyedUrls = new Map<string, string>();

	track(url: string): string {
		this.urls.add(url);
		return url;
	}

	trackKeyed(key: string, url: string): string {
		const prev = this.keyedUrls.get(key);
		if (prev) {
			URL.revokeObjectURL(prev);
			this.urls.delete(prev);
		}
		this.keyedUrls.set(key, url);
		this.urls.add(url);
		return url;
	}

	revoke(url: string): void {
		if (this.urls.has(url)) {
			URL.revokeObjectURL(url);
			this.urls.delete(url);
		}
		for (const [key, val] of this.keyedUrls) {
			if (val === url) {
				this.keyedUrls.delete(key);
				break;
			}
		}
	}

	revokeAll(): void {
		for (const url of this.urls) {
			URL.revokeObjectURL(url);
		}
		this.urls.clear();
		this.keyedUrls.clear();
	}

	get size(): number {
		return this.urls.size;
	}
}
