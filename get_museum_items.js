import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function getItems() {
  const snapshot = await db.collection("museumDev").get();
  
  const items = [];
  snapshot.forEach(doc => {
    items.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return items;
}

const items = await getItems();

// Filter by "lore" tag or related titles
const loreItems = items.filter(item => {
  const tags = item.tags || [];
  const title = (item.title || "").toLowerCase();
  return tags.includes("lore") || 
         title.includes("lore") || 
         title.includes("tone") ||
         title.includes("lethe") ||
         title.includes("chosen vessel") ||
         title.includes("emotional") ||
         title.includes("runtime") ||
         title.includes("tightrope") ||
         title.includes("world bible") ||
         item.type === "session";
});

// Group by type
const byType = {};
loreItems.forEach(item => {
  if (!byType[item.type]) byType[item.type] = [];
  byType[item.type].push(item);
});

console.log("=== LORE & NARRATIVE ITEMS ===\n");

Object.keys(byType).forEach(type => {
  const items = byType[type];
  console.log(`${type.toUpperCase()} (${items.length}):`);
  items.forEach(item => {
    const status = item.status || "new";
    const tags = (item.tags || []).join(", ");
    console.log(`  ${item.id.substring(0, 8)}... | ${status} | ${(item.title || "UNTITLED").substring(0, 80)}`);
    if (tags) console.log(`    Tags: ${tags}`);
    if (item.verdict) console.log(`    Verdict: ${item.verdict}`);
  });
  console.log();
});

// Count stats
const newCount = loreItems.filter(i => i.status === "new").length;
const inProgressCount = loreItems.filter(i => i.status === "in-progress").length;
const completedCount = loreItems.filter(i => i.status === "completed").length;
const decisions = loreItems.filter(i => i.type === "decision");
const decisionsWithVerdicts = decisions.filter(i => i.verdict).length;
const questions = loreItems.filter(i => i.type === "question");
const answeredQuestions = questions.filter(i => i.answered).length;
const auditItems = loreItems.filter(i => (i.tags || []).includes("audit")).length;

console.log("\n=== SUMMARY STATS ===");
console.log(`Total Items: ${loreItems.length}`);
console.log(`Status: ${newCount} new, ${inProgressCount} in-progress, ${completedCount} completed`);
console.log(`Decisions: ${decisions.length} (${decisionsWithVerdicts} with verdicts)`);
console.log(`Questions: ${questions.length} (${answeredQuestions} answered)`);
console.log(`Audit Items: ${auditItems}`);
