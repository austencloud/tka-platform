"use strict";

/* global module, process */

const titleShieldMarker = Symbol.for(
  "tka.chrome-devtools-mcp.process-title-shield"
);

function preserveNodeConsoleTitle(targetProcess = process) {
  if (targetProcess[titleShieldMarker]) return false;

  const titleDescriptor = Object.getOwnPropertyDescriptor(
    targetProcess,
    "title"
  );
  if (!titleDescriptor?.configurable) {
    throw new Error(
      "Node's process.title property cannot be shielded on this runtime."
    );
  }

  let reportedTitle = targetProcess.title;
  Object.defineProperty(targetProcess, "title", {
    configurable: true,
    enumerable: titleDescriptor.enumerable,
    get() {
      return reportedTitle;
    },
    set(value) {
      reportedTitle = String(value);
    },
  });
  Object.defineProperty(targetProcess, titleShieldMarker, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return true;
}

preserveNodeConsoleTitle();

module.exports = { preserveNodeConsoleTitle, titleShieldMarker };
