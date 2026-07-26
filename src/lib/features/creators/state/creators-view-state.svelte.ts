/**
 * Creators View State
 * Manages the current view state of the Creators module
 * Handles navigation between creators list and user profiles
 */

interface CreatorsViewState {
  currentView: "list" | "user-profile";
  viewingUserId: string | null;
}

function createCreatorsViewState() {
  const state = $state<CreatorsViewState>({
    currentView: "list",
    viewingUserId: null,
  });

  return {
    get currentView() {
      return state.currentView;
    },
    get viewingUserId() {
      return state.viewingUserId;
    },

    /**
     * View a user's profile
     */
    viewUserProfile(userId: string) {
      state.viewingUserId = userId;
      state.currentView = "user-profile";
    },

    /**
     * Go back to the creators list
     */
    goBack() {
      state.currentView = "list";
      state.viewingUserId = null;
    },

    /**
     * Reset to default state
     */
    reset() {
      state.currentView = "list";
      state.viewingUserId = null;
    },
  };
}

export const creatorsViewState = createCreatorsViewState();
