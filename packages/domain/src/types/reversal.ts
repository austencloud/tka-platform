export interface ReversalType {
  description: string;
  propBehavior: string;
  handBehavior?: string;
  rotationEffect?: string;
  disruptionLevel?: string;
  notation: string;
  intuitionLevel?: string;
  attentionMarker?: string;
  transitions: Record<string, boolean>;
}
