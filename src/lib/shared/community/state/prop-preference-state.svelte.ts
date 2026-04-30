import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IPropPreferencePersister,
  CatdogCombo,
} from "../services/contracts/IPropPreferencePersister";

export function createPropPreferenceState(
  persister: IPropPreferencePersister,
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
      const prefs = await persister.load(userId);
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
      await persister.removeProp(userId, prop);
    } else {
      propsISpinWith = [...propsISpinWith, prop];
      await persister.addProp(userId, prop);
    }
  }

  async function setFavorite(prop: PropType) {
    saving = true;
    try {
      if (!propsISpinWith.includes(prop)) {
        propsISpinWith = [...propsISpinWith, prop];
      }
      favoriteProp = prop;
      await persister.setFavorite(userId, prop);
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
      await persister.setCatdogFavorite(userId, combo);
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
