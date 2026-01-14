/**
 * Test which import triggers the DI container error
 */

console.log('Starting import test...');

try {
  console.log('Importing create-node-pictograph-preparer...');
  import('./node/create-node-pictograph-preparer').then(() => {
    console.log('✓ create-node-pictograph-preparer imported successfully');
  }).catch(err => {
    console.error('✗ create-node-pictograph-preparer import failed:', err.message);
    console.error('Stack:', err.stack);
  });
} catch (error) {
  console.error('✗ Synchronous error:', error);
}
