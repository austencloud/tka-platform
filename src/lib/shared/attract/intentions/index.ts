/**
 * The bag. Order is irrelevant — the mind scores all of it every tick.
 *
 * Intentions remain the presenter's visible action vocabulary. The activity
 * layer decides which short train of thought owns them; this file only defines
 * the complete set of actions the planner may use.
 */

import type { Intention } from "../domain/intention";
import { BUILD_INTENTIONS } from "./build";
import { GENERATE_INTENTIONS } from "./generate";
import { SEQUENCE_ACTION_INTENTIONS } from "./sequence-actions";
import { PLAYBACK_INTENTIONS } from "./playback";
import { EFFECT_INTENTIONS, PROP_INTENTIONS } from "./effects";
import { INSPECT_INTENTIONS } from "./inspect";
import { BROWSE_INTENTIONS } from "./browse";
import { EXPLORE_INTENTIONS } from "./explore";
import { ADMIRE_INTENTIONS } from "./admire";
import { INVITE_INTENTIONS } from "./invite";

export const ALL_INTENTIONS: Intention[] = [
  ...BUILD_INTENTIONS,
  ...GENERATE_INTENTIONS,
  ...SEQUENCE_ACTION_INTENTIONS,
  ...PLAYBACK_INTENTIONS,
  ...EFFECT_INTENTIONS,
  ...PROP_INTENTIONS,
  ...INSPECT_INTENTIONS,
  ...BROWSE_INTENTIONS,
  ...EXPLORE_INTENTIONS,
  ...ADMIRE_INTENTIONS,
  ...INVITE_INTENTIONS,
];
