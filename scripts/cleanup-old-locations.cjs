/**
 * Cleanup script for old location data
 *
 * Removes location entries that use the old schema (exact coordinates)
 * Users will need to re-share their location using the new city-level flow
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function cleanupOldLocations() {
  console.log('🔍 Checking for old location data...\n');

  try {
    const locationsRef = db.collection('userLocations');
    const snapshot = await locationsRef.get();

    if (snapshot.empty) {
      console.log('✅ No location data found. Nothing to clean up.');
      return;
    }

    let oldDataCount = 0;
    let newDataCount = 0;
    const docsToDelete = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Old schema has 'coordinates' field (exact location)
      // New schema has 'cityCenterCoordinates', 'city', and 'country'
      if (data.coordinates && !data.cityCenterCoordinates) {
        oldDataCount++;
        docsToDelete.push({
          id: doc.id,
          data: data
        });
      } else if (data.cityCenterCoordinates && data.city && data.country) {
        newDataCount++;
      }
    });

    console.log(`📊 Found ${snapshot.size} total location entries:`);
    console.log(`   - ${oldDataCount} using old schema (exact coordinates)`);
    console.log(`   - ${newDataCount} using new schema (city-level)`);
    console.log('');

    if (oldDataCount === 0) {
      console.log('✅ All location data is already using the new schema. No cleanup needed.');
      return;
    }

    console.log('📋 Documents to delete:');
    docsToDelete.forEach((doc) => {
      console.log(`   - User: ${doc.id}`);
      console.log(`     Old data: ${JSON.stringify(doc.data.coordinates)}`);
    });
    console.log('');

    // Delete old entries
    console.log('🗑️  Deleting old location data...');
    const batch = db.batch();
    docsToDelete.forEach((doc) => {
      batch.delete(locationsRef.doc(doc.id));
    });

    await batch.commit();

    console.log('');
    console.log('✅ Cleanup complete!');
    console.log(`   Deleted ${oldDataCount} old location entries`);
    console.log('');
    console.log('ℹ️  Users will need to re-share their location using the new city-level flow.');
    console.log('   Their consent preferences have been preserved.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupOldLocations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
