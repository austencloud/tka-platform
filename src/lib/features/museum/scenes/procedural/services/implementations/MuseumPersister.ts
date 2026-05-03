import {
  getDatabase,
  ref,
  get,
  set,
  remove,
  update,
} from "firebase/database";
import type { MuseumMetadata } from "../contracts/types";
import type { MuseumExhibit } from "../../domain/museum-types";

export class MuseumPersister {
  private get db() {
    return getDatabase();
  }

  async loadMuseum(userId: string) {
    const metaSnap = await get(ref(this.db, `museums/${userId}/meta`));
    if (!metaSnap.exists()) return null;

    const meta = metaSnap.val() as MuseumMetadata;

    const exhibitsSnap = await get(ref(this.db, `museums/${userId}/exhibits`));
    const exhibits = new Map<string, MuseumExhibit>();

    if (exhibitsSnap.exists()) {
      const data = exhibitsSnap.val() as Record<string, MuseumExhibit>;
      for (const [slotId, exhibit] of Object.entries(data)) {
        exhibits.set(slotId, { ...exhibit, slotId });
      }
    }

    return { meta, exhibits };
  }

  async saveExhibit(userId: string, slotId: string, sequenceId: string) {
    const exhibit: MuseumExhibit = {
      slotId,
      sequenceId,
      assignedAt: Date.now(),
    };
    await set(ref(this.db, `museums/${userId}/exhibits/${slotId}`), exhibit);
    await update(ref(this.db, `museums/${userId}/meta`), { updatedAt: Date.now() });
  }

  async removeExhibit(userId: string, slotId: string) {
    await remove(ref(this.db, `museums/${userId}/exhibits/${slotId}`));
    await update(ref(this.db, `museums/${userId}/meta`), { updatedAt: Date.now() });
  }

  async updateMetadata(userId: string, meta: Partial<MuseumMetadata>) {
    await update(ref(this.db, `museums/${userId}/meta`), meta);
  }

  async createMuseum(userId: string, name: string) {
    const meta: MuseumMetadata = {
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: true,
    };
    await set(ref(this.db, `museums/${userId}/meta`), meta);
  }
}
