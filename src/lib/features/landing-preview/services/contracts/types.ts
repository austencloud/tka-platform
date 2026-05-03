import type { VideoPerformer, LinkedSequence, VideoCropData, VideoSnipData } from "../../types";

/**
 * Interface for persisting video curator data to Firestore
 */
export interface VideoUpdateData {
  title?: string | null;
  category?: string | null;
  tags?: string[];
  featured?: boolean;
  performers?: VideoPerformer[];
  linkedSequences?: LinkedSequence[];
  excluded?: boolean;
  crop?: VideoCropData | null;
  snip?: VideoSnipData | null;
}
