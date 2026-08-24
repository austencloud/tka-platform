#!/usr/bin/env node
/**
 * Census for the theta-id migration. Read-only; it never writes.
 *
 * Theta is always uppercase in TKA canon, and /admin/migrate-theta already
 * rewrote every stored word and name. It could not touch document ids, which
 * Firestore will not rename - so 70 sequences still answer to a lowercase
 * theta in their id, and therefore in their URL.
 *
 * Renaming an id means writing a new document and deleting the old, which only
 * holds together if every reference moves with it. This reports what points at
 * those ids so the migration can be scoped before it runs.
 *
 * Every read is projected with `.select()`. An unprojected pass over
 * publicSequences pulls 565 whole sequences with their step payloads and does
 * not finish inside ten minutes; ids and one or two reference fields are all a
 * census needs.
 *
 *   node scripts/census-theta-ids.cjs
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("../serviceAccountKey.json")),
});
const db = admin.firestore();

const hasTheta = (v) => typeof v === "string" && v.includes("θ");
const say = (m) => process.stdout.write(m + "\n");

/** Every string anywhere in a document, with the path that reached it. */
function* strings(value, path = "") {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value))
    for (const v of value) yield* strings(v, `${path}[]`);
  else if (value && typeof value === "object" && !value.toDate)
    for (const [k, v] of Object.entries(value))
      yield* strings(v, path ? `${path}.${k}` : k);
}

const found = [];
function record(collection, id, data) {
  const fields = new Set();
  if (hasTheta(id)) fields.add("<document id>");
  for (const [path, value] of strings(data || {}))
    if (hasTheta(value)) fields.add(path);
  if (fields.size) found.push({ collection, id, fields: [...fields] });
}

/** Ids only - the cheapest read Firestore offers. */
async function scanIds(ref, label) {
  const snap = await ref.select().get();
  for (const doc of snap.docs) record(label, doc.id, null);
  return snap.size;
}

async function scanFields(ref, label, fields) {
  const snap = await (fields ? ref.select(...fields) : ref).get();
  for (const doc of snap.docs) record(label, doc.id, doc.data());
  return snap.size;
}

/** `in` takes 30 values at a time, and 70 ids do not fit in one query. */
async function scanReferrers(collection, field, ids) {
  let hits = 0;
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db
      .collection(collection)
      .where(field, "in", ids.slice(i, i + 30))
      .select(field)
      .get();
    for (const doc of snap.docs) record(collection, doc.id, doc.data());
    hits += snap.size;
  }
  return hits;
}

(async () => {
  // The ids come from the index itself rather than a hardcoded list, so the
  // census cannot drift from the data it describes.
  const all = (await db.collection("publicSequences").select().get()).docs.map(
    (d) => d.id
  );
  const ids = all.filter(hasTheta);
  say(`publicSequences: ${ids.length} of ${all.length} ids carry a lowercase theta`);

  const taken = ids.filter((id) => all.includes(id.replace(/θ/g, "Θ")));
  say(
    taken.length
      ? `!! corrected id already exists: ${taken.join(", ")}`
      : `corrected ids are all free - the rename is one-to-one`
  );
  for (const id of ids) record("publicSequences", id, null);

  for (const [c, f] of [
    ["shortcodes", "sequenceId"],
    ["physicalCards", "sequenceId"],
    ["sequenceRevisions", "sequenceId"],
    ["publicSequenceHashes", "sequenceId"],
    ["showcaseVideos", "sequenceId"],
    ["videos", "sequenceId"],
  ]) {
    say(`  ${c}: ${await scanReferrers(c, f, ids)} referring documents`);
  }

  await scanFields(db.collection("decks"), "decks");
  await scanFields(db.collection("catalogs"), "catalogs");
  await scanFields(
    db.collection("deckReleases/counter/manifests"),
    "deckReleases/counter/manifests"
  );
  say("  scanned decks, catalogs, deck release manifests");

  for (const cat of (await db.collection("catalogs").select().get()).docs)
    await scanIds(cat.ref.collection("sequences"), `catalogs/*/sequences`);
  say("  scanned catalog sequence copies");

  for (const user of (await db.collection("users").select().get()).docs) {
    await scanIds(user.ref.collection("sequences"), `users/*/sequences`);
    await scanIds(user.ref.collection("collections"), `users/*/collections`);
  }
  say("  scanned user libraries and collections");

  const grouped = {};
  for (const h of found) {
    const e = (grouped[h.collection] ??= { docs: 0, fields: {} });
    e.docs += 1;
    for (const f of h.fields) e.fields[f] = (e.fields[f] || 0) + 1;
  }

  say("\n=== documents carrying a lowercase theta ===");
  for (const [k, v] of Object.entries(grouped))
    say(`${String(v.docs).padStart(5)}  ${k}  ${JSON.stringify(v.fields)}`);
  say(`\ntotal: ${found.length} documents`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
