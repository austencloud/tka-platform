import { z } from "zod";

/**
 * Zod schema that coerces a Firestore Timestamp (or any `{ toDate() }`) into a
 * JS Date. Lives in its own module — with ZERO firebase/auth imports — so it is
 * safe to import from domain schemas that run inside the composition worker.
 *
 * `firestore-helpers.ts` imports `authState` (→ scan-attribution → $app/navigation
 * → SvelteKit client `fetcher.js`, which references `window` and crashes a Web
 * Worker on module-eval). Domain schema files only need `firestoreDate`, so they
 * import it from here instead of from `firestore-helpers` / the firestore barrel.
 */
export const firestoreDate = z.preprocess((val) => {
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate(): Date }).toDate();
  }
  return val;
}, z.coerce.date());

/**
 * `firestoreDate.optional()` that additionally tolerates an UNRESOLVED
 * serverTimestamp sentinel ({ _methodName: "serverTimestamp" }) persisted
 * verbatim — a write-path bug observed on real library docs (2026-07-01,
 * users/.../sequences/b231098b-...). Coercing the sentinel makes an Invalid
 * Date and fails the WHOLE document parse, which firestoreGet reports as null —
 * indistinguishable from not-found, so the sequence shows as "missing" while
 * visibly existing. The sentinel guard sits OUTSIDE the optional wrap (zod
 * checks the pre-preprocess input for undefined), mapping it to "absent".
 * Required timestamp fields keep using `firestoreDate` and still fail loudly.
 */
export const firestoreDateLenient = z.preprocess(
  (val) =>
    val && typeof val === "object" && "_methodName" in val ? undefined : val,
  firestoreDate.optional()
);
