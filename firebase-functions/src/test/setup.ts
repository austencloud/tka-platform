/**
 * Jest Test Setup for Firebase Functions
 *
 * This file runs before all tests and sets up the Firebase test environment.
 * Uses firebase-functions-test for offline testing without hitting production.
 */

import functionsTest from 'firebase-functions-test';

// Initialize in offline mode (doesn't require credentials)
// This mocks Firestore, Auth, etc.
const testEnv = functionsTest();

// Set required environment variables
process.env.GCLOUD_PROJECT = 'tka-composer-test';
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: 'tka-composer-test',
});

// Clean up after all tests
afterAll(() => {
  testEnv.cleanup();
});

export { testEnv };
