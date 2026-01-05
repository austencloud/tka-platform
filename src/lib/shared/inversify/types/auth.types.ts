/**
 * Authentication & User Service Type Identifiers
 */

export const AuthTypes = {
  IAuthenticator: Symbol.for("IAuthenticator"),
  IProfilePictureManager: Symbol.for("IProfilePictureManager"),
  IUserDocumentManager: Symbol.for("IUserDocumentManager"),
  IUserRepository: Symbol.for("IUserRepository"),
  IUsernameValidator: Symbol.for("IUsernameValidator"),
  ISubscriptionManager: Symbol.for("ISubscriptionManager"),
  IProfileApiClient: Symbol.for("IProfileApiClient"),
  IStepUpAuthCoordinator: Symbol.for("IStepUpAuthCoordinator"),
  IAccountManager: Symbol.for("IAccountManager"),
} as const;
