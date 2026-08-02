import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { PresenceLocation } from "$lib/shared/presence/domain/models/presence-models";

export interface AdminUserProfile extends EnhancedUserProfile {
  location?: PresenceLocation | null;
  adminLabel?: string;
  adminNotes?: string;
}
