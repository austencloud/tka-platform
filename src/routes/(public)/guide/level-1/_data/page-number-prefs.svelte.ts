/**
 * Reactive singleton for the printable guide's page-number visibility.
 *
 * Read by `GuidePage` footers and the `PageNumberToggle` button. Drives both the
 * on-screen viewer and the printout (numbers default ON; toggle off when you
 * just want to read, not print).
 */
export const pageNumberPrefs = $state({ show: false });
