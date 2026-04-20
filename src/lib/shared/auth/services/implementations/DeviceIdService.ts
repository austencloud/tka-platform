import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreInstance } from "../../firebase";
import type { IDeviceIdService } from "../contracts/IDeviceIdService";

const STORAGE_KEY = "tka:deviceId";

export class DeviceIdService implements IDeviceIdService {
  getDeviceId(): string {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  }

  async linkDeviceToUser(userId: string): Promise<void> {
    const deviceId = this.getDeviceId();
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
        { merge: true }
      );
    } catch (error) {
      console.error("[DeviceIdService] Failed to link device to user:", error);
      throw error;
    }
  }
}
