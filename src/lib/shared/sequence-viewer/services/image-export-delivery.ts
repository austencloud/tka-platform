export interface ImageExportDeliveryCallbacks {
  onSuccess: (message: string) => void;
  onHaptic: (type: "success" | "error" | "selection") => void;
  onCanceled?: () => void;
}

/** Keep native-share dismissal distinct from a completed image delivery. */
export function reportImageExportDelivery(
  callbacks: ImageExportDeliveryCallbacks,
  shared: boolean,
  shareCanceled: boolean
): void {
  if (shareCanceled) {
    callbacks.onCanceled?.();
    return;
  }
  callbacks.onHaptic("success");
  callbacks.onSuccess(shared ? "Card shared!" : "Image exported!");
}
