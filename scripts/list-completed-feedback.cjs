const admin = require('firebase-admin');
const { readFileSync } = require('fs');

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('feedback').where('status', '==', 'completed').get();
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  items.forEach(item => {
    console.log('---');
    console.log('ID:', item.id);
    console.log('Type:', item.type);
    console.log('Title:', item.title || '(no title)');
    console.log('Description:', (item.description || '').substring(0, 300));
    console.log('Module:', item.module, '/ Tab:', item.tab);
    console.log('Admin Notes:', item.adminNotes || '(none)');
    console.log('Resolution:', item.resolution || '(none)');
    console.log('Internal Only:', item.isInternalOnly || false);
    console.log('');
  });
}
main();
