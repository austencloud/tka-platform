export type EscapeLayerResult = "dismissed" | "blocked" | "unhandled";

export interface EscapeLayerRegistration {
  id: string;
  dismiss: () => void;
  canDismiss: () => boolean;
}

export interface IEscapeLayerManager {
  register(layer: EscapeLayerRegistration): () => void;
  unregister(id: string): void;
  hasLayer(): boolean;
  dismissTopLayer(): EscapeLayerResult;
}
