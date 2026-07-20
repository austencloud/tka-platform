import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";
import { getDeviceId } from "$lib/shared/foundation/services/device-id";

// The device id itself now lives in foundation/services/device-id.ts, which has
// no Firebase imports — analytics reads it at PostHog init, and pulling
// firebase/firestore into that graph is not an option. Re-exported here so the
// existing call sites keep importing it from where they always have.
export { getDeviceId };

export async function linkDeviceToUser(userId: string): Promise<void> {
  const deviceId = getDeviceId();
  try {
    const firestore = await getFirestoreInstance();
    const ref = doc(firestore, "users", userId, "devices", deviceId);
    await setDoc(
      ref,
      {
        deviceId,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        userAgent: navigator.userAgent,
      },
      { merge: true },
    );
  } catch (error) {
    console.error("[device-id-service] Failed to link device to user:", error);
    throw error;
  }
}
