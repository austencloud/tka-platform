/**
 * ArenaRepository
 *
 * Firestore implementation for arena data persistence.
 * Collections:
 *   arenaRatings/{entryId}       - ArenaRating documents
 *   arenaVotes/{autoId}          - Individual vote records
 *   arenaSnapshots/{YYYY-MM-DD}  - Daily rank snapshots
 */

import type {
  ArenaRating,
  ArenaVote,
  ArenaLeaderboardEntry,
  ArenaUserStats,
  ArenaEntry,
} from "../../domain/models/arena-models";
import type { MatchupCandidate } from "../contracts/IMatchupSelector";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceHydrator } from '$lib/shared/foundation/services/implementations/SequenceHydrator'
import { getSequenceHydrator } from "$lib/shared/foundation/getSequenceHydrator";
import {
  INITIAL_MU,
  INITIAL_PHI,
  INITIAL_SIGMA,
} from "../../domain/constants/arena-constants";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

const RATINGS_COLLECTION = "arenaRatings";
const VOTES_COLLECTION = "arenaVotes";
const SNAPSHOTS_COLLECTION = "arenaSnapshots";
const PUBLIC_SEQUENCES_COLLECTION = "publicSequences";

export class ArenaRepository {
  async loadPool(): Promise<MatchupCandidate[]> {
    const firestore = await getFirestoreInstance();
    const publicSnap = await getDocs(collection(firestore, PUBLIC_SEQUENCES_COLLECTION));
    const candidates: MatchupCandidate[] = [];

    // publicSequences is a lightweight index - steps live in the source doc.
    // Build entries from the index, then batch-fetch full data via sourceRef.
    const pendingEntries: Array<{
      entry: ArenaEntry;
      sourceRef: string;
      indexData: Record<string, unknown>;
    }> = [];

    for (const seqDoc of publicSnap.docs) {
      const raw = seqDoc.data() as Record<string, unknown>;
      const word = raw.word as string | undefined;
      if (!word) continue;

      // Arena is loop-only - skip sequences without a labeled loop type
      const loopType = raw.loopType as string | null | undefined;
      if (!loopType) continue;

      const entry: ArenaEntry = {
        id: seqDoc.id,
        kind: "sequence",
        word,
        ownerId: (raw.ownerId as string) ?? "",
        ownerDisplayName: raw.ownerDisplayName as string | undefined,
      };

      const rating = await this.getOrCreateRating(entry);

      // Build lightweight SequenceData from the index document.
      // Steps are NOT stored in publicSequences - full data is fetched
      // on demand via sourceRef when a matchup is presented.
      const data: SequenceData = {
        id: seqDoc.id,
        name: (raw.name as string) ?? "",
        word,
        steps: [],
        thumbnails: (raw.thumbnails as readonly string[]) ?? [],
        sequenceLength: raw.sequenceLength as number | undefined,
        level: raw.level as number | undefined,
        difficultyLevel: raw.difficultyLevel as string | undefined,
        isFavorite: false,
        isCircular: true, // Arena only loads loops
        loopType: loopType as SequenceData["loopType"],
        tags: (raw.tags as readonly string[]) ?? [],
        metadata: {},
        ownerId: (raw.ownerId as string) ?? "",
        ownerDisplayName: raw.ownerDisplayName as string | undefined,
      };

      candidates.push({
        entry,
        rating,
        data,
        sourceRef: raw.sourceRef as string | undefined,
      });
    }

    return candidates;
  }

  async getRating(entryId: string): Promise<ArenaRating | null> {
    const firestore = await getFirestoreInstance();
    const snap = await getDoc(doc(firestore, RATINGS_COLLECTION, entryId));
    if (!snap.exists()) return null;
    return this.deserializeRating(snap.data());
  }

  async saveRatings(winner: ArenaRating, loser: ArenaRating): Promise<void> {
    const firestore = await getFirestoreInstance();
    const batch = writeBatch(firestore);
    batch.set(
      doc(firestore, RATINGS_COLLECTION, winner.entryId),
      this.serializeRating(winner)
    );
    batch.set(
      doc(firestore, RATINGS_COLLECTION, loser.entryId),
      this.serializeRating(loser)
    );
    await batch.commit();
  }

  async saveVote(vote: ArenaVote): Promise<void> {
    const firestore = await getFirestoreInstance();
    await addDoc(collection(firestore, VOTES_COLLECTION), {
      ...vote,
      timestamp: Timestamp.fromDate(vote.timestamp),
    });
  }

  async loadLeaderboard(limit: number): Promise<ArenaLeaderboardEntry[]> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, RATINGS_COLLECTION),
      orderBy("displayRating", "desc"),
      firestoreLimit(limit)
    );
    const snap = await getDocs(q);
    const previousRanks = await this.loadPreviousSnapshot();

    return snap.docs.map((d, idx) => {
      const rating = this.deserializeRating(d.data());
      const rank = idx + 1;
      const prevRank = previousRanks.get(rating.entryId);
      const rankChange = prevRank != null ? prevRank - rank : 0;

      return {
        rank,
        rating,
        entry: {
          id: rating.entryId,
          kind: rating.entryKind,
          word: rating.word,
          ownerId: rating.ownerId,
        },
        rankChange,
      };
    });
  }

  async loadUserStats(userId: string): Promise<ArenaUserStats> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, VOTES_COLLECTION),
      where("voterId", "==", userId),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return {
        totalVotes: 0,
        currentStreak: 0,
        longestStreak: 0,
        firstVoteDate: null,
      };
    }

    const totalVotes = snap.size;
    const lastDoc = snap.docs[snap.docs.length - 1];
    const firstVoteDate = lastDoc?.data().timestamp?.toDate?.() ?? null;

    return {
      totalVotes,
      currentStreak: 0, // Computed from session state, not persisted
      longestStreak: 0,
      firstVoteDate,
    };
  }

  async loadRecentVotePairs(userId: string, limit: number): Promise<Set<string>> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, VOTES_COLLECTION),
      where("voterId", "==", userId),
      orderBy("timestamp", "desc"),
      firestoreLimit(limit)
    );
    const snap = await getDocs(q);
    const pairs = new Set<string>();

    for (const d of snap.docs) {
      const data = d.data();
      const a = data.winnerEntryId;
      const b = data.loserEntryId;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      pairs.add(key);
    }

    return pairs;
  }

  async saveDailySnapshot(entries: ArenaLeaderboardEntry[]): Promise<void> {
    const firestore = await getFirestoreInstance();
    const today = new Date().toISOString().slice(0, 10);
    const rankMap: Record<string, number> = {};
    for (const entry of entries) {
      rankMap[entry.entry.id] = entry.rank;
    }
    await setDoc(doc(firestore, SNAPSHOTS_COLLECTION, today), {
      ranks: rankMap,
      createdAt: Timestamp.now(),
    });
  }

  async loadPreviousSnapshot(): Promise<Map<string, number>> {
    const firestore = await getFirestoreInstance();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const snap = await getDoc(doc(firestore, SNAPSHOTS_COLLECTION, yesterday));
    const map = new Map<string, number>();
    if (!snap.exists()) return map;

    const ranks = snap.data()?.ranks;
    if (ranks && typeof ranks === "object") {
      for (const [id, rank] of Object.entries(ranks)) {
        map.set(id, rank as number);
      }
    }
    return map;
  }

  async loadFullSequenceData(sourceRef: string): Promise<SequenceData | null> {
    const firestore = await getFirestoreInstance();
    try {
      const fullDoc = await getDoc(doc(firestore, sourceRef));
      if (!fullDoc.exists()) return null;

      const raw = fullDoc.data();
      const mapped: SequenceData = {
        id: fullDoc.id,
        name: (raw.name as string) ?? "",
        displayName: raw.displayName as string | undefined,
        word: (raw.word as string) ?? "",
        steps: (raw.steps as SequenceData["steps"]) ?? (raw.beats as SequenceData["steps"]) ?? [],
        startPosition: raw.startPosition as SequenceData["startPosition"],
        startingPosition: raw.startingPosition as SequenceData["startingPosition"],
        startingPositionGroup: raw.startingPositionGroup as SequenceData["startingPositionGroup"],
        thumbnails: (raw.thumbnails as readonly string[]) ?? [],
        sequenceLength: raw.sequenceLength as number | undefined,
        level: raw.level as number | undefined,
        gridMode: raw.gridMode as SequenceData["gridMode"],
        isFavorite: false,
        isCircular: (raw.isCircular as boolean) ?? false,
        loopType: raw.loopType as SequenceData["loopType"],
        difficultyLevel: raw.difficultyLevel as string | undefined,
        tags: (raw.tags as readonly string[]) ?? [],
        metadata: (raw.metadata as Record<string, unknown>) ?? {},
        ownerId: raw.ownerId as string | undefined,
        ownerDisplayName: raw.ownerDisplayName as string | undefined,
        // Pass through compositional fields from Firestore
        blueSoloProp: raw.blueSoloProp as SequenceData["blueSoloProp"],
        redSoloProp: raw.redSoloProp as SequenceData["redSoloProp"],
        stepPairings: raw.stepPairings as SequenceData["stepPairings"],
      };

      // Hydrate: re-derive steps from compositional fields if present
      const hydrator = getSequenceHydrator();
      return hydrator.hydrate(mapped);
    } catch (err) {
      console.error(`[Arena] Failed to load full sequence from ${sourceRef}:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getOrCreateRating(entry: ArenaEntry): Promise<ArenaRating> {
    const existing = await this.getRating(entry.id);
    if (existing) return existing;

    const firestore = await getFirestoreInstance();
    const now = new Date();
    const rating: ArenaRating = {
      entryId: entry.id,
      entryKind: entry.kind,
      mu: INITIAL_MU,
      phi: INITIAL_PHI,
      sigma: INITIAL_SIGMA,
      displayRating: INITIAL_MU - 2 * INITIAL_PHI,
      totalMatchups: 0,
      wins: 0,
      losses: 0,
      peakRating: INITIAL_MU - 2 * INITIAL_PHI,
      peakRatingDate: now,
      lastMatchAt: now,
      enteredPoolAt: now,
      word: entry.word,
      ownerId: entry.ownerId,
    };

    await setDoc(doc(firestore, RATINGS_COLLECTION, entry.id), this.serializeRating(rating));
    return rating;
  }

  private serializeRating(r: ArenaRating): Record<string, unknown> {
    return {
      ...r,
      peakRatingDate: Timestamp.fromDate(r.peakRatingDate),
      lastMatchAt: Timestamp.fromDate(r.lastMatchAt),
      enteredPoolAt: Timestamp.fromDate(r.enteredPoolAt),
    };
  }

  private deserializeRating(data: Record<string, unknown>): ArenaRating {
    return {
      entryId: data.entryId as string,
      entryKind: (data.entryKind as string) || "sequence",
      mu: data.mu as number,
      phi: data.phi as number,
      sigma: data.sigma as number,
      displayRating: data.displayRating as number,
      totalMatchups: data.totalMatchups as number,
      wins: data.wins as number,
      losses: data.losses as number,
      peakRating: data.peakRating as number,
      peakRatingDate: (data.peakRatingDate as Timestamp)?.toDate?.() ?? new Date(),
      lastMatchAt: (data.lastMatchAt as Timestamp)?.toDate?.() ?? new Date(),
      enteredPoolAt: (data.enteredPoolAt as Timestamp)?.toDate?.() ?? new Date(),
      word: data.word as string,
      ownerId: data.ownerId as string,
    } as ArenaRating;
  }
}
