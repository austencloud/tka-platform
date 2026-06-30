/**
 * ChoreoSheetRepository — Firestore CRUD for printable choreo sheets.
 *
 * A sheet is a lightweight roster: an ordered list of sequence references plus
 * layout settings and metadata. It deliberately stores NO hydrated steps — those
 * are re-derived from the user's library at render time, exactly as the
 * ChoreoSheet type's docstring promises.
 *
 * This mirrors LibraryRepository's conventions: user-owned data lives under
 * `users/{uid}/…` (LibraryRepository uses `users/{uid}/sequences` via
 * getUserSequencesPath), the owner is the signed-in user from
 * authState.effectiveUserId (LibraryRepository.getUserId → here, the shared
 * requireAuth()), and Date ⇄ Firestore Timestamp crosses the boundary through
 * the shared firestore helpers — `firestoreDate` coerces Timestamp → Date on
 * read (the same path LibraryRepository.getSequence takes via firestoreGet), and
 * firestoreSet stamps updatedAt with serverTimestamp on write.
 */

import { z } from "zod";
import {
  firestoreGet,
  firestoreList,
  firestoreSet,
  firestoreDelete,
  firestoreDate,
  requireAuth,
} from "$lib/shared/firestore";
import {
  DEFAULT_SHEET_LAYOUT,
  type ChoreoSheet,
} from "../domain/types/choreo-sheet";

// Per-user subcollection — the same shape LibraryRepository uses for its own
// user-owned data (`users/{uid}/sequences`, `/acts`, `/tags`). Scopes a sheet to
// its owner and keeps it under the existing per-user Firestore rules. Built
// inline rather than added to the library's firestore-paths.ts so the Write
// module doesn't reach across into the Library module's path registry.
function sheetsPath(ownerId: string): string {
  return `users/${ownerId}/choreoSheets`;
}

// Layout is read leniently: every field falls back to its v1 default via .catch
// so a doc written by an older or newer build still parses instead of being
// dropped whole by the validator (firestoreGet returns null on a hard parse
// failure). paperSize/orientation are fixed in v1 but kept resilient for later
// 'a4'/portrait variants. The resolved output type is exactly ChoreoSheetLayout.
const SheetLayoutSchema = z
  .object({
    columns: z.number().catch(DEFAULT_SHEET_LAYOUT.columns),
    rowsPerPage: z.number().catch(DEFAULT_SHEET_LAYOUT.rowsPerPage),
    paperSize: z.literal("letter").catch("letter"),
    orientation: z.literal("landscape").catch("landscape"),
    showStepNumbers: z.boolean().catch(DEFAULT_SHEET_LAYOUT.showStepNumbers),
    groupSeparator: z
      .enum(["rule", "gap", "none"])
      .catch(DEFAULT_SHEET_LAYOUT.groupSeparator),
    keepBlocksTogether: z.boolean().catch(DEFAULT_SHEET_LAYOUT.keepBlocksTogether),
  })
  .catch({ ...DEFAULT_SHEET_LAYOUT });

const ChoreoSheetDocSchema = z.object({
  id: z.string(),
  name: z.string().catch("Untitled Sheet"),
  ownerId: z.string().catch(""),
  sequenceIds: z.array(z.string()).catch([]),
  layout: SheetLayoutSchema,
  // serverTimestamp can read back as a pending null on the writing client; the
  // optional+catch keeps the doc parseable and toSheet supplies the fallback.
  createdAt: firestoreDate.optional().catch(undefined),
  updatedAt: firestoreDate.optional().catch(undefined),
});

type ChoreoSheetDoc = z.infer<typeof ChoreoSheetDocSchema>;

function toSheet(doc: ChoreoSheetDoc): ChoreoSheet {
  return {
    id: doc.id,
    name: doc.name,
    ownerId: doc.ownerId,
    sequenceIds: doc.sequenceIds,
    layout: doc.layout,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

export class ChoreoSheetRepository {
  /**
   * List a user's sheets, most-recently-edited first. Defaults to the signed-in
   * user; an explicit ownerId mirrors LibraryRepository.getUserSequences(userId)
   * for reading another user's roster.
   */
  async listSheets(ownerId?: string): Promise<ChoreoSheet[]> {
    const uid = ownerId ?? requireAuth();
    const docs = await firestoreList(sheetsPath(uid), ChoreoSheetDocSchema, {
      orderBy: [{ field: "updatedAt", direction: "desc" }],
    });
    return docs.map(toSheet);
  }

  async loadSheet(id: string): Promise<ChoreoSheet | null> {
    const uid = requireAuth();
    const doc = await firestoreGet(sheetsPath(uid), id, ChoreoSheetDocSchema);
    return doc ? toSheet(doc) : null;
  }

  /**
   * Upsert. Writes the full document (no merge) so removed sequence ids and
   * cleared layout fields actually disappear. updatedAt is bumped server-side by
   * firestoreSet; createdAt is carried from the sheet so it survives re-saves.
   * Stores only references + layout + metadata — never hydrated steps. The path
   * and stored ownerId both come from the signed-in user, the same way
   * LibraryRepository.saveSequence trusts getUserId() over the incoming object.
   */
  async saveSheet(sheet: ChoreoSheet): Promise<ChoreoSheet> {
    const uid = requireAuth();
    await firestoreSet(
      sheetsPath(uid),
      sheet.id,
      {
        name: sheet.name,
        ownerId: uid,
        sequenceIds: [...sheet.sequenceIds],
        layout: { ...sheet.layout },
        createdAt: sheet.createdAt,
      } as Record<string, unknown>,
      { trackOffline: true, repoName: "choreo-sheets" },
    );
    return { ...sheet, ownerId: uid, updatedAt: new Date() };
  }

  async deleteSheet(id: string): Promise<void> {
    const uid = requireAuth();
    await firestoreDelete(sheetsPath(uid), id, {
      trackOffline: true,
      repoName: "choreo-sheets",
    });
  }
}

// Module-level singleton getter — the factory-getter pattern this repo uses for
// data-access services (see getLibraryRepository). No DI container.
let instance: ChoreoSheetRepository | null = null;
export function getChoreoSheetRepository(): ChoreoSheetRepository {
  return (instance ??= new ChoreoSheetRepository());
}
