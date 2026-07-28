import { getLibrarySaveService } from "$lib/features/library/get-library-save-service";
import { openSendAttachmentSheet } from "$lib/shared/inbox/state/send-sequence-state.svelte";
import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  IntakeClassification,
  IntakeItem,
  IntakeProblem,
} from "../domain/share-intake-models";
import { openFiledCard } from "./open-filed-card";

type CardItem = Extract<IntakeItem, { kind: "card" }>;
type ImageItem = Extract<IntakeItem, { kind: "image" }>;

// Array.filter does NOT narrow a union on its own; these predicates are what
// make `item.code` and `item.file` legal below without a cast.
const isCard = (item: IntakeItem): item is CardItem => item.kind === "card";
const isImage = (item: IntakeItem): item is ImageItem => item.kind === "image";

export interface FiledCard {
  code: string;
  sequence: SequenceData;
  /** False for printed deck cards with no referenceable doc. */
  docBacked: boolean;
  /**
   * The id a caller should open. Equals sequence.id when docBacked; otherwise
   * the id produced by saving the printed card into My Library.
   */
  targetId: string;
}

export interface RouteResult {
  cards: FiledCard[];
  /**
   * Codes that did not resolve. Every entry here ALSO has exactly one
   * `resolve-failed` problem in `problems` - this array is the retry list, the
   * problem is the user-facing record. The runner must not synthesize a second
   * problem from this array.
   */
  unresolved: string[];
  /**
   * Files that did not reach a destination in this pass: images past the
   * first, and every image in a share where a card won. Sequential batch send
   * with per-item progress and partial-success retry is a cut WE made to keep
   * this plan shippable - see Known accepted limitations. They are REPORTED
   * rather than discarded, and their intake stays as partially-sent.
   */
  queued: File[];
  problems: IntakeProblem[];
  /** What the user is now looking at. Null means nothing reached a screen. */
  opened: "card" | "picker" | null;
}

/**
 * Send a classified intake to its destination - the hop that makes a share
 * visible.
 *
 * Cards resolve through the existing import path, are filed the same way
 * ScanCardSheet files them, and the first one OPENS THE VIEWER. Images open
 * the inbox conversation picker. `duplicate` items are ignored entirely: they
 * are second photos of a card already handled, and sending one as an image
 * would put a picture of a card into a conversation.
 */
export async function routeIntake(
  classification: IntakeClassification,
  userId: string | null,
  context: { receiptId: string }
): Promise<RouteResult> {
  const cards: FiledCard[] = [];
  const unresolved: string[] = [];
  const problems: IntakeProblem[] = [];

  // The same card can be photographed AND linked in the shared text. Resolving
  // it twice costs a second network read and files it twice.
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const code of [
    ...classification.items.filter(isCard).map((item) => item.code),
    ...(classification.textCode ? [classification.textCode] : []),
  ]) {
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }

  for (const code of codes) {
    // Each of these is a network read, and getShortCodeManager() itself throws
    // when DI has not run. One failure must not abandon the remaining codes.
    try {
      const resolution = await getShortCodeManager().resolveForImport(code, userId);
      if (!resolution) {
        unresolved.push(code);
        // ONE problem per unresolved code, authored here. The runner adds none.
        problems.push({
          name: code,
          reason: "resolve-failed",
          detail: "no sequence behind this code",
        });
        continue;
      }
      cards.push(await fileCard(code, resolution));
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      unresolved.push(code);
      problems.push({ name: code, reason: "resolve-failed", detail });
      console.error(`[ShareIntake] Could not resolve ${code}:`, detail);
    }
  }

  const images = classification.items.filter(isImage);
  const queued: File[] = [];
  let opened: "card" | "picker" | null = null;

  const first = cards[0];
  if (first) {
    // Trace 1.13. Throws on a hydration failure; the runner catches it and
    // keeps the record, which is why this is awaited rather than fired off.
    opened = "card";
    await openFiledCard({
      code: first.code,
      sequence: first.sequence,
      extraCards: cards.length - 1,
      word: first.sequence.word || first.sequence.name || "",
    });

    // Cards win a mixed share: the viewer overlay and the inbox picker would
    // otherwise both be on screen fighting for the same back gesture.
    for (const item of images) {
      queued.push(item.file);
      problems.push({
        name: item.file.name,
        reason: "send-dropped",
        detail: "a card in the same share opened the viewer",
      });
    }

    return { cards, unresolved, queued, problems, opened };
  }

  const [firstImage, ...rest] = images;
  if (firstImage) {
    opened = "picker";
    openSendAttachmentSheet(
      {
        type: "image",
        file: firstImage.file,
        // Same id shape MessageComposer.selectImage uses, and the same shape
        // the Storage staging path in
        // services/implementations/MessageImageSender.ts:37-39 expects.
        messageId: crypto.randomUUID(),
        attachmentId: crypto.randomUUID(),
      },
      {
        // The picker carries the intake id so the SEND - not the open - is
        // what resolves the record (trace 2.14).
        receiptId: context.receiptId,
        ...(classification.residualText
          ? { note: classification.residualText }
          : {}),
      }
    );

    for (const item of rest) {
      queued.push(item.file);
      problems.push({ name: item.file.name, reason: "send-dropped" });
    }

    // The picker only ever shows ONE image. Without this, the other N images
    // in a SEND_MULTIPLE share vanish from the user's point of view - they see
    // one picker open and nothing else. Mirrors openFiledCard's extraCards
    // toast (Task 8) for the image side of the same problem.
    if (rest.length > 0) {
      toast.info(
        rest.length === 1
          ? "1 more image is saved — share again to send it."
          : `${rest.length} more images are saved — share again to send them.`
      );
    }
  }

  return { cards, unresolved, queued, problems, opened };
}

async function fileCard(
  code: string,
  resolution: { sequence: SequenceData; docBacked: boolean }
): Promise<FiledCard> {
  if (resolution.docBacked) {
    return {
      code,
      sequence: resolution.sequence,
      docBacked: true,
      targetId: resolution.sequence.id,
    };
  }

  // No referenceable doc behind this card (printed deck cards): save it to My
  // Library under the normal public default, then file it. Exactly the branch
  // ScanCardSheet.svelte:172-227 takes.
  const name = resolution.sequence.word || resolution.sequence.name || "Sequence";
  const saved = await getLibrarySaveService().saveSequence(resolution.sequence, {
    name,
    visibility: "public",
    tags: [],
    notes: "",
  });

  return {
    code,
    sequence: resolution.sequence,
    docBacked: false,
    targetId: saved.sequenceId,
  };
}
