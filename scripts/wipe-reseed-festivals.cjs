/**
 * Wipe all festivals from Firestore and reseed from curated seed data.
 * Uses the existing CLI auth infrastructure.
 *
 * Run: node --experimental-vm-modules scripts/wipe-reseed-festivals.cjs
 */

async function main() {
  // Use dynamic import for ESM firestore-provider
  const { initFirestore } = await import("./lib/firestore-provider.js");
  const { db, sdk, FieldValue } = await initFirestore();

  const seeds = require("./festival-seed-data.cjs");

  if (sdk === "admin") {
    // Admin SDK path
    const festivalsRef = db.collection("festivals");

    // Step 1: Wipe
    console.log("Fetching all festivals...");
    const snap = await festivalsRef.get();
    console.log(`Found ${snap.size} festivals to delete.`);

    const batch1Size = 500;
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % batch1Size === 0) {
        await batch.commit();
        console.log(`  Deleted ${count}/${snap.size}`);
        batch = db.batch();
      }
    }
    if (count % batch1Size !== 0) await batch.commit();
    console.log(`Deleted ${count} festivals.`);

    // Step 2: Verify empty
    const verify = await festivalsRef.get();
    if (verify.size > 0) {
      console.error(`ERROR: ${verify.size} still remain! Aborting.`);
      process.exit(1);
    }
    console.log("Collection is empty. Seeding...");

    // Step 3: Seed
    const seenNames = new Set();
    let seeded = 0;
    for (const seed of seeds) {
      if (seenNames.has(seed.name)) continue;
      seenNames.add(seed.name);

      await festivalsRef.add(buildDoc(seed, FieldValue));
      seeded++;
    }
    console.log(`Seeded ${seeded} festivals.`);

    // Step 4: Verify
    const finalSnap = await festivalsRef.get();
    console.log(`Final count: ${finalSnap.size}`);
    if (finalSnap.size === seeded) {
      console.log("SUCCESS: No duplicates.");
    } else {
      console.error(`MISMATCH: Expected ${seeded}, got ${finalSnap.size}`);
    }
  } else {
    // Client SDK path
    const {
      collection,
      getDocs,
      deleteDoc,
      addDoc,
      doc,
      Timestamp,
      serverTimestamp,
    } = await import("firebase/firestore");

    const festivalsRef = collection(db, "festivals");

    // Step 1: Wipe
    console.log("Fetching all festivals...");
    const snap = await getDocs(festivalsRef);
    console.log(`Found ${snap.size} festivals to delete.`);

    let deleted = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, "festivals", d.id));
      deleted++;
      if (deleted % 20 === 0) console.log(`  Deleted ${deleted}/${snap.size}`);
    }
    console.log(`Deleted ${deleted} festivals.`);

    // Step 2: Verify
    const verify = await getDocs(festivalsRef);
    if (verify.size > 0) {
      console.error(`ERROR: ${verify.size} still remain! Aborting.`);
      process.exit(1);
    }
    console.log("Collection is empty. Seeding...");

    // Step 3: Seed
    const seenNames = new Set();
    let seeded = 0;
    for (const seed of seeds) {
      if (seenNames.has(seed.name)) continue;
      seenNames.add(seed.name);

      const record = buildDocClient(seed, Timestamp, serverTimestamp);
      await addDoc(festivalsRef, record);
      seeded++;
    }
    console.log(`Seeded ${seeded} festivals.`);

    // Step 4: Verify
    const finalSnap = await getDocs(festivalsRef);
    console.log(`Final count: ${finalSnap.size}`);
    if (finalSnap.size === seeded) {
      console.log("SUCCESS: No duplicates.");
    } else {
      console.error(`MISMATCH: Expected ${seeded}, got ${finalSnap.size}`);
    }
  }

  process.exit(0);
}

function toSize(raw) {
  if (!raw) return undefined;
  if (raw === "small") return "intimate";
  return raw;
}

function buildDoc(seed, FieldValue) {
  const record = {
    name: seed.name,
    organizationId: seed.organizationId || seed.organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    organization: seed.organization,
    location: seed.location,
    dates: {
      start: new Date(seed.startDate),
      end: new Date(seed.endDate),
    },
    seekingInstructors: seed.seekingInstructors,
    seekingPerformers: seed.seekingPerformers,
    description: seed.description,
    region: seed.region,
    status: "upcoming",
    tags: seed.tags,
    source: "curated",
    moderationStatus: "approved",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (seed.websiteUrl) record.websiteUrl = seed.websiteUrl;
  if (seed.imageUrl) record.imageUrl = seed.imageUrl;
  if (seed.socialLinks) record.socialLinks = seed.socialLinks;
  const size = toSize(seed.estimatedSize);
  if (size) record.estimatedSize = size;
  return record;
}

function buildDocClient(seed, Timestamp, serverTimestamp) {
  const record = {
    name: seed.name,
    organizationId: seed.organizationId || seed.organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    organization: seed.organization,
    location: seed.location,
    dates: {
      start: Timestamp.fromDate(new Date(seed.startDate)),
      end: Timestamp.fromDate(new Date(seed.endDate)),
    },
    seekingInstructors: seed.seekingInstructors,
    seekingPerformers: seed.seekingPerformers,
    description: seed.description,
    region: seed.region,
    status: "upcoming",
    tags: seed.tags,
    source: "curated",
    moderationStatus: "approved",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (seed.websiteUrl) record.websiteUrl = seed.websiteUrl;
  if (seed.imageUrl) record.imageUrl = seed.imageUrl;
  if (seed.socialLinks) record.socialLinks = seed.socialLinks;
  const size = toSize(seed.estimatedSize);
  if (size) record.estimatedSize = size;
  return record;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
