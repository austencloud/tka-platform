const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function check() {
  // Find the public sequence first to get the sourceRef
  const pubSnap = await db.collection("publicSequences").get();
  let targetSourceRef = null;
  let targetPublicDoc = null;

  pubSnap.forEach((doc) => {
    const d = doc.data();
    if (d.word && d.word.includes("LΣ-Z-Φ")) {
      targetSourceRef = d.sourceRef;
      targetPublicDoc = { id: doc.id, ...d };
    }
  });

  if (targetPublicDoc) {
    console.log("=== PUBLIC INDEX DOC ===");
    console.log("  word:", targetPublicDoc.word);
    console.log("  loopType:", targetPublicDoc.loopType);
    console.log("  isCircular:", targetPublicDoc.isCircular);
    console.log("  sourceRef:", targetPublicDoc.sourceRef);
  }

  if (targetSourceRef) {
    console.log("\n=== USER SOURCE DOC ===");
    const userDoc = await db.doc(targetSourceRef).get();
    if (userDoc.exists) {
      const d = userDoc.data();
      console.log("  word:", d.word);
      console.log("  loopType:", d.loopType);
      console.log("  isCircular:", d.isCircular);
      console.log("  has steps:", !!(d.steps && d.steps.length > 0));
      console.log("  step count:", d.steps ? d.steps.length : 0);
    } else {
      console.log("  NOT FOUND");
    }
  }

  // Also sample 5 random user documents to check if ANY have loopType
  console.log("\n=== SAMPLING USER DOCS FOR loopType ===");
  const samplePub = [];
  pubSnap.forEach((doc) => {
    const d = doc.data();
    if (d.loopType && d.sourceRef && samplePub.length < 5) {
      samplePub.push({ sourceRef: d.sourceRef, publicLoopType: d.loopType, word: d.word });
    }
  });

  for (const s of samplePub) {
    const userDoc = await db.doc(s.sourceRef).get();
    if (userDoc.exists) {
      const d = userDoc.data();
      console.log(`  ${s.word}: public=${s.publicLoopType}, user=${d.loopType || "MISSING"}, isCircular=${d.isCircular}`);
    }
  }
}

check().then(() => process.exit(0));
