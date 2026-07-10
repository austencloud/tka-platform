export function getUserScene3DCollectionPath(userId: string): string {
  return `users/${userId}/scene-3d-collection`;
}

export function getUserScene3DPath(userId: string, sceneId: string): string {
  return `users/${userId}/scene-3d-collection/${sceneId}`;
}
