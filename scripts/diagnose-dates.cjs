/**
 * Diagnostic script: Check what date fields exist on public sequences
 * and their source library documents.
 *
 * Usage: node scripts/diagnose-dates.cjs
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, getDoc, query, limit } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
};

const app = initializeApp(firebaseConfig, "diagnose-dates");
const db = getFirestore(app);

async function diagnose() {
  console.log("=== Querying publicSequences (first 5) ===\n");

  const publicRef = collection(db, "publicSequences");
  const q = query(publicRef, limit(5));
  const snapshot = await getDocs(q);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    console.log(`--- Public: ${data.word || data.name} (${docSnap.id}) ---`);

    // Show ALL fields that look like dates
    for (const [key, value] of Object.entries(data)) {
      if (
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("time") ||
        key.toLowerCase().includes("created") ||
        key.toLowerCase().includes("updated") ||
        key.toLowerCase().includes("published") ||
        key.toLowerCase().includes("added") ||
        key.toLowerCase().includes("birthday") ||
        key === "timestamp"
      ) {
        const displayValue = value && typeof value === "object" && value.toDate
          ? `Timestamp -> ${value.toDate().toISOString()}`
          : value instanceof Date
            ? `Date -> ${value.toISOString()}`
            : `${typeof value}: ${JSON.stringify(value)}`;
        console.log(`  ${key}: ${displayValue}`);
      }
    }

    // Follow sourceRef if it exists
    if (data.sourceRef) {
      console.log(`  sourceRef: ${data.sourceRef}`);
      try {
        const sourceDoc = await getDoc(doc(db, data.sourceRef));
        if (sourceDoc.exists()) {
          const sourceData = sourceDoc.data();
          console.log(`  --- Source doc fields ---`);
          for (const [key, value] of Object.entries(sourceData)) {
            if (
              key.toLowerCase().includes("date") ||
              key.toLowerCase().includes("time") ||
              key.toLowerCase().includes("created") ||
              key.toLowerCase().includes("updated") ||
              key.toLowerCase().includes("published") ||
              key.toLowerCase().includes("added") ||
              key.toLowerCase().includes("birthday") ||
              key === "timestamp"
            ) {
              const displayValue = value && typeof value === "object" && value.toDate
                ? `Timestamp -> ${value.toDate().toISOString()}`
                : value instanceof Date
                  ? `Date -> ${value.toISOString()}`
                  : `${typeof value}: ${JSON.stringify(value)}`;
              console.log(`    ${key}: ${displayValue}`);
            }
          }
          // Also show ALL top-level keys for reference
          console.log(`  --- All source keys: ${Object.keys(sourceData).join(", ")}`);
        } else {
          console.log(`  Source doc NOT FOUND`);
        }
      } catch (err) {
        console.log(`  Source doc error: ${err.message}`);
      }
    } else {
      console.log(`  (no sourceRef)`);
    }
    console.log();
  }

  process.exit(0);
}

diagnose().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
