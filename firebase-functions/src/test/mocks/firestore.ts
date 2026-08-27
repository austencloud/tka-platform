/**
 * Firestore Mocks for Testing
 *
 * Provides mock implementations of Firestore operations
 * that track calls and allow assertions.
 */

import * as admin from 'firebase-admin';

// In-memory data store
const mockData: Map<string, Map<string, Record<string, unknown>>> = new Map();

export function clearMockData(): void {
  mockData.clear();
}

/**
 * Set mock data for a collection/document
 */
export function setMockDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): void {
  if (!mockData.has(collection)) {
    mockData.set(collection, new Map());
  }
  mockData.get(collection)!.set(docId, data);
}

/**
 * Get mock data for a document
 */
export function getMockDoc(
  collection: string,
  docId: string
): Record<string, unknown> | undefined {
  return mockData.get(collection)?.get(docId);
}

export function deleteMockDoc(collection: string, docId: string): void {
  mockData.get(collection)?.delete(docId);
}

export function getMockCollection(
  collection: string
): Array<{ id: string; data: Record<string, unknown> }> {
  const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
  const collData = mockData.get(collection);
  if (collData) {
    collData.forEach((data, id) => {
      docs.push({ id, data });
    });
  }
  return docs;
}

/**
 * Create a mock Firestore Timestamp
 */
export function mockTimestamp(date: Date = new Date()): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Create a timestamp from milliseconds ago
 */
export function timestampMinutesAgo(minutes: number): admin.firestore.Timestamp {
  return mockTimestamp(new Date(Date.now() - minutes * 60 * 1000));
}

export function timestampHoursAgo(hours: number): admin.firestore.Timestamp {
  return mockTimestamp(new Date(Date.now() - hours * 60 * 60 * 1000));
}
