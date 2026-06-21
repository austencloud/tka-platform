/**
 * PropUnlockManager — owns the creation counter, the unlocked set, persistence,
 * and milestone firing. Guest-capable (localStorage); members persist to
 * Firestore. Isolated from the member-only achievement services.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  applyClaim,
  defaultCollection,
  mergeCollections,
  recordOne,
  type PropCollection,
} from "../domain/prop-collection";
import { milestonesReached } from "../domain/prop-pool";
import {
  clearGuestCollection,
  loadGuestCollection,
  saveGuestCollection,
} from "./prop-collection-persistence";
import { setPropCollection } from "../state/prop-collection-state.svelte";
import { openPropCelebration } from "../state/prop-celebration-state.svelte";

function propCollectionPath(uid: string): string {
  return `users/${uid}/gamification/propCollection`;
}

/** True when authenticated AND not an anonymous guest. */
function isMember(): boolean {
  const user = auth.currentUser;
  return !!user && !user.isAnonymous;
}

export class PropUnlockManager {
  private collection: PropCollection = defaultCollection();
  private loaded = false;

  /** Load the right source and mirror into rune state. Idempotent per session. */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.collection = isMember()
      ? await this.loadMember()
      : loadGuestCollection();
    setPropCollection(this.collection);
    this.loaded = true;
  }

  private async loadMember(): Promise<PropCollection> {
    const user = auth.currentUser!;
    try {
      const firestore = await getFirestoreInstance();
      const ref = doc(firestore, propCollectionPath(user.uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const fresh = defaultCollection();
        await setDoc(ref, fresh);
        return fresh;
      }
      const data = snap.data() as Partial<PropCollection>;
      return {
        unlockedPropTypes: data.unlockedPropTypes ?? [],
        creationCount: data.creationCount ?? 0,
        pendingPicks: data.pendingPicks ?? 0,
      };
    } catch (error) {
      console.error("[prop-unlock] failed to load member collection:", error);
      return defaultCollection();
    }
  }

  private async persist(): Promise<void> {
    setPropCollection(this.collection);
    if (isMember()) {
      const user = auth.currentUser!;
      try {
        const firestore = await getFirestoreInstance();
        await setDoc(doc(firestore, propCollectionPath(user.uid)), this.collection);
      } catch (error) {
        console.error("[prop-unlock] failed to persist member collection:", error);
      }
    } else {
      saveGuestCollection(this.collection);
    }
  }

  /** Count one created sequence; fire the celebration on the first milestone. */
  async recordCreation(_source: "generate" | "construct"): Promise<void> {
    await this.load();
    const before = milestonesReached(this.collection.creationCount);
    this.collection = recordOne(this.collection);
    const after = milestonesReached(this.collection.creationCount);
    await this.persist();
    // First milestone ever auto-opens the celebration (onboarding delight).
    // Later milestones rely on the redemption badge — no auto-pop.
    if (after > before && after === 1) {
      openPropCelebration();
    }
  }

  /** Claim a locked prop, spending a pending pick. */
  async claimPick(prop: PropType): Promise<void> {
    await this.load();
    this.collection = applyClaim(this.collection, prop);
    await this.persist();
  }

  /** Merge the guest localStorage collection into the member Firestore doc. */
  async mergeGuestCollection(): Promise<void> {
    if (!isMember()) return;
    const guest = loadGuestCollection();
    const member = await this.loadMember();
    this.collection = mergeCollections(guest, member);
    this.loaded = true;
    await this.persist();
    clearGuestCollection();
  }

  get pendingPicks(): number {
    return this.collection.pendingPicks;
  }
}
