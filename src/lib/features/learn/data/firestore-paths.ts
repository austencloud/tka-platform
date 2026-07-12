/**
 * Firestore paths for the Learn module
 *
 * Centralizes all document/collection path construction
 * for learning progress and quiz history.
 */

/**
 * Path to the user's current learning progress document.
 * Single document containing aggregated progress state.
 */
export function getUserLearningProgressPath(userId: string): string {
  return `users/${userId}/learningProgress/current`;
}

/**
 * Path to the user's quiz history collection.
 * Append-only log of individual quiz attempts.
 */
export function getUserQuizHistoryPath(userId: string): string {
  return `users/${userId}/quizHistory`;
}

/**
 * Path to the user's play-arcade progress collection.
 * A single document ("current") holds aggregated per-game bests, stars, and
 * level unlocks — the Play arcade's counterpart to learningProgress.
 *
 * Returns the COLLECTION path, not the doc path: firestoreGet/firestoreSet
 * (src/lib/shared/firestore/firestore-crud.ts) take collection path + doc id
 * as separate arguments (see play/services/play-progress-store.ts), unlike
 * getUserLearningProgressPath which is consumed by raw firebase/firestore
 * doc() calls that accept a single combined path.
 */
export function getUserPlayProgressPath(userId: string): string {
  return `users/${userId}/playProgress`;
}
