// Shop launch waitlist. A signed-out visitor on the Coming Soon page submits an
// email; it lands in shop_waitlist for a launch announcement later. Rule:
// anyone create, admin read (firestore.rules) — needs a deploy before it
// persists.
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

export async function joinWaitlist(email: string): Promise<void> {
  const firestore = await getFirestoreInstance();
  await addDoc(collection(firestore, "shop_waitlist"), {
    email: email.trim().toLowerCase(),
    createdAt: serverTimestamp(),
    source: "shop-coming-soon",
  });
}
