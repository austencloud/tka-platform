export function getUserTunnelCollectionPath(userId: string): string {
  return `users/${userId}/tunnel-collection`;
}

export function getUserTunnelPath(userId: string, tunnelId: string): string {
  return `users/${userId}/tunnel-collection/${tunnelId}`;
}
