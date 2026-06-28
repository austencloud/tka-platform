import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Product } from "../domain/models/product";
import { DEMO_PRODUCTS, withPlaceholderCover } from "./demo-products"; // TEMP DEMO FIXTURE — remove before launch

export async function loadActiveProducts(): Promise<Product[]> {
  const firestore = await getFirestoreInstance();
  const productsRef = collection(firestore, "products");
  const q = query(
    productsRef,
    where("status", "==", "active"),
    orderBy("sortOrder", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
}

/**
 * Admin path: every product regardless of status (active, draft, sold-out),
 * ordered by sortOrder. The signed-out store only ever calls
 * loadActiveProducts(); this powers the admin "play with it" view and the
 * Products editor list.
 */
export async function loadAllProducts(): Promise<Product[]> {
  const firestore = await getFirestoreInstance();
  const productsRef = collection(firestore, "products");
  const q = query(productsRef, orderBy("sortOrder", "asc"));
  const snapshot = await getDocs(q);
  // TEMP DEV FALLBACK — fill empty real covers with a gradient placeholder so the
  // grid isn't half-glyph during layout/transition work. Remove before launch.
  const real = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Product)
    .map(withPlaceholderCover);
  // TEMP DEMO FIXTURE — admin view only; interleave by sortOrder. Remove before launch.
  return [...real, ...DEMO_PRODUCTS].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadProduct(productId: string): Promise<Product | null> {
  // TEMP DEMO FIXTURE — serve demos synchronously, BEFORE any Firestore round-trip,
  // so a demo detail page (and its view-transition morph) starts instantly instead
  // of waiting on a getDoc for a doc that doesn't exist. Remove before launch.
  const demo = DEMO_PRODUCTS.find((p) => p.id === productId);
  if (demo) return demo;

  const firestore = await getFirestoreInstance();
  const docRef = doc(firestore, "products", productId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  // TEMP DEV FALLBACK — same placeholder fill as the grid so the detail page and
  // its morph show an image instead of the glyph. Remove before launch.
  return withPlaceholderCover({ id: snapshot.id, ...snapshot.data() } as Product);
}
