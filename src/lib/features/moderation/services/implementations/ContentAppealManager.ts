/**
 * ContentAppealManager Implementation
 *
 * Manages appeals for content flagged by moderation.
 * Stores appeals in Firestore and provides whitelist checking.
 */

import {
	collection,
	addDoc,
	doc,
	getDoc,
	getDocs,
	updateDoc,
	query,
	where,
	orderBy,
	serverTimestamp,
	Timestamp
} from 'firebase/firestore';
import { getFirestoreInstance } from '$lib/shared/auth/firebase';
import type {
	ContentAppeal,
	CreateAppealData,
	ResolveAppealData,
	FlaggedTerm
} from '../../domain/models/content-moderation-models';

const APPEALS_COLLECTION = 'contentAppeals';

/** Firestore document structure for appeals */
interface AppealDocument {
	contentType: 'sequence' | 'act';
	contentId: string;
	ownerId: string;
	word: string;
	flaggedTerms: FlaggedTerm[];
	appealReason: string;
	status: 'pending' | 'approved' | 'denied';
	createdAt: ReturnType<typeof serverTimestamp> | Timestamp;
	resolvedAt?: ReturnType<typeof serverTimestamp> | Timestamp;
	resolvedBy?: string;
	adminNotes?: string;
}

export class ContentAppealManager {
	async submitAppeal(userId: string, data: CreateAppealData): Promise<ContentAppeal> {
		const firestore = await getFirestoreInstance();
		const appealsRef = collection(firestore, APPEALS_COLLECTION);

		// Check for existing pending appeal for same content
		const existingQuery = query(
			appealsRef,
			where('ownerId', '==', userId),
			where('contentType', '==', data.contentType),
			where('contentId', '==', data.contentId),
			where('status', '==', 'pending')
		);
		const existingSnapshot = await getDocs(existingQuery);
		if (!existingSnapshot.empty) {
			throw new Error('You already have a pending appeal for this content.');
		}

		const appealData: AppealDocument = {
			contentType: data.contentType,
			contentId: data.contentId,
			ownerId: userId,
			word: data.word,
			flaggedTerms: data.flaggedTerms,
			appealReason: data.appealReason,
			status: 'pending',
			createdAt: serverTimestamp()
		};

		const docRef = await addDoc(appealsRef, appealData);

		return {
			id: docRef.id,
			...data,
			ownerId: userId,
			status: 'pending',
			createdAt: new Date()
		};
	}

	async getUserAppeals(userId: string): Promise<ContentAppeal[]> {
		const firestore = await getFirestoreInstance();
		const appealsRef = collection(firestore, APPEALS_COLLECTION);

		const q = query(appealsRef, where('ownerId', '==', userId), orderBy('createdAt', 'desc'));

		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => this.docToAppeal(doc.id, doc.data() as AppealDocument));
	}

	async getAppeal(appealId: string): Promise<ContentAppeal | null> {
		const firestore = await getFirestoreInstance();
		const appealRef = doc(firestore, APPEALS_COLLECTION, appealId);
		const snapshot = await getDoc(appealRef);

		if (!snapshot.exists()) {
			return null;
		}

		return this.docToAppeal(snapshot.id, snapshot.data() as AppealDocument);
	}

	async getPendingAppeals(): Promise<ContentAppeal[]> {
		const firestore = await getFirestoreInstance();
		const appealsRef = collection(firestore, APPEALS_COLLECTION);

		const q = query(
			appealsRef,
			where('status', '==', 'pending'),
			orderBy('createdAt', 'asc') // Oldest first for FIFO processing
		);

		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => this.docToAppeal(doc.id, doc.data() as AppealDocument));
	}

	async resolveAppeal(
		appealId: string,
		adminId: string,
		data: ResolveAppealData
	): Promise<ContentAppeal> {
		const firestore = await getFirestoreInstance();
		const appealRef = doc(firestore, APPEALS_COLLECTION, appealId);

		const snapshot = await getDoc(appealRef);
		if (!snapshot.exists()) {
			throw new Error('Appeal not found');
		}

		const currentData = snapshot.data() as AppealDocument;
		if (currentData.status !== 'pending') {
			throw new Error('Appeal has already been resolved');
		}

		const updates: Partial<AppealDocument> = {
			status: data.status,
			resolvedAt: serverTimestamp(),
			resolvedBy: adminId
		};

		if (data.adminNotes) {
			updates.adminNotes = data.adminNotes;
		}

		await updateDoc(appealRef, updates);

		return this.docToAppeal(appealId, {
			...currentData,
			...updates,
			resolvedAt: Timestamp.now()
		} as AppealDocument);
	}

	async isWhitelisted(contentType: 'sequence' | 'act', contentId: string): Promise<boolean> {
		const firestore = await getFirestoreInstance();
		const appealsRef = collection(firestore, APPEALS_COLLECTION);

		const q = query(
			appealsRef,
			where('contentType', '==', contentType),
			where('contentId', '==', contentId),
			where('status', '==', 'approved')
		);

		const snapshot = await getDocs(q);
		return !snapshot.empty;
	}

	/**
	 * Convert Firestore document to ContentAppeal
	 */
	private docToAppeal(id: string, data: AppealDocument): ContentAppeal {
		return {
			id,
			contentType: data.contentType,
			contentId: data.contentId,
			ownerId: data.ownerId,
			word: data.word,
			flaggedTerms: data.flaggedTerms,
			appealReason: data.appealReason,
			status: data.status,
			createdAt: this.timestampToDate(data.createdAt),
			resolvedAt: data.resolvedAt ? this.timestampToDate(data.resolvedAt) : undefined,
			resolvedBy: data.resolvedBy,
			adminNotes: data.adminNotes
		};
	}

	/**
	 * Convert Firestore Timestamp or serverTimestamp to Date
	 */
	private timestampToDate(
		timestamp: ReturnType<typeof serverTimestamp> | Timestamp | undefined
	): Date {
		if (!timestamp) {
			return new Date();
		}
		if (timestamp instanceof Timestamp) {
			return timestamp.toDate();
		}
		// serverTimestamp() placeholder - return current date
		return new Date();
	}
}
