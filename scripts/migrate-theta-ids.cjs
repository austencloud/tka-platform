#!/usr/bin/env node
/**
 * Rename every sequence document id that carries a lowercase theta.
 *
 * Theta is always uppercase Θ in TKA canon. /admin/migrate-theta rewrote every
 * stored word and name to say so, but it could not touch document ids -
 * Firestore has no rename, only write-new and delete-old. So 70 published
 * sequences still answer to a lowercase θ in their id, and therefore in their
 * URL, while their own word reads Θ.
 *
 *   node scripts/migrate-theta-ids.cjs            # dry run, writes nothing
 *   node scripts/migrate-theta-ids.cjs --apply    # write
 *
 * ORDER IS THE SAFETY. New documents are written first, referrers are moved
 * second, old documents are deleted last. Interrupted at any point, every id
 * still resolves: the new one directly, the old one through the theta fallback
 * in loadByIdentifier, which stays in the code permanently because θ URLs are
 * already in the wild and cannot be recalled.
 *
 * Take a backup first: node scripts/firestore-backup.cjs
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("../serviceAccountKey.json")),
});
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const fix = (s) => s.replace(/θ/g, "Θ");
const hasTheta = (v) => typeof v === "string" && v.includes("θ");
const say = (m) => process.stdout.write(m + "\n");

/** Referrers that name a sequence by id in a single field. */
const REFERRERS = [
  "shortcodes",
  "sequenceRevisions",
  "publicSequenceHashes",
  "videos",
];

const plan = { create: [], update: [], delete: [] };

async function planSequenceMove(collectionPath, id) {
  const oldRef = db.doc(`${collectionPath}/${id}`);
  const snap = await oldRef.get();
  if (!snap.exists) return;

  const newId = fix(id);
  if ((await db.doc(`${collectionPath}/${newId}`).get()).exists) {
    throw new Error(`${collectionPath}/${newId} already exists - refusing`);
  }

  // A published index entry points back at the library document it mirrors.
  // That path moves with the document.
  const data = snap.data();
  if (hasTheta(data.sourceRef)) data.sourceRef = fix(data.sourceRef);
  if (hasTheta(data.id)) data.id = fix(data.id);

  plan.create.push({ path: `${collectionPath}/${newId}`, data });
  plan.delete.push({ path: `${collectionPath}/${id}` });
}

async function planReferrers(collection, ids) {
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db
      .collection(collection)
      .where("sequenceId", "in", ids.slice(i, i + 30))
      .select("sequenceId")
      .get();
    for (const doc of snap.docs) {
      plan.update.push({
        path: doc.ref.path,
        data: { sequenceId: fix(doc.data().sequenceId) },
      });
    }
  }
}

async function commit() {
  const ops = [
    ...plan.create.map((o) => ["set", o]),
    ...plan.update.map((o) => ["update", o]),
    ...plan.delete.map((o) => ["delete", o]),
  ];
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const [kind, op] of ops.slice(i, i + 400)) {
      const ref = db.doc(op.path);
      if (kind === "set") batch.set(ref, op.data);
      else if (kind === "update") batch.update(ref, op.data);
      else batch.delete(ref);
    }
    await batch.commit();
    say(`  committed ${Math.min(i + 400, ops.length)} / ${ops.length}`);
  }
}

(async () => {
  const publicIds = (await db.collection("publicSequences").select().get()).docs
    .map((d) => d.id)
    .filter(hasTheta);

  // One library sequence carries a theta without being published, so the id
  // list cannot come from the public index alone.
  const libraryIds = [];
  for (const user of (await db.collection("users").select().get()).docs) {
    const snap = await user.ref.collection("sequences").select().get();
    for (const doc of snap.docs)
      if (hasTheta(doc.id))
        libraryIds.push({ owner: user.id, id: doc.id });
  }

  say(`publicSequences to rename: ${publicIds.length}`);
  say(`library sequences to rename: ${libraryIds.length}`);

  for (const id of publicIds) await planSequenceMove("publicSequences", id);
  for (const { owner, id } of libraryIds)
    await planSequenceMove(`users/${owner}/sequences`, id);

  const allIds = [...new Set([...publicIds, ...libraryIds.map((l) => l.id)])];
  for (const c of REFERRERS) await planReferrers(c, allIds);

  // The one performance video names its sequence inside its own document id.
  for (const doc of (await db.collection("videos").select().get()).docs)
    if (hasTheta(doc.id)) await planSequenceMove("videos", doc.id);

  say("\n=== plan ===");
  const byCollection = {};
  for (const [kind, list] of Object.entries(plan))
    for (const op of list) {
      const c = op.path.replace(/\/[^/]+$/, "").replace(/users\/[^/]+/, "users/*");
      ((byCollection[c] ??= {})[kind] ??= 0), (byCollection[c][kind] += 1);
    }
  for (const [c, kinds] of Object.entries(byCollection))
    say(`  ${c}  ${JSON.stringify(kinds)}`);
  say(
    `\ncreate ${plan.create.length} · update ${plan.update.length} · delete ${plan.delete.length}` +
      `  = ${plan.create.length + plan.update.length + plan.delete.length} writes`
  );

  if (!APPLY) {
    say("\nDRY RUN - nothing written. Re-run with --apply to commit.");
    process.exit(0);
  }

  say("\napplying...");
  await commit();
  say("done.");
  process.exit(0);
})().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
