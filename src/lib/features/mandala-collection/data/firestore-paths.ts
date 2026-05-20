export function getUserMandalaCollectionPath(userId: string): string {
  return `users/${userId}/mandala-collection`;
}

export function getUserMandalaPath(userId: string, mandalaId: string): string {
  return `users/${userId}/mandala-collection/${mandalaId}`;
}
