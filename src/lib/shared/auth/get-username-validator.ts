import * as usernameValidator from './services/username-validator';
export function getUsernameValidator(): typeof usernameValidator { return usernameValidator; }
