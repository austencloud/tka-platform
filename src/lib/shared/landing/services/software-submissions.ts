// Public "submit your flow arts software" capture for /roots/software. A
// signed-out visitor names a tool; it lands in software_submissions for review.
// Clones the shop_waitlist pattern (waitlist.ts): anyone create, admin read
// (firestore.rules) — needs a rules deploy before it persists. A Pulse trigger
// (pulseSoftwareSubmission) pings the admin on each new doc.
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

export async function submitSoftware(
  name: string,
  url: string,
  notes: string,
  source = "roots-software"
): Promise<void> {
  const firestore = await getFirestoreInstance();
  await addDoc(collection(firestore, "software_submissions"), {
    name: name.trim(),
    url: url.trim(),
    notes: notes.trim(),
    createdAt: serverTimestamp(),
    source,
  });
}
