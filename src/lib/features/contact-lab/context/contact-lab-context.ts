import { getContext, setContext } from "svelte";
import type { ContactLabState } from "../state/contact-lab-state.svelte";

const CONTACT_LAB_CONTEXT = Symbol("contact-lab");

export function setContactLabContext(state: ContactLabState): void {
  setContext(CONTACT_LAB_CONTEXT, state);
}

export function getContactLabContext(): ContactLabState {
  return getContext<ContactLabState>(CONTACT_LAB_CONTEXT);
}
