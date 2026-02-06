import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "../../../../auth/firebase";
import { db } from "../../../../persistence/database/TKADatabase";
import { getUserSkillProgressPath } from "../../../data/firestore-collections";
import type { UserSkillProgress } from "../../../domain/models/challenge-models";
import { firestoreDataToUserSkillProgress } from "./SkillProgressionFirestoreCodec";

export async function loadAllUserSkillProgress(params: {
  userId: string;
  cache: Map<string, UserSkillProgress>;
}): Promise<Map<string, UserSkillProgress>> {
  const { userId, cache } = params;

  if (cache.size > 0) {
    return cache;
  }

  const localProgress = await db.userSkillProgress.toArray();
  if (localProgress.length > 0) {
    for (const progress of localProgress) {
      cache.set(progress.skillId, progress);
    }
    return cache;
  }

  try {
    const firestore = await getFirestoreInstance();
    const progressPath = getUserSkillProgressPath(userId);
    const progressQuery = query(collection(firestore, progressPath));
    const snapshot = await getDocs(progressQuery);

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const progress = firestoreDataToUserSkillProgress({
        userId,
        docId: docSnap.id,
        data,
      });

      cache.set(progress.skillId, progress);
      void db.userSkillProgress.put(progress);
    });

    return cache;
  } catch (error) {
    console.error("Failed to load skill progress from Firestore:", error);
    return new Map();
  }
}

export async function persistStartedSkill(params: {
  userId: string;
  skillId: string;
  progress: UserSkillProgress;
  cache: Map<string, UserSkillProgress>;
}): Promise<void> {
  const { userId, skillId, progress, cache } = params;

  const firestore = await getFirestoreInstance();
  const progressPath = getUserSkillProgressPath(userId);
  const progressDocRef = doc(firestore, `${progressPath}/${skillId}`);

  await setDoc(progressDocRef, {
    ...progress,
    startedAt: serverTimestamp(),
    lastProgressAt: serverTimestamp(),
  });

  cache.set(skillId, progress);
  await db.userSkillProgress.put(progress);
}

export async function persistSkillProgressLevelCompletion(params: {
  userId: string;
  skillId: string;
  updatedProgress: UserSkillProgress;
  completedLevels: number[];
  skillCompleted: boolean;
  cache: Map<string, UserSkillProgress>;
}): Promise<void> {
  const {
    userId,
    skillId,
    updatedProgress,
    completedLevels,
    skillCompleted,
    cache,
  } = params;

  const firestore = await getFirestoreInstance();
  const progressPath = getUserSkillProgressPath(userId);
  const progressDocRef = doc(firestore, `${progressPath}/${skillId}`);

  await updateDoc(progressDocRef, {
    currentLevel: updatedProgress.currentLevel,
    levelProgress: 0,
    isCompleted: skillCompleted,
    completedLevels,
    lastProgressAt: serverTimestamp(),
    ...(skillCompleted && { completedAt: serverTimestamp() }),
  });

  cache.set(skillId, updatedProgress);
  await db.userSkillProgress.put(updatedProgress);
}

export async function persistSkillProgressIncrement(params: {
  userId: string;
  skillId: string;
  updatedProgress: UserSkillProgress;
  newLevelProgress: number;
  cache: Map<string, UserSkillProgress>;
}): Promise<void> {
  const { userId, skillId, updatedProgress, newLevelProgress, cache } = params;

  const firestore = await getFirestoreInstance();
  const progressPath = getUserSkillProgressPath(userId);
  const progressDocRef = doc(firestore, `${progressPath}/${skillId}`);

  await updateDoc(progressDocRef, {
    levelProgress: newLevelProgress,
    lastProgressAt: serverTimestamp(),
  });

  cache.set(skillId, updatedProgress);
  await db.userSkillProgress.put(updatedProgress);
}
