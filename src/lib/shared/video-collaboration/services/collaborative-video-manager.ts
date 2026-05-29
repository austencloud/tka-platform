import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type Timestamp,
} from "firebase/firestore";
import type {
  CollaborativeVideo,
  VideoCollaborator,
  CollaborationInvite,
  VideoVisibility,
  StepMap,
} from "../domain/CollaborativeVideo";
import type { UserVideoLibrary } from "./types";

const VIDEOS_COLLECTION = "videos";

function getUserId(): string {
  const user = getAuthSync().currentUser;
  if (!user) {
    throw new Error("User must be authenticated to access videos");
  }
  return user.uid;
}

function getUserInfo(): {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
} {
  const user = getAuthSync().currentUser;
  if (!user) {
    throw new Error("User must be authenticated");
  }
  return {
    uid: user.uid,
    displayName: user.displayName ?? undefined,
    avatarUrl: user.photoURL ?? undefined,
  };
}

function docToVideo(
  docData: Record<string, unknown>,
  videoId: string
): CollaborativeVideo {
  const createdAtField = docData.createdAt as Timestamp | undefined;
  const updatedAtField = docData.updatedAt as Timestamp | undefined;

  const collaboratorsData = (docData.collaborators as unknown[]) ?? [];
  const collaborators: VideoCollaborator[] = collaboratorsData.map((c) => {
    const collab = c as Record<string, unknown>;
    const joinedAtField = collab.joinedAt as Timestamp | undefined;
    return {
      userId: collab.userId as string,
      displayName: collab.displayName as string | undefined,
      avatarUrl: collab.avatarUrl as string | undefined,
      joinedAt: joinedAtField?.toDate?.() ?? new Date(),
      role: collab.role as "creator" | "collaborator",
    };
  });

  const invitesData = (docData.pendingInvites as unknown[]) ?? [];
  const pendingInvites: CollaborationInvite[] = invitesData.map((i) => {
    const invite = i as Record<string, unknown>;
    const invitedAtField = invite.invitedAt as Timestamp | undefined;
    const respondedAtField = invite.respondedAt as Timestamp | undefined;
    return {
      userId: invite.userId as string,
      displayName: invite.displayName as string | undefined,
      message: invite.message as string | undefined,
      invitedAt: invitedAtField?.toDate?.() ?? new Date(),
      invitedBy: invite.invitedBy as string,
      status: invite.status as "pending" | "accepted" | "declined" | "expired",
      respondedAt: respondedAtField?.toDate?.(),
    };
  });

  const beatMapData = docData.beatMap as Record<string, unknown> | undefined;
  const beatMap: StepMap | undefined = beatMapData
    ? {
        beatTimestamps: (beatMapData.beatTimestamps as number[]) ?? [],
        stepCount: (beatMapData.stepCount as number) ?? 0,
        source: (beatMapData.source as StepMap["source"]) ?? "manual",
        updatedAt:
          (beatMapData.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
      }
    : undefined;

  return {
    id: videoId,
    videoUrl: docData.videoUrl as string,
    storagePath: docData.storagePath as string,
    thumbnailUrl: docData.thumbnailUrl as string | undefined,
    duration: docData.duration as number,
    fileSize: docData.fileSize as number,
    mimeType: docData.mimeType as string,
    sequenceId: docData.sequenceId as string,
    sequenceName: docData.sequenceName as string | undefined,
    sequenceOwnerId: docData.sequenceOwnerId as string | undefined,
    creatorId: docData.creatorId as string,
    collaborators,
    pendingInvites,
    beatMap,
    visibility: (docData.visibility as VideoVisibility) ?? "public",
    description: docData.description as string | undefined,
    createdAt: createdAtField?.toDate?.() ?? new Date(),
    updatedAt: updatedAtField?.toDate?.() ?? new Date(),
  };
}

function videoToDoc(video: CollaborativeVideo): Record<string, unknown> {
  return {
    videoUrl: video.videoUrl,
    storagePath: video.storagePath,
    thumbnailUrl: video.thumbnailUrl ?? null,
    duration: video.duration,
    fileSize: video.fileSize,
    mimeType: video.mimeType,
    sequenceId: video.sequenceId,
    sequenceName: video.sequenceName ?? null,
    sequenceOwnerId: video.sequenceOwnerId ?? null,
    creatorId: video.creatorId,
    collaborators: video.collaborators.map((c) => ({
      userId: c.userId,
      displayName: c.displayName ?? null,
      avatarUrl: c.avatarUrl ?? null,
      joinedAt: c.joinedAt,
      role: c.role,
    })),
    pendingInvites: video.pendingInvites.map((i) => ({
      userId: i.userId,
      displayName: i.displayName ?? null,
      message: i.message ?? null,
      invitedAt: i.invitedAt,
      invitedBy: i.invitedBy,
      status: i.status,
      respondedAt: i.respondedAt ?? null,
    })),
    beatMap: video.beatMap
      ? {
          beatTimestamps: video.beatMap.beatTimestamps,
          stepCount: video.beatMap.stepCount,
          source: video.beatMap.source,
          updatedAt: video.beatMap.updatedAt,
        }
      : null,
    visibility: video.visibility,
    description: video.description ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    collaboratorIds: video.collaborators.map((c) => c.userId),
    pendingInviteUserIds: video.pendingInvites
      .filter((i) => i.status === "pending")
      .map((i) => i.userId),
  };
}

export async function saveVideo(video: CollaborativeVideo): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();

    if (video.creatorId !== userId) {
      throw new Error("Only the creator can save this video");
    }

    const docRef = doc(firestore, VIDEOS_COLLECTION, video.id);
    await setDoc(docRef, videoToDoc(video));
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to save video:", error);
    toast.error("Failed to save video.");
    throw error;
  }
}

export async function getVideo(videoId: string): Promise<CollaborativeVideo | null> {
  try {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToVideo(docSnap.data(), videoId);
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to get video:", error);
    return null;
  }
}

export async function deleteVideo(videoId: string): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.creatorId !== userId) {
      throw new Error("Only the creator can delete this video");
    }

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to delete video:", error);
    toast.error("Failed to delete video.");
    throw error;
  }
}

export async function updateVideo(
  videoId: string,
  updates: Partial<Pick<CollaborativeVideo, "visibility" | "description">>
): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.creatorId !== userId) {
      throw new Error("Only the creator can update this video");
    }

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to update video:", error);
    toast.error("Failed to update video.");
    throw error;
  }
}

export async function updateStepMap(videoId: string, beatMap: StepMap): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (!video.collaborators.some((c) => c.userId === userId)) {
      throw new Error("Only collaborators can update the beat map");
    }

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await updateDoc(docRef, {
      beatMap: {
        beatTimestamps: beatMap.beatTimestamps,
        stepCount: beatMap.stepCount,
        source: beatMap.source,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to update beat map:", error);
    toast.error("Failed to save beat mapping.");
    throw error;
  }
}

export async function inviteCollaborator(
  videoId: string,
  userId: string,
  displayName?: string,
  message?: string
): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const currentUserId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (!video.collaborators.some((c) => c.userId === currentUserId)) {
      throw new Error("Only collaborators can invite others");
    }

    if (video.collaborators.some((c) => c.userId === userId)) {
      throw new Error("User is already a collaborator");
    }

    if (
      video.pendingInvites.some(
        (i) => i.userId === userId && i.status === "pending"
      )
    ) {
      throw new Error("User already has a pending invite");
    }

    const invite: CollaborationInvite = {
      userId,
      displayName,
      message,
      invitedAt: new Date(),
      invitedBy: currentUserId,
      status: "pending",
    };

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await updateDoc(docRef, {
      pendingInvites: arrayUnion({
        userId: invite.userId,
        displayName: invite.displayName ?? null,
        message: invite.message ?? null,
        invitedAt: invite.invitedAt,
        invitedBy: invite.invitedBy,
        status: invite.status,
        respondedAt: null,
      }),
      pendingInviteUserIds: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to invite collaborator:", error);
    toast.error("Failed to send collaboration invite.");
    throw error;
  }
}

export async function acceptInvite(videoId: string): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userInfo = getUserInfo();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    const invite = video.pendingInvites.find(
      (i) => i.userId === userInfo.uid && i.status === "pending"
    );

    if (!invite) {
      throw new Error("No pending invite found");
    }

    const newCollaborator: VideoCollaborator = {
      userId: userInfo.uid,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl,
      joinedAt: new Date(),
      role: "collaborator",
    };

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);

    const updatedInvites = video.pendingInvites.map((i) =>
      i.userId === userInfo.uid
        ? { ...i, status: "accepted" as const, respondedAt: new Date() }
        : i
    );

    await updateDoc(docRef, {
      collaborators: arrayUnion({
        userId: newCollaborator.userId,
        displayName: newCollaborator.displayName ?? null,
        avatarUrl: newCollaborator.avatarUrl ?? null,
        joinedAt: newCollaborator.joinedAt,
        role: newCollaborator.role,
      }),
      collaboratorIds: arrayUnion(userInfo.uid),
      pendingInvites: updatedInvites.map((i) => ({
        userId: i.userId,
        displayName: i.displayName ?? null,
        message: i.message ?? null,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy,
        status: i.status,
        respondedAt: i.respondedAt ?? null,
      })),
      pendingInviteUserIds: arrayRemove(userInfo.uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to accept invite:", error);
    toast.error("Failed to accept collaboration invite.");
    throw error;
  }
}

export async function declineInvite(videoId: string): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    const invite = video.pendingInvites.find(
      (i) => i.userId === userId && i.status === "pending"
    );

    if (!invite) {
      throw new Error("No pending invite found");
    }

    const updatedInvites = video.pendingInvites.map((i) =>
      i.userId === userId
        ? { ...i, status: "declined" as const, respondedAt: new Date() }
        : i
    );

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await updateDoc(docRef, {
      pendingInvites: updatedInvites.map((i) => ({
        userId: i.userId,
        displayName: i.displayName ?? null,
        message: i.message ?? null,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy,
        status: i.status,
        respondedAt: i.respondedAt ?? null,
      })),
      pendingInviteUserIds: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to decline invite:", error);
    toast.error("Failed to decline collaboration invite.");
    throw error;
  }
}

export async function removeCollaborator(videoId: string, userId: string): Promise<void> {
  try {
    const firestore = await getFirestoreInstance();
    const currentUserId = getUserId();
    const video = await getVideo(videoId);

    if (!video) {
      throw new Error("Video not found");
    }

    if (userId === video.creatorId) {
      throw new Error("Cannot remove the creator");
    }

    if (currentUserId !== video.creatorId && currentUserId !== userId) {
      throw new Error(
        "Only the creator or the user themselves can remove a collaborator"
      );
    }

    const collaboratorToRemove = video.collaborators.find(
      (c) => c.userId === userId
    );
    if (!collaboratorToRemove) {
      throw new Error("User is not a collaborator");
    }

    const docRef = doc(firestore, VIDEOS_COLLECTION, videoId);
    await updateDoc(docRef, {
      collaborators: arrayRemove({
        userId: collaboratorToRemove.userId,
        displayName: collaboratorToRemove.displayName ?? null,
        avatarUrl: collaboratorToRemove.avatarUrl ?? null,
        joinedAt: collaboratorToRemove.joinedAt,
        role: collaboratorToRemove.role,
      }),
      collaboratorIds: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to remove collaborator:", error);
    toast.error("Failed to remove collaborator.");
    throw error;
  }
}

export async function getVideosForSequence(
  sequenceId: string
): Promise<CollaborativeVideo[]> {
  try {
    const firestore = await getFirestoreInstance();
    const collectionRef = collection(firestore, VIDEOS_COLLECTION);
    const q = query(
      collectionRef,
      where("sequenceId", "==", sequenceId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => docToVideo(doc.data(), doc.id));
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to get videos for sequence:", error);
    return [];
  }
}

export async function getUserVideoLibrary(): Promise<UserVideoLibrary> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const collectionRef = collection(firestore, VIDEOS_COLLECTION);

    const collaboratorQuery = query(
      collectionRef,
      where("collaboratorIds", "array-contains", userId),
      orderBy("createdAt", "desc")
    );

    const pendingQuery = query(
      collectionRef,
      where("pendingInviteUserIds", "array-contains", userId)
    );

    const [collaboratorSnapshot, pendingSnapshot] = await Promise.all([
      getDocs(collaboratorQuery),
      getDocs(pendingQuery),
    ]);

    const allCollaborations = collaboratorSnapshot.docs.map((doc) =>
      docToVideo(doc.data(), doc.id)
    );

    const created = allCollaborations.filter((v) => v.creatorId === userId);
    const collaborations = allCollaborations.filter(
      (v) => v.creatorId !== userId
    );
    const pendingInvites = pendingSnapshot.docs.map((doc) =>
      docToVideo(doc.data(), doc.id)
    );

    return { created, collaborations, pendingInvites };
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to get user video library:", error);
    toast.error("Failed to load your video library.");
    return { created: [], collaborations: [], pendingInvites: [] };
  }
}

export async function getPendingInvites(): Promise<CollaborativeVideo[]> {
  try {
    const firestore = await getFirestoreInstance();
    const userId = getUserId();
    const collectionRef = collection(firestore, VIDEOS_COLLECTION);

    const q = query(
      collectionRef,
      where("pendingInviteUserIds", "array-contains", userId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => docToVideo(doc.data(), doc.id));
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to get pending invites:", error);
    return [];
  }
}

export async function getPublicVideos(limit = 50): Promise<CollaborativeVideo[]> {
  try {
    const firestore = await getFirestoreInstance();
    const collectionRef = collection(firestore, VIDEOS_COLLECTION);

    const q = query(
      collectionRef,
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc"),
      firestoreLimit(limit)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => docToVideo(doc.data(), doc.id));
  } catch (error) {
    console.error("❌ [CollaborativeVideoManager] Failed to get public videos:", error);
    return [];
  }
}
