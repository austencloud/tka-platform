/**
 * Pure Firestore REST Value codec.
 *
 * Kept separate from `firestore-rest.ts` so Cloudflare-facing server routes can
 * decode public REST documents without importing the service-account client or
 * its Node-only local credential fallback.
 */

export interface FirestoreGeoPoint {
  latitude: number;
  longitude: number;
}

export type FirestoreValue =
  | { nullValue: null | string }
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number | string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: FirestoreGeoPoint }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: FirestoreFields } };

export type FirestoreFields = Record<string, FirestoreValue>;

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Firestore cannot store a non-finite number");
    }
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        ...(value.length > 0
          ? { values: value.map((item) => toFirestoreValue(item)) }
          : {}),
      },
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields(value as Record<string, unknown>),
      },
    };
  }

  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

export function toFirestoreFields(
  value: Record<string, unknown>
): FirestoreFields {
  const fields: FirestoreFields = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === undefined) continue;
    fields[key] = toFirestoreValue(fieldValue);
  }
  return fields;
}

/**
 * Decode a Firestore REST Value into data that SvelteKit can serialize.
 *
 * Timestamp, bytes, and reference values intentionally remain strings. An
 * integer outside JavaScript's safe range also remains a string so decoding
 * never silently changes its value.
 */
export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return { ...value.geoPointValue };
  if ("integerValue" in value) {
    const parsed = Number(value.integerValue);
    return Number.isSafeInteger(parsed) ? parsed : value.integerValue;
  }
  if ("doubleValue" in value) {
    return typeof value.doubleValue === "number"
      ? value.doubleValue
      : Number(value.doubleValue);
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  }

  return fromFirestoreFields(value.mapValue.fields ?? {});
}

export function fromFirestoreFields(
  fields: FirestoreFields
): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    decoded[key] = fromFirestoreValue(value);
  }
  return decoded;
}
