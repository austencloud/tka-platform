import { mount, unmount } from "svelte";
import CapturePointer from "./CapturePointer.svelte";

/** Local capture utility. The pointer follows native browser input. */
export function mountCapturePointer() {
  const host = document.createElement("div");
  host.dataset.capturePointer = "";
  document.body.append(host);
  const pointer = mount(CapturePointer, { target: host });
  return async () => {
    await unmount(pointer);
    host.remove();
  };
}
