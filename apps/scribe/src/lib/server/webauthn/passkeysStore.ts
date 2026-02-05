import admin from "firebase-admin";
import { getAdminDb } from "../firebaseAdmin";
import { base64urlDecode, base64urlEncode } from "./base64url";
import type {
  AuthenticatorTransportFuture,
  WebAuthnCredential,
} from "@simplewebauthn/server";

export type StoredPasskey = {
  credentialId: string; // base64url
  publicKey: string; // base64url (raw bytes)
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  createdAt: admin.firestore.Timestamp;
  lastUsedAt?: admin.firestore.Timestamp | null;
  name?: string | null;
};

function passkeysCollection(uid: string) {
  return getAdminDb().collection("users").doc(uid).collection("passkeys");
}

export async function listPasskeys(uid: string): Promise<StoredPasskey[]> {
  const snap = await passkeysCollection(uid).get();
  return snap.docs.map((d) => d.data() as StoredPasskey);
}

export async function getPasskey(
  uid: string,
  credentialId: string
): Promise<StoredPasskey | null> {
  const doc = await passkeysCollection(uid).doc(credentialId).get();
  return doc.exists ? (doc.data() as StoredPasskey) : null;
}

export async function upsertPasskey(
  uid: string,
  passkey: StoredPasskey
): Promise<void> {
  await passkeysCollection(uid).doc(passkey.credentialId).set(passkey, {
    merge: true,
  });
}

export async function updatePasskeyCounterAndLastUsed(params: {
  uid: string;
  credentialId: string;
  counter: number;
}): Promise<void> {
  await passkeysCollection(params.uid).doc(params.credentialId).set(
    {
      counter: params.counter,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function storedPasskeyToAllowCredential(passkey: StoredPasskey): {
  id: string;
  transports?: AuthenticatorTransportFuture[];
} {
  return {
    id: passkey.credentialId,
    transports: passkey.transports ?? undefined,
  };
}

export function toStoredPasskey(params: {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  name?: string | null;
}): Omit<StoredPasskey, "createdAt"> {
  return {
    credentialId: params.credentialId,
    publicKey: base64urlEncode(params.publicKey),
    counter: params.counter,
    transports: params.transports ?? undefined,
    name: params.name ?? null,
  };
}

export function storedPasskeyToVerificationCredential(
  passkey: StoredPasskey
): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: base64urlDecode(passkey.publicKey),
    counter: passkey.counter,
    transports: passkey.transports ?? undefined,
  };
}
