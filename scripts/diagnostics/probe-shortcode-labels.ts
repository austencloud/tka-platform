/** One-off: why does 0017's payload derive "VΛY-Σ-…" when its label says
 *  "UΛZ-Δ-…"? Prints the payload's own letters (decoded), the embedded
 *  sequenceData word/letters if present, and the per-beat dataframe match.
 *
 *    TKA_ADMIN=1 npx tsx scripts/diagnostics/probe-shortcode-labels.ts [code]
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

const CODE = process.argv[2] ?? "0017";

async function main(): Promise<void> {
  const { db, isAdmin } = (await initFirestore()) as {
    db: { collection(p: string): { doc(id: string): { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> } } };
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("TKA_ADMIN=1 required");

  const snap = await db.collection("shortcodes").doc(CODE).get();
  if (!snap.exists) throw new Error(`shortcodes/${CODE} not found`);
  const data = snap.data() ?? {};

  console.log("stored sequence:", data["sequence"]);
  console.log("stored sequenceName:", data["sequenceName"]);
  console.log("sequenceId:", data["sequenceId"], "| ownerId:", data["ownerId"]);

  const embedded = data["sequenceData"] as { word?: string; steps?: Array<{ letter?: string }> } | undefined;
  if (embedded) {
    console.log("embedded word:", embedded.word);
    console.log(
      "embedded step letters:",
      (embedded.steps ?? []).map((s) => s.letter ?? "·").join("")
    );
  } else {
    console.log("no embedded sequenceData");
  }

  if (typeof data["encoded"] === "string") {
    const decoded = (await decodeSequenceFromQR(data["encoded"] as string)) as SequenceData;
    console.log("decoded word field:", decoded.word);
    console.log(
      "decoded step letters:",
      (decoded.steps ?? []).map((s) => (s as { letter?: string }).letter ?? "·").join("")
    );
    const first = decoded.steps?.[0] as Record<string, unknown> | undefined;
    console.log("decoded first step motions:", JSON.stringify(first?.["motions"] ?? null)?.slice(0, 400));
  } else {
    console.log("no encoded blob");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
