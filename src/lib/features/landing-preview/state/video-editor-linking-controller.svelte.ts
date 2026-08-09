import type { SequenceMatcher } from "../services/sequence-matcher";
import type { LinkedSequence, MatchedSequence } from "../types";
import { reportVideoEditError } from "./video-editor-errors";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";
import type { VideoCuratorPersister } from "./video-editor-types";

export interface VideoEditorLinkingController {
  readonly sequenceSearchQuery: string;
  readonly matchedSequences: MatchedSequence[];
  readonly sequenceSearching: boolean;
  readonly selectedSequenceForLink: MatchedSequence | null;
  readonly maxLinks: number;
  readonly canAddMoreLinks: boolean;
  readonly showLinkingSection: boolean;

  resetLinkingState(): void;
  searchSequences(query: string): Promise<void>;
  searchSequencesForCurrentVideo(): Promise<void>;
  searchSequencesForTitle(query: string): Promise<MatchedSequence[]>;
  linkSequence(sequence: MatchedSequence): Promise<void>;
  unlinkSequence(sequenceId: string): Promise<void>;
  selectSequenceForLink(sequence: MatchedSequence): void;
  confirmLink(): Promise<void>;
}

export function createVideoEditorLinkingController(
  session: VideoEditorSessionState,
  persister: VideoCuratorPersister,
  sequenceMatcher: SequenceMatcher
): VideoEditorLinkingController {
  let sequenceSearchQuery = $state("");
  let matchedSequences = $state<MatchedSequence[]>([]);
  let sequenceSearching = $state(false);
  let selectedSequenceForLink = $state<MatchedSequence | null>(null);

  const maxLinks = $derived.by(() =>
    session.currentVideo?.category === "demonstration" ? 1 : Infinity
  );
  const canAddMoreLinks = $derived(
    maxLinks > 0 &&
      (session.currentVideo?.linkedSequences.length ?? 0) < maxLinks
  );
  const showLinkingSection = $derived(maxLinks > 0);

  function resetLinkingState(): void {
    matchedSequences = [];
    selectedSequenceForLink = null;
    sequenceSearchQuery = "";
  }

  async function searchSequences(query: string): Promise<void> {
    sequenceSearchQuery = query;
    if (!query || query.length < 2) {
      matchedSequences = [];
      return;
    }
    sequenceSearching = true;
    try {
      matchedSequences = await sequenceMatcher.searchByWord(query);
    } catch (error) {
      console.error("Failed to search sequences:", error);
      matchedSequences = [];
    } finally {
      sequenceSearching = false;
    }
  }

  async function searchSequencesForCurrentVideo(): Promise<void> {
    const video = session.currentVideo;
    if (!video?.title) return;
    sequenceSearching = true;
    matchedSequences = [];
    try {
      const results = await sequenceMatcher.searchByWord(video.title);
      matchedSequences = results;
      if (results.length === 1) {
        selectedSequenceForLink = results[0] ?? null;
      }
    } catch (error) {
      console.error("Failed to search sequences:", error);
    } finally {
      sequenceSearching = false;
    }
  }

  async function searchSequencesForTitle(
    query: string
  ): Promise<MatchedSequence[]> {
    if (!query || query.length < 2) return [];
    try {
      return await sequenceMatcher.searchByWord(query);
    } catch (error) {
      console.error("Failed to search sequences for title:", error);
      return [];
    }
  }

  async function linkSequence(sequence: MatchedSequence): Promise<void> {
    if (!session.currentVideo || session.saving || maxLinks === 0) return;

    session.setSaving(true);
    try {
      const newLinked: LinkedSequence = {
        id: sequence.id,
        word: sequence.word,
        thumbnail: sequence.thumbnail,
        ownerName: sequence.ownerName,
      };
      let updatedLinks: LinkedSequence[];
      if (maxLinks === 1) {
        updatedLinks = [newLinked];
      } else {
        if (
          session.currentVideo.linkedSequences.some(
            (link) => link.id === sequence.id
          )
        ) {
          session.setSaving(false);
          return;
        }
        updatedLinks = [...session.currentVideo.linkedSequences, newLinked];
      }

      await persister.updateVideo(session.currentVideo.shortcode, {
        linkedSequences: updatedLinks,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        linkedSequences: updatedLinks,
      });
      sequenceSearchQuery = "";
      matchedSequences = [];
    } catch (error) {
      reportVideoEditError("link sequence", error);
    } finally {
      session.setSaving(false);
    }
  }

  async function unlinkSequence(sequenceId: string): Promise<void> {
    if (!session.currentVideo || session.saving) return;
    session.setSaving(true);
    try {
      const updatedLinks = session.currentVideo.linkedSequences.filter(
        (link) => link.id !== sequenceId
      );
      await persister.updateVideo(session.currentVideo.shortcode, {
        linkedSequences: updatedLinks,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        linkedSequences: updatedLinks,
      });
    } catch (error) {
      reportVideoEditError("unlink sequence", error);
    } finally {
      session.setSaving(false);
    }
  }

  function selectSequenceForLink(sequence: MatchedSequence): void {
    selectedSequenceForLink = sequence;
  }

  async function confirmLink(): Promise<void> {
    if (!selectedSequenceForLink) return;
    await linkSequence(selectedSequenceForLink);
    selectedSequenceForLink = null;
    if (session.mode === "link") {
      setTimeout(() => {
        if (session.unlinkableVideos.length > 0) {
          void searchSequencesForCurrentVideo();
        }
      }, 300);
    }
  }

  return {
    get sequenceSearchQuery() {
      return sequenceSearchQuery;
    },
    get matchedSequences() {
      return matchedSequences;
    },
    get sequenceSearching() {
      return sequenceSearching;
    },
    get selectedSequenceForLink() {
      return selectedSequenceForLink;
    },
    get maxLinks() {
      return maxLinks;
    },
    get canAddMoreLinks() {
      return canAddMoreLinks;
    },
    get showLinkingSection() {
      return showLinkingSection;
    },
    resetLinkingState,
    searchSequences,
    searchSequencesForCurrentVideo,
    searchSequencesForTitle,
    linkSequence,
    unlinkSequence,
    selectSequenceForLink,
    confirmLink,
  };
}
