/**
 * LOOPPopularityAggregator
 *
 * Aggregates LOOP type usage from public sequences.
 * Uses client-side caching with 1-hour expiration.
 */

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ILOOPPopularityAggregator } from "../contracts/ILOOPPopularityAggregator";
import type {
  LOOPPopularityData,
  CachedPopularityData,
} from "../../domain/models/loop-selection-types";

/** Cache duration in milliseconds (1 hour) */
const CACHE_DURATION_MS = 60 * 60 * 1000;

export class LOOPPopularityAggregator implements ILOOPPopularityAggregator {
  private cache: CachedPopularityData | null = null;

  async getPopularityData(
    forceRefresh: boolean = false
  ): Promise<LOOPPopularityData[]> {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid()) {
      return this.cache!.data;
    }

    // Fetch fresh data
    const data = await this.fetchPopularityFromFirestore();

    // Update cache
    const now = Date.now();
    this.cache = {
      data,
      fetchedAt: now,
      expiresAt: now + CACHE_DURATION_MS,
    };

    return data;
  }

  async getTopPopular(limit: number = 10): Promise<LOOPPopularityData[]> {
    const allData = await this.getPopularityData();
    return allData.slice(0, limit);
  }

  async getPopularityForType(
    loopType: string
  ): Promise<LOOPPopularityData | null> {
    const allData = await this.getPopularityData();
    return allData.find((d) => d.loopType === loopType) ?? null;
  }

  isCacheValid(): boolean {
    if (!this.cache) return false;
    return Date.now() < this.cache.expiresAt;
  }

  clearCache(): void {
    this.cache = null;
  }

  getCacheExpiration(): number | null {
    return this.cache?.expiresAt ?? null;
  }

  /**
   * Fetch and aggregate popularity data from Firestore
   */
  private async fetchPopularityFromFirestore(): Promise<LOOPPopularityData[]> {
    const firestore = await getFirestoreInstance();

    // Query public sequences that have a loopType
    const sequencesRef = collection(firestore, "sequences");
    const q = query(
      sequencesRef,
      where("visibility", "==", "public"),
      where("loopType", "!=", null)
    );

    const snapshot = await getDocs(q);

    // Aggregate counts by loopType
    const countsByType = new Map<string, number>();
    let totalCount = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const loopType = data.loopType as string;
      if (loopType) {
        countsByType.set(loopType, (countsByType.get(loopType) || 0) + 1);
        totalCount++;
      }
    });

    // Convert to sorted array
    const popularityData: LOOPPopularityData[] = Array.from(countsByType)
      .map(([loopType, usageCount]) => ({
        loopType,
        usageCount,
        usagePercent:
          totalCount > 0
            ? Math.round((usageCount / totalCount) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);

    return popularityData;
  }
}
