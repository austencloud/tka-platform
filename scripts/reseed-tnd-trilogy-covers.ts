/**
 * Reseed the TnD trilogy products' coverCards so each volume's shop fan shows
 * ITS OWN deck's sequences (TKA 2 = 1-turn variations, TKA 3 = half-turn
 * variations) instead of all three sharing the TKA 1 base motions.
 *
 * Sources: deckReleases/counter/manifests/{007,008} (the released decks),
 * catalogs/l1-tnd-motions/sequences (base sequences), and the app's own
 * applyVariationDescriptor to apply each card's turnPattern — the same
 * transform the deck releaser prints with.
 *
 * Run: npx vite-node scripts/reseed-tnd-trilogy-covers.ts
 * (TKA 1 is untouched: its covers already ARE the base motions, with bakes.)
 */
import { readFileSync } from "fs";
import admin from "firebase-admin";
import { parseCsvEdges } from "../src/lib/features/choreo-card/services/pictograph-letter-lookup";
import { applyVariationDescriptor } from "../src/lib/features/choreo-card/services/deck-variation";
import { hydrateSequence } from "../src/lib/features/choreo-card/services/catalog-loader";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const FAMILY_ORDER = [
  "Split-Same",
  "Tog-Same",
  "Quarter-Same",
  "Split-Opp",
  "Tog-Opp",
  "Quarter-Opp",
];

const VOLUMES = [
  { namePrefix: "TKA 2", manifest: "007" },
  { namePrefix: "TKA 3", manifest: "008" },
];

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

async function main() {
  const edges = parseCsvEdges(
    readFileSync("static/data/pictographs/DiamondPictographDataframe.csv", "utf8")
  );

  const products = await db
    .collection("products")
    .where("listing", "==", "tnd-trilogy")
    .get();

  for (const vol of VOLUMES) {
    const prodDoc = products.docs.find((d) =>
      (d.data().name as string).startsWith(vol.namePrefix)
    );
    if (!prodDoc) throw new Error(`No product for ${vol.namePrefix}`);
    const existingCards: any[] = prodDoc.data().coverCards ?? [];

    const man = await db
      .doc(`deckReleases/counter/manifests/${vol.manifest}`)
      .get();
    const entries: any[] = man.data()?.sequences ?? [];

    const newCards: any[] = [];
    for (const family of FAMILY_ORDER) {
      // First manifest entry of this family that actually carries a turn
      // variation (the volume's signature content).
      const entry = entries.find(
        (e) => e.footer?.center === family && e.variation?.turnPattern
      );
      if (!entry) throw new Error(`${vol.namePrefix}: no varied entry for ${family}`);

      const baseSnap = await db
        .doc(`catalogs/${entry.sourceCatalogId}/sequences/${entry.sequenceId}`)
        .get();
      if (!baseSnap.exists) throw new Error(`Missing base ${entry.sequenceId}`);
      const base = hydrateSequence({ id: baseSnap.id, ...baseSnap.data() });

      const { sequence, turnLoopClosed } = applyVariationDescriptor(
        base,
        entry.variation,
        edges
      );
      // Frame styling (element accent, footer) carries over from the existing
      // card of the same family — only the sequence content changes.
      const styled = existingCards.find((c) => c.footerCenter === family) ?? {};
      const { imageUrl, propImageUrls, sequence: _old, ...style } = styled;
      newCards.push({
        ...style,
        footerCenter: family,
        sequence: plain(sequence),
      });
      console.log(
        `${vol.namePrefix} ${family}: ${entry.sequenceId} @ ${entry.variation.turnPattern} (loopClosed=${turnLoopClosed})`
      );
    }

    await prodDoc.ref.update({ coverCards: newCards });
    console.log(`${vol.namePrefix}: coverCards updated (${newCards.length})\n`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
