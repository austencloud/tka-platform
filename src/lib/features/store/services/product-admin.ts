// Admin-only product writes. Firestore rules gate these to isAdmin(), so the
// signed-out store can never reach them. The Stripe Price is NOT created here —
// a draft saves with an empty stripePriceId and only becomes purchasable once a
// price is attached (the upsertMerchProductPrice cloud function, build phase).
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Product } from "../domain/models/product";

export type ProductDraft = Omit<Product, "id">;

export async function createProduct(draft: ProductDraft): Promise<string> {
  const firestore = await getFirestoreInstance();
  const ref = await addDoc(collection(firestore, "products"), draft);
  return ref.id;
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductDraft>
): Promise<void> {
  const firestore = await getFirestoreInstance();
  await setDoc(doc(firestore, "products", id), patch, { merge: true });
}

export async function deleteProduct(id: string): Promise<void> {
  const firestore = await getFirestoreInstance();
  await deleteDoc(doc(firestore, "products", id));
}
