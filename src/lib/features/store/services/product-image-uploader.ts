// One-shot product image upload to Firebase Storage, modeled on the feedback
// image-stager pattern (lazy firebase/storage import, getStorageInstance).
// Returns the public download URL to store on the product's coverImageUrl.
// Note: needs a Storage rule for /product-images before it persists in prod.
import { getStorageInstance } from "$lib/shared/auth/firebase";

export async function uploadProductImage(
  file: File,
  keyHint = "staging"
): Promise<string> {
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const storage = await getStorageInstance();
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `product-images/${keyHint}/${Date.now()}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
