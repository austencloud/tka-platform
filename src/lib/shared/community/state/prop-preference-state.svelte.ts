import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  loadPropPreferences,
  addPropPreference,
  removePropPreference,
  setFavoriteProp,
  setCatdogFavorite as persistCatdogFavorite,
} from "../services/prop-preference-persister";
import type { CatdogCombo } from "../services/types";

export function createPropPreferenceState(
  userId: string
) {
  let propsISpinWith = $state<PropType[]>([]);
  let favoriteProp = $state<PropType | null>(null);
  let favoriteCatdog = $state<CatdogCombo | null>(null);
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      const prefs = await loadPropPreferences(userId);
      propsISpinWith = prefs.propsISpinWith;
      favoriteProp = prefs.favoriteProp;
      favoriteCatdog = prefs.favoriteCatdog;
    } finally {
      loading = false;
    }
  }

  async function toggleProp(prop: PropType) {
    // Update local state first (optimistic), then persist in background.
    // No saving flag - toggles are instant and don't need a loading indicator.
    if (propsISpinWith.includes(prop)) {
      propsISpinWith = propsISpinWith.filter((p) => p !== prop);
      if (favoriteProp === prop) favoriteProp = null;
      if (
        favoriteCatdog &&
        (favoriteCatdog.bluePropType === prop || favoriteCatdog.redPropType === prop)
      ) {
        favoriteCatdog = null;
      }
      await removePropPreference(userId, prop);
    } else {
      propsISpinWith = [...propsISpinWith, prop];
      await addPropPreference(userId, prop);
    }
  }

  async function setFavorite(prop: PropType) {
    saving = true;
    try {
      if (!propsISpinWith.includes(prop)) {
        propsISpinWith = [...propsISpinWith, prop];
      }
      favoriteProp = prop;
      await setFavoriteProp(userId, prop);
    } finally {
      saving = false;
    }
  }

  async function setCatdogFavorite(combo: CatdogCombo | null) {
    saving = true;
    try {
      if (combo) {
        if (!propsISpinWith.includes(combo.bluePropType)) {
          propsISpinWith = [...propsISpinWith, combo.bluePropType];
        }
        if (!propsISpinWith.includes(combo.redPropType)) {
          propsISpinWith = [...propsISpinWith, combo.redPropType];
        }
      }
      favoriteCatdog = combo;
      await persistCatdogFavorite(userId, combo);
    } finally {
      saving = false;
    }
  }

  // Auto-load on creation
  void load();

  return {
    get propsISpinWith() { return propsISpinWith; },
    get favoriteProp() { return favoriteProp; },
    get favoriteCatdog() { return favoriteCatdog; },
    get loading() { return loading; },
    get saving() { return saving; },
    toggleProp,
    setFavorite,
    setCatdogFavorite,
    reload: load,
  };
}

export type PropPreferenceState = ReturnType<typeof createPropPreferenceState>;
