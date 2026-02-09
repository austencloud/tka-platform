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
