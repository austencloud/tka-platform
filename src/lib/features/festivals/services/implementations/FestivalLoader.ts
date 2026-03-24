/**
 * FestivalLoader
 *
 * Handles filtered, paginated queries against the festivals collection.
 * Uses Firestore compound queries with optional region, time-window,
 * and seeking filters. Pagination is cursor-based via startAfter.
 *
 * Note: seekingInstructors / seekingPerformers filters require a composite
 * index in Firestore (status + seekingInstructors/seekingPerformers + dates.start).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  type QueryConstraint,
  type DocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Festival } from "../../domain/models/festival";
import type { FestivalFilters, IFestivalLoader } from "../contracts/IFestivalLoader";

const DEFAULT_PAGE_SIZE = 20;

// FestivalLoader has no constructor dependencies — it queries Firestore directly
// via getFirestoreInstance() on each call.
export class FestivalLoader implements IFestivalLoader {
  async loadFestivals(
    filters: FestivalFilters,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor?: unknown
  ): Promise<{ festivals: Festival[]; nextCursor: unknown | null }> {
    const db = await getFirestoreInstance();
    const constraints: QueryConstraint[] = [];

    // Only show approved festivals to end users
    constraints.push(where("moderationStatus", "==", "approved"));
    constraints.push(where("status", "==", "upcoming"));

    if (filters.region) {
      constraints.push(where("region", "==", filters.region));
    }

    if (filters.seeking === "instructors") {
      constraints.push(where("seekingInstructors", "==", true));
    } else if (filters.seeking === "performers") {
      constraints.push(where("seekingPerformers", "==", true));
    } else if (filters.seeking === "applications-open") {
      // Either instructors or performers — handled client-side after load
      // because Firestore doesn't support OR queries across different fields
    }

    if (filters.timeWindow && filters.timeWindow !== "upcoming") {
      const now = Timestamp.now();
      const cutoff = this.timeWindowCutoff(filters.timeWindow);
      constraints.push(where("dates.start", ">=", now));
      constraints.push(where("dates.start", "<=", cutoff));
    }

    constraints.push(orderBy("dates.start"));
    constraints.push(limit(pageSize + 1)); // fetch one extra to detect next page

    if (cursor) {
      constraints.push(startAfter(cursor as DocumentSnapshot));
    }

    const ref = collection(db, "festivals");
    const q = query(ref, ...constraints);
    const snap = await getDocs(q);

    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

    let festivals = resultDocs.map((d) => ({ id: d.id, ...d.data() } as Festival));

    // Client-side filter for applications-open (either flag is true)
    if (filters.seeking === "applications-open") {
      festivals = festivals.filter((f) => f.seekingInstructors || f.seekingPerformers);
    }

    const nextCursor = hasMore ? docs[pageSize - 1] : null;
    return { festivals, nextCursor };
  }

  async getByIds(ids: string[]): Promise<Festival[]> {
    if (ids.length === 0) return [];
    const db = await getFirestoreInstance();
    const snapshots = await Promise.all(
      ids.map((id) => getDoc(doc(db, "festivals", id)))
    );
    return snapshots
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...s.data() } as Festival));
  }

  private timeWindowCutoff(timeWindow: "3months" | "6months" | "year"): Timestamp {
    const date = new Date();
    if (timeWindow === "3months") date.setMonth(date.getMonth() + 3);
    else if (timeWindow === "6months") date.setMonth(date.getMonth() + 6);
    else date.setFullYear(date.getFullYear() + 1);
    return Timestamp.fromDate(date);
  }
}
