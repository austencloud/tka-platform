// src/lib/shared/auth/services/anonymous-upgrade.ts
//
// Anonymous-guest upgrade. On signup we LINK the anonymous Firebase user in
// place (preserving its uid + all its Firestore data) rather than minting a new
// account. If the chosen credential already belongs to a permanent account we
// can't link onto the anon — that's the "collision" case: we sign into the
// existing account instead, and hand back the anon's drafts so the caller can
// offer to import them.
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  type AuthError,
} from "firebase/auth";
import { getAuthInstance } from "$lib/shared/auth/firebase";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
// LibrarySequence extends SequenceData, so it's accepted directly by
// saveSequence(sequence: SequenceData). Imported from its canonical home —
// library-repository.ts re-imports it but does not re-export it.
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";

export type UpgradeStatus = "linked" | "collision-signed-in";

export interface UpgradeResult {
  status: UpgradeStatus;
  /** Drafts captured from the anon session, present only on collision. */
  importable?: LibrarySequence[];
}

const CREDENTIAL_COLLISION = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
]);

function isCollision(error: unknown): error is AuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    CREDENTIAL_COLLISION.has((error as AuthError).code)
  );
}

/** Read the anon user's saved sequences before we risk losing the session. */
async function captureAnonDrafts(anonUid: string): Promise<LibrarySequence[]> {
  try {
    return await getLibraryRepository().getUserSequences(anonUid);
  } catch {
    return [];
  }
}

export async function upgradeAnonymousWithGoogle(): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  try {
    await linkWithPopup(anon, provider);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      const cred = GoogleAuthProvider.credentialFromError(error as AuthError);
      if (cred) await signInWithCredential(auth, cred);
      else throw error;
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

export async function upgradeAnonymousWithFacebook(): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  try {
    await linkWithPopup(anon, provider);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      const cred = FacebookAuthProvider.credentialFromError(error as AuthError);
      if (cred) await signInWithCredential(auth, cred);
      else throw error;
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

export async function upgradeAnonymousWithEmail(
  email: string,
  password: string
): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const credential = EmailAuthProvider.credential(email.trim(), password);
  try {
    await linkWithCredential(anon, credential);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

/**
 * Copy captured anon drafts into the currently-signed-in account's library.
 * Swallows ALREADY_EXISTS (duplicate-content guard); rethrows anything else.
 * Returns the count actually imported.
 */
export async function importDrafts(drafts: LibrarySequence[]): Promise<number> {
  const repo = getLibraryRepository();
  let imported = 0;
  for (const draft of drafts) {
    try {
      await repo.saveSequence(draft);
      imported += 1;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "ALREADY_EXISTS") throw error;
    }
  }
  return imported;
}
