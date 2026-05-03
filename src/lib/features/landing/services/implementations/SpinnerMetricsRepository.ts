/**
 * Spinner Metrics Repository Implementation
 *
 * Persists global spinner generation metrics to Firebase.
 * Uses atomic increment() for concurrent safety across all users.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { SpinnerMetrics } from "../../domain/models/spinner-models";
const METRICS_PATH = "appMetrics/spinner";

export class SpinnerMetricsRepository {
  private cachedMetrics: SpinnerMetrics | null = null;
  private unsubscribe: Unsubscribe | null = null;

  async getMetrics(): Promise<SpinnerMetrics> {
    if (this.cachedMetrics) {
      return this.cachedMetrics;
    }

    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, METRICS_PATH);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        this.cachedMetrics = {
          totalGenerated: data.totalGenerated ?? 0,
          lastGeneratedAt: data.lastGeneratedAt
            ? (data.lastGeneratedAt as Timestamp).toDate()
            : null,
        };
      } else {
        // Initialize the document if it doesn't exist
        await setDoc(docRef, {
          totalGenerated: 0,
          lastGeneratedAt: null,
          createdAt: serverTimestamp(),
        });
        this.cachedMetrics = {
          totalGenerated: 0,
          lastGeneratedAt: null,
        };
      }

      return this.cachedMetrics;
    } catch (error) {
      console.error("[SpinnerMetricsRepository] Failed to get metrics:", error);
      // Return default metrics on error
      return {
        totalGenerated: 0,
        lastGeneratedAt: null,
      };
    }
  }

  async incrementGeneratedCount(): Promise<number> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, METRICS_PATH);

      // Ensure document exists first
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        await setDoc(docRef, {
          totalGenerated: 1,
          lastGeneratedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        if (this.cachedMetrics) {
          this.cachedMetrics.totalGenerated = 1;
          this.cachedMetrics.lastGeneratedAt = new Date();
        }
        return 1;
      }

      // Atomic increment
      await updateDoc(docRef, {
        totalGenerated: increment(1),
        lastGeneratedAt: serverTimestamp(),
      });

      // Update cache and return new value
      const newSnapshot = await getDoc(docRef);
      const newTotal = newSnapshot.data()?.totalGenerated ?? 0;

      if (this.cachedMetrics) {
        this.cachedMetrics.totalGenerated = newTotal;
        this.cachedMetrics.lastGeneratedAt = new Date();
      }

      return newTotal;
    } catch (error) {
      console.error(
        "[SpinnerMetricsRepository] Failed to increment count:",
        error
      );
      throw error;
    }
  }

  subscribe(callback: (metrics: SpinnerMetrics) => void): () => void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    let unsubscribed = false;

    const setupSubscription = async () => {
      try {
        const firestore = await getFirestoreInstance();
        const docRef = doc(firestore, METRICS_PATH);

        this.unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (unsubscribed) return;

            if (snapshot.exists()) {
              const data = snapshot.data();
              const metrics: SpinnerMetrics = {
                totalGenerated: data.totalGenerated ?? 0,
                lastGeneratedAt: data.lastGeneratedAt
                  ? (data.lastGeneratedAt as Timestamp).toDate()
                  : null,
              };
              this.cachedMetrics = metrics;
              callback(metrics);
            } else {
              const defaultMetrics: SpinnerMetrics = {
                totalGenerated: 0,
                lastGeneratedAt: null,
              };
              this.cachedMetrics = defaultMetrics;
              callback(defaultMetrics);
            }
          },
          (error) => {
            console.error(
              "[SpinnerMetricsRepository] Subscription error:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "[SpinnerMetricsRepository] Failed to setup subscription:",
          error
        );
      }
    };

    setupSubscription();

    return () => {
      unsubscribed = true;
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
