/**
 * Minimal shape every saved-artifact collection entry shares (tunnels,
 * mandalas, 3D scenes). Feature domains extend this with their payload
 * (snapshot, steps, poster, …).
 */
export interface CollectionEntry {
  id: string;
  name: string;
  createdAt: number;
}
