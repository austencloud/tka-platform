import { getContext, setContext } from "svelte";
import type { MessageDeliveryState } from "../state/message-delivery-state.svelte";

const MESSAGE_DELIVERY_CONTEXT = Symbol("message-delivery-context");

export function setMessageDeliveryContext(state: MessageDeliveryState): void {
  setContext(MESSAGE_DELIVERY_CONTEXT, state);
}

export function getMessageDeliveryContext(): MessageDeliveryState {
  const state = getContext<MessageDeliveryState>(MESSAGE_DELIVERY_CONTEXT);
  if (!state) {
    throw new Error("Message delivery context is not available.");
  }
  return state;
}
