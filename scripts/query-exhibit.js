import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function findExhibitDesignItems() {
  const snapshot = await db
    .collectionGroup("items")
    .where("tags", "array-contains", "exhibit-design")
    .get();

  const items = [];
  snapshot.forEach(doc => {
    items.push({
      id: doc.id,
      ...doc.data()
    });
  });

  // Sort by type then status
  items.sort((a, b) => {
    const typeOrder = { decision: 0, question: 1, session: 2, element: 3 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    const statusOrder = { completed: 0, "in-progress": 1, new: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  console.log(`Found ${items.length} exhibit-design items:\n`);
  
  items.forEach(item => {
    const verb = item.type === 'decision' ? '📌' : item.type === 'question' ? '❓' : item.type === 'session' ? '📝' : '🏛️';
    const statusEmoji = item.status === 'completed' ? '✓' : item.status === 'in-progress' ? '◆' : '◯';
    const verdict = item.verdict ? ` [${item.verdict}]` : '';
    const answered = item.answered ? ' [ANSWERED]' : item.type === 'question' ? ' [UNANSWERED]' : '';
    console.log(`${verb} ${statusEmoji} ${item.id.substring(0,10)} | ${item.type.padEnd(8)} | ${item.title.substring(0, 70)}${verdict}${answered}`);
  });

  console.log(`\n--- SUMMARY ---`);
  const byType = {};
  const byStatus = {};
  items.forEach(item => {
    byType[item.type] = (byType[item.type] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  });
  console.log(`By type:`, byType);
  console.log(`By status:`, byStatus);
  
  const withVerdict = items.filter(i => i.verdict).length;
  const questions = items.filter(i => i.type === 'question');
  const answeredQuestions = questions.filter(q => q.answered).length;
  console.log(`Decisions with verdict: ${withVerdict}/${items.filter(i => i.type === 'decision').length}`);
  console.log(`Questions answered: ${answeredQuestions}/${questions.length}`);

  process.exit(0);
}

findExhibitDesignItems().catch(err => {
  console.error(err);
  process.exit(1);
});
