/**
 * Prop color channel.
 *
 * TKA distinguishes the two hands / props by color-coded channels.
 * `blue` is the left prop channel, `red` is the right prop channel.
 */
export const PropColor = {
  blue: "blue",
  red: "red",
} as const;

export type PropColor = (typeof PropColor)[keyof typeof PropColor];

export const PROP_COLORS: readonly PropColor[] = Object.freeze(
  Object.values(PropColor)
);
