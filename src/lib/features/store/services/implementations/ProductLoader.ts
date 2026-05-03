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
import type { Product } from "../../domain/models/Product";

export class ProductLoader {
  async loadActiveProducts(): Promise<Product[]> {
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

  async loadProduct(productId: string): Promise<Product | null> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, "products", productId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
}
