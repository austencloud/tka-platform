import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type {
	SyncConnectionState,
	SyncedRoomState,
	ViewMode
} from '../../domain/sync-types';

export interface IDeviceSyncCoordinator {
	readonly connectionState: SyncConnectionState;
	readonly roomState: SyncedRoomState | null;
	viewMode: ViewMode;
	readonly displayName: string;

	/**
	 * Create or join a sync room for a sequence.
	 */
	sync(sequence: SequenceData, displayName: string): Promise<string>;

	/**
	 * Join an existing room by code.
	 */
	joinRoom(roomCode: string, displayName: string): Promise<void>;

	disconnect(): void;

	play(): void;

	pause(): void;

	seek(step: number): void;

	setSpeed(speed: number): void;

	toggleLoop(): void;

	/**
	 * Calculated locally from the current intent using the deterministic equation.
	 */
	getCurrentStep(): number;

	/**
	 * Applies drift correction to smoothly sync to the target position.
	 */
	getCorrectedStep(lastRenderedStep: number): number;

	setStepDuration(durationMs: number): void;

	onRoomStateChange(callback: (state: SyncedRoomState | null) => void): () => void;

	onConnectionStateChange(callback: (state: SyncConnectionState) => void): () => void;

	destroy(): void;
}
