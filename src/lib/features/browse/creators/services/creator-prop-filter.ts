import { collection, query, where, orderBy, limit as firestoreLimit, getDocs } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

export async function queryByProp(prop: PropType, maxResults: number): Promise<UserProfile[]> {
  const db = await getFirestoreInstance();
  const q = query(
    collection(db, "users"),
    where("propsISpinWith", "array-contains", prop),
    orderBy("lastActivityDate", "desc"),
    firestoreLimit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as UserProfile[];
}

export function filterByProps(profiles: UserProfile[], requiredProps: PropType[]): UserProfile[] {
  if (requiredProps.length === 0) return profiles;
  return profiles.filter((profile) => {
    const userProps = profile.propsISpinWith ?? [];
    return requiredProps.every((prop) => userProps.includes(prop));
  });
}

export function groupByFavoriteProp(profiles: UserProfile[]): Map<PropType | "none", UserProfile[]> {
  const groups = new Map<PropType | "none", UserProfile[]>();
  for (const profile of profiles) {
    const key = profile.favoriteProp ?? "none";
    const group = groups.get(key) ?? [];
    group.push(profile);
    groups.set(key, group);
  }
  return groups;
}
