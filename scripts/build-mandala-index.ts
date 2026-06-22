// scripts/build-mandala-index.ts
// Walks catalog decks, computes mandala fingerprints, writes static/data/mandala-index.json.
// Usage: npx tsx --tsconfig scripts/tsconfig.json scripts/build-mandala-index.ts [deckIdSubstring]
import admin from "firebase-admin";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { calculate } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { buildIndex, type IndexInput } from "$lib/shared/mandala/services/mandala-index-builder";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
	readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8"),
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function loadAll(collectionPath: string) {
	const PAGE = 500;
	const out: FirebaseFirestore.QueryDocumentSnapshot[] = [];
	let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
	let more = true;
	while (more) {
		let q = db.collection(collectionPath).orderBy("__name__").limit(PAGE);
		if (last) q = q.startAfter(last);
		const snap = await q.get();
		out.push(...snap.docs);
		last = snap.docs[snap.docs.length - 1] ?? null;
		more = snap.docs.length === PAGE;
	}
	return out;
}

async function main() {
	const filter = process.argv[2];
	const decksSnap = await db.collection("catalogs").get();
	const decks = decksSnap.docs
		.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
		.filter((d) => d.collection === "LOOPs" && (!filter || d.id.includes(filter)));

	console.log(`Indexing ${decks.length} decks...`);
	const inputs: IndexInput[] = [];
	for (const deck of decks) {
		const docs = await loadAll(`catalogs/${deck.id}/sequences`);
		for (const doc of docs) {
			const seq = doc.data() as { steps?: unknown[]; word?: string };
			if (!seq.steps || seq.steps.length === 0) continue;
			try {
				const paths = calculate(seq.steps as never, "staff", "staff");
				inputs.push({ ref: { seqId: doc.id, word: seq.word ?? doc.id, deck: deck.id }, paths });
			} catch {
				/* skip unrenderable */
			}
		}
		console.log(`  ${deck.id}: ${docs.length} seqs`);
	}

	const index = buildIndex(inputs);
	console.log(`${inputs.length} sequences → ${Object.keys(index.byShape).length} distinct glyphs`);

	const outPath = resolve(__dirname, "../static/data/mandala-index.json");
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(index));
	console.log(`Wrote ${outPath}`);
	process.exit(0);
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
