/**
 * One-off repair for Christofborkott's fused sequence saved with a truncated
 * word ("GI") and a doubled-word name ("IIECCKIIECCK").
 *
 * Correct values were computed by running the doc's blueSoloProp/redSoloProp
 * through the FIXED fuse pipeline (fuseSequences + deriveLettersForSequence
 * against the real CSV dataframes) in
 * src/lib/features/fuse/services/__tests__/fused-word-derivation.test.ts:
 *   word = "IIECCKIIECCK" (matches the doc's stepPairings letters exactly)
 *   name = fusedDisplayName(word) = "IIECCK"
 *
 * Updates ONLY `word` and `name`. Prints before/after.
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DOC_PATH = "users/pN1yIVYGv0PgVmOmqERkpAdSWYG2/sequences/seq_1783511935084_hy071ftoq";
const CORRECT_WORD = "IIECCKIIECCK";
const CORRECT_NAME = "IIECCK";

const ref = db.doc(DOC_PATH);
const before = await ref.get();
if (!before.exists) {
  console.error("Doc not found:", DOC_PATH);
  process.exit(1);
}
const b = before.data();

// Sanity: the stored pairings must still spell the word we're about to write.
const pairingWord = (b.stepPairings ?? []).map((p) => p.letter ?? "").join("");
if (pairingWord !== CORRECT_WORD) {
  console.error(`ABORT: stepPairings spell "${pairingWord}", expected "${CORRECT_WORD}" — doc changed?`);
  process.exit(1);
}

console.log("BEFORE  name:", b.name, "| word:", b.word);
await ref.update({ word: CORRECT_WORD, name: CORRECT_NAME });
const after = (await ref.get()).data();
console.log("AFTER   name:", after.name, "| word:", after.word);
console.log("Done — only word + name updated.");
