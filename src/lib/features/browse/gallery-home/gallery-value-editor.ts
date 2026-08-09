/** Keep an applied zero-count value removable while blocking new dead ends. */
export function valueDisabled(count: number, applied: boolean): boolean {
  return count === 0 && !applied;
}
