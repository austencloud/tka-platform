/**
 * Type augmentation for @austencloud/chip-toggle ChipGroupProps.
 *
 * The published package only exposes layout/gap/wrap. Our codebase passes
 * additional props (label, variant, columns) that the component silently
 * accepts via Svelte's attribute forwarding. This declaration merges
 * those props into the interface so TypeScript stops flagging them.
 */
declare module "@austencloud/chip-toggle/src/types.js" {
  interface ChipGroupProps {
    /** Section label rendered above the chip group */
    label?: string;
    /** Layout variant: row (horizontal) or grid */
    variant?: "row" | "grid";
    /** Number of columns when variant is grid */
    columns?: number;
  }
}
