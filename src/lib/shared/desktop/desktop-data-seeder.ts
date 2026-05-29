import { db } from "$lib/shared/persistence/database/tka-database";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AppSettings } from "$lib/shared/settings/domain/AppSettings";

const BUNDLE_VERSION_KEY = "desktop-bundle-version";

interface DeckManifest {
	decks: Array<{
		deckId: string;
		deckName: string;
		filename: string;
		count: number;
	}>;
	totalSequences: number;
	exportedAt: string;
}

interface DeckBundle {
	deckId: string;
	deckName: string;
	sequences: Array<Record<string, unknown>>;
}

async function seed(appVersion: string): Promise<void> {
	const { resolveResource } = await import("@tauri-apps/api/path");
	const { readTextFile } = await import("@tauri-apps/plugin-fs");

	const manifestPath = await resolveResource("data/sequences/_manifest.json");
	const manifestJson = await readTextFile(manifestPath);
	const manifest: DeckManifest = JSON.parse(manifestJson);

	let seeded = 0;
	const total = manifest.totalSequences;

	for (const deck of manifest.decks) {
		const deckPath = await resolveResource(`data/sequences/${deck.filename}`);
		const deckJson = await readTextFile(deckPath);
		const bundle: DeckBundle = JSON.parse(deckJson);

		const BATCH_SIZE = 500;
		for (let i = 0; i < bundle.sequences.length; i += BATCH_SIZE) {
			const batch = bundle.sequences.slice(i, i + BATCH_SIZE);
			await db.sequences.bulkPut(batch as unknown as SequenceData[]);
			seeded += batch.length;

			if (seeded % 2000 === 0) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}
	}

	await db.settings.put({
		id: BUNDLE_VERSION_KEY,
		bundleVersion: appVersion,
	} as unknown as AppSettings & { id: string });

}

export async function seedIfNeeded(appVersion: string): Promise<void> {
	const existing = await db.settings.get(BUNDLE_VERSION_KEY);
	if (existing && (existing as unknown as Record<string, unknown>).bundleVersion === appVersion) {
		return;
	}

	await seed(appVersion);
}
