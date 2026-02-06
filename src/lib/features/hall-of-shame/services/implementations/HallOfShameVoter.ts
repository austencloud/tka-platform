/**
 * HallOfShameVoter - Vote on Hall of Shame entries
 *
 * Handles upvoting with one-vote-per-user enforcement.
 * Votes are permanent and cannot be revoked.
 */

import {
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
	increment,
	collection,
	query,
	where,
	serverTimestamp,
	runTransaction
} from 'firebase/firestore';
import { getFirestoreInstance } from '$lib/shared/auth/firebase';
import type { IAgeVerifier } from '../contracts/IAgeVerifier';
import type { IHallOfShameVoter } from '../contracts/IHallOfShameVoter';
import type { HallOfShameEntry, HallOfShameVote } from '../../domain/models/hall-of-shame-models';

export class HallOfShameVoter implements IHallOfShameVoter {
	private readonly ENTRIES_COLLECTION = 'hallOfShame';
	private readonly VOTES_COLLECTION = 'hallOfShameVotes';

	constructor(private readonly ageVerifier: IAgeVerifier) {}

	async vote(sequenceId: string, voterId: string): Promise<void> {
		// Verify age first
		const isVerified = await this.ageVerifier.isVerified(voterId);
		if (!isVerified) {
			throw new Error('Age verification required to vote');
		}

		// Check if already voted (idempotent)
		const alreadyVoted = await this.hasVoted(sequenceId, voterId);
		if (alreadyVoted) {
			return; // No-op if already voted
		}

		try {
			const firestore = await getFirestoreInstance();

			// Use transaction to ensure atomicity
			await runTransaction(firestore, async (transaction) => {
				// Verify entry exists and is approved
				const entryRef = doc(firestore, this.ENTRIES_COLLECTION, sequenceId);
				const entryDoc = await transaction.get(entryRef);

				if (!entryDoc.exists()) {
					throw new Error('Entry not found');
				}

				const entry = entryDoc.data() as HallOfShameEntry;
				if (entry.status !== 'approved') {
					throw new Error('Can only vote on approved entries');
				}

				// Create vote document
				const voteId = `${voterId}_${sequenceId}`;
				const voteRef = doc(firestore, this.VOTES_COLLECTION, voteId);

				const vote: Omit<HallOfShameVote, 'votedAt'> & { votedAt: ReturnType<typeof serverTimestamp> } = {
					voterId,
					sequenceId,
					votedAt: serverTimestamp()
				};

				transaction.set(voteRef, vote);

				// Increment vote count on entry
				transaction.update(entryRef, {
					voteCount: increment(1)
				});
			});
		} catch (error) {
			console.error('[HallOfShameVoter] Error voting:', error);
			throw error;
		}
	}

	async hasVoted(sequenceId: string, voterId: string): Promise<boolean> {
		try {
			const firestore = await getFirestoreInstance();
			const voteId = `${voterId}_${sequenceId}`;
			const voteRef = doc(firestore, this.VOTES_COLLECTION, voteId);
			const voteDoc = await getDoc(voteRef);

			return voteDoc.exists();
		} catch (error) {
			console.error('[HallOfShameVoter] Error checking vote status:', error);
			return false;
		}
	}

	async getVoteCount(sequenceId: string): Promise<number> {
		try {
			const firestore = await getFirestoreInstance();
			const entryRef = doc(firestore, this.ENTRIES_COLLECTION, sequenceId);
			const entryDoc = await getDoc(entryRef);

			if (!entryDoc.exists()) {
				return 0;
			}

			return (entryDoc.data() as HallOfShameEntry).voteCount ?? 0;
		} catch (error) {
			console.error('[HallOfShameVoter] Error getting vote count:', error);
			return 0;
		}
	}

	async getVotedStatus(sequenceIds: string[], voterId: string): Promise<Map<string, boolean>> {
		const result = new Map<string, boolean>();

		// Initialize all as false
		for (const id of sequenceIds) {
			result.set(id, false);
		}

		if (sequenceIds.length === 0) {
			return result;
		}

		try {
			const firestore = await getFirestoreInstance();

			// Batch check votes - Firestore 'in' query supports up to 30 items
			const BATCH_SIZE = 30;

			for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
				const batch = sequenceIds.slice(i, i + BATCH_SIZE);
				const voteIds = batch.map((seqId) => `${voterId}_${seqId}`);

				// Check which vote documents exist
				for (const voteId of voteIds) {
					const voteRef = doc(firestore, this.VOTES_COLLECTION, voteId);
					const voteDoc = await getDoc(voteRef);

					if (voteDoc.exists()) {
						const sequenceId = voteId.replace(`${voterId}_`, '');
						result.set(sequenceId, true);
					}
				}
			}

			return result;
		} catch (error) {
			console.error('[HallOfShameVoter] Error getting voted status:', error);
			return result;
		}
	}
}
