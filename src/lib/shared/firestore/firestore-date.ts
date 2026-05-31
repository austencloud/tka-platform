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
