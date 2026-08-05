/**
 * Public profile provisioning — Auth onCreate trigger.
 *
 * The counterpart to onAuthUserDeleted. v2 identity triggers are blocking-only,
 * and a blocking beforeCreate hook that throws would BLOCK the signup — wrong
 * trade for a profile document. So this is v1: `auth.user().onCreate()`, which
 * fires after the account exists and retries on failure.
 *
 * Guest sessions are skipped here (provisionUserProfile returns
 * "skipped-anonymous"). A guest is not a signup, and pulseUserActivity treats a
 * fresh full-account doc as one. Guests that later upgrade in place keep their
 * uid and never fire onCreate again — reconcileMissingProfiles covers that
 * path.
 */

import * as functionsV1 from "firebase-functions/v1";
import { provisionUserProfile } from "./provisionUserProfile";

export const onAuthUserCreated = functionsV1.auth
  .user()
  .onCreate(async (user) => {
    const outcome = await provisionUserProfile(user);
    console.log(
      `[onAuthUserCreated] ${user.uid} (${user.email ?? "no email"}): ${outcome}`
    );
  });
