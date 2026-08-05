import { getContext, setContext } from "svelte";
import type { AccountSetupState } from "../state/account-setup-state.svelte";

const ACCOUNT_SETUP_CONTEXT_KEY = Symbol("account-setup");

export function setAccountSetupContext(state: AccountSetupState): void {
  setContext(ACCOUNT_SETUP_CONTEXT_KEY, state);
}

export function getAccountSetupContext(): AccountSetupState {
  const state = getContext<AccountSetupState>(ACCOUNT_SETUP_CONTEXT_KEY);
  if (!state) {
    throw new Error("Account setup context is not available");
  }
  return state;
}

export function tryGetAccountSetupContext(): AccountSetupState | null {
  return getContext<AccountSetupState>(ACCOUNT_SETUP_CONTEXT_KEY) ?? null;
}
