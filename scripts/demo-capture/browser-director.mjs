import fs from "node:fs/promises";
import path from "node:path";

// Pass the documented Browser runtime tab and its CDP capability from Node REPL.
export function createDirector(tab, cdp, root) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let recording = null;
  async function pump() {
    if (!recording) return;
    const batch = await cdp.readEvents({
      methods: ["Page.screencastFrame"],
      afterSequence: recording.cursor,
      limit: 100,
      timeoutMs: 0,
    });
    recording.cursor = batch.cursor;
    if (batch.truncated) throw Error("Screencast event buffer truncated");
    for (const event of batch.events) {
      await cdp.send("Page.screencastFrameAck", {
        sessionId: event.params.sessionId,
      });
      const file = String(recording.frames.length).padStart(5, "0") + ".jpg";
      await fs.writeFile(
        path.join(recording.dir, file),
        Buffer.from(event.params.data, "base64")
      );
      recording.frames.push({
        file,
        timestamp: event.params.metadata.timestamp,
      });
    }
  }
  async function wait(ms) {
    const until = Date.now() + ms;
    do {
      await pump();
      await sleep(10);
    } while (Date.now() < until);
  }
  let pointer = { x: 1145, y: 1020 };
  let events = [];
  let started = 0;

  async function move(x, y) {
    const from = { ...pointer };
    const start = Date.now();
    do {
      const t = Math.min(1, (Date.now() - start) / 540);
      const amount = t * t * (3 - 2 * t);
      pointer = {
        x: from.x + (x - from.x) * amount,
        y: from.y + (y - from.y) * amount,
      };
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...pointer,
      });
      if (t >= 1) break;
      await wait(16);
    } while (true);
  }

  async function target(label, role = "button") {
    const locator = tab.playwright.getByRole(role, {
      name: label,
      exact: true,
    });
    const rect = await tab.playwright.evaluate((label) => {
      const el = [
        ...document.querySelectorAll('button,a,input,[role="radio"]'),
      ].find(
        (e) =>
          !e.closest("[inert]") &&
          e.getBoundingClientRect().width &&
          (e.getAttribute("aria-label") === label ||
            e.textContent?.trim() === label ||
            e.querySelector(".chip-label")?.textContent?.trim() === label)
      );
      if (!el) throw Error("Missing visible target " + label);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest("[inert]"))
        throw Error("Target is not visible");
      return { x: r.x + r.width * 0.65, y: r.y + r.height * 0.65 };
    }, label);
    await move(rect.x, rect.y);
    await wait(240);
    const hovered = await tab.playwright.evaluate(
      (label) =>
        [...document.querySelectorAll(":hover")].some(
          (e) =>
            e.getAttribute("aria-label") === label ||
            e.textContent?.trim() === label ||
            e.querySelector(".chip-label")?.textContent?.trim() === label
        ),
      label
    );
    if (!hovered) throw Error("Native hover did not reach " + label);
    return locator;
  }

  async function click(label, role = "button") {
    await target(label, role);
    events.push({
      label,
      action: "click",
      time: (Date.now() - started) / 1000,
      ...pointer,
      hover: true,
    });
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...pointer,
    });
    await wait(140);
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...pointer,
    });
    await wait(200);
  }

  async function fill(label, value) {
    const locator = await target(label, "spinbutton");
    await locator.fill(String(value));
    await locator.press("Tab");
    events.push({
      label,
      action: "fill",
      value,
      time: (Date.now() - started) / 1000,
      ...pointer,
      hover: true,
    });
  }

  async function cell(index = 3) {
    const labels = await tab.playwright
      .getByRole("button", { name: / over / })
      .allTextContents({});
    const locator = tab.playwright
      .getByRole("button", { name: / over / })
      .nth(index);
    if (index >= labels.length) throw Error("Missing matrix crossing");
    await click(await locator.getAttribute("aria-label"));
  }

  async function mountPointer() {
    await cdp.send("Runtime.evaluate", {
      expression:
        "window.removeCapturePointer?.(); import('/scripts/demo-capture/mount-pointer.ts').then(m=>{window.removeCapturePointer=m.mountCapturePointer()})",
      awaitPromise: true,
    });
    await move(pointer.x, pointer.y);
  }

  async function canvas() {
    const point = await tab.playwright.evaluate(() => {
      const el = [...document.querySelectorAll("canvas")].find(
        (e) => !e.closest("[inert]") && e.getBoundingClientRect().width
      );
      if (!el) throw Error("No visible animation canvas");
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await move(point.x, point.y);
    await wait(240);
    const hovered = await tab.playwright.evaluate(
      () => !!document.querySelector(".canvas-wrapper:hover")
    );
    if (!hovered) throw Error("Native hover missed animation canvas");
    events.push({
      label: "Animation canvas",
      action: "click",
      time: (Date.now() - started) / 1000,
      ...pointer,
      hover: true,
    });
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...pointer,
    });
    await wait(140);
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...pointer,
    });
    await wait(200);
  }

  async function shot(id, seconds, action) {
    const dir = path.join(root, "production", "frames", id);
    await fs.mkdir(dir, { recursive: true });
    await move(1145, 1020);
    events = [];
    const initial = await cdp.readEvents({ methods: ["Page.screencastFrame"] });
    const frames = [];
    recording = { dir, frames, cursor: initial.cursor };
    started = Date.now();
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 90,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: 1,
    });
    let failure;
    try {
      if (action) await action();
      await wait(
        Math.max(action ? 2500 : 0, seconds * 1000 - (Date.now() - started))
      );
    } catch (error) {
      failure = String(error);
    } finally {
      await pump();
      await cdp.send("Page.stopScreencast");
      recording = null;
    }
    const proof = {
      id,
      requestedDuration: seconds,
      elapsed: (Date.now() - started) / 1000,
      events,
      frames,
      failure,
      url: await tab.url(),
      snapshot: await tab.playwright.domSnapshot(),
    };
    await fs.writeFile(
      path.join(dir, "capture.json"),
      JSON.stringify(proof, null, 2)
    );
    if (failure) throw Error(failure);
    return {
      id,
      frames: frames.length,
      events: events.map(({ label, time, hover }) => ({ label, time, hover })),
    };
  }
  return { wait, move, click, fill, cell, canvas, mountPointer, shot };
}
