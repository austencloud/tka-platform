/**
 * ISequenceViewerNavigator
 *
 * Contract for the sequence viewer navigation function.
 * Not registered in DI since it's a pure function, but the interface
 * documents the expected behavior and options.
 */

export interface OpenSequenceViewerOptions {
	/** Path to return to when closing (e.g., "/browse/gallery") */
	returnPath: string;
	/** Label for back button (e.g., "Browse", "My Library") */
	returnLabel?: string;
	/** Scroll position to restore on return */
	scrollY?: number;
	/** Initial BPM for playback */
	initialBpm?: number;
	/** Initial playback step */
	initialStep?: number;
}
