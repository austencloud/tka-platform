const ZERO_OID = /^0+$/;

export function parsePushUpdates(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localOid, remoteRef, remoteOid] = line.split(/\s+/);
      return { localRef, localOid, remoteRef, remoteOid };
    })
    .filter(
      ({ localRef, localOid, remoteRef, remoteOid }) =>
        localRef && localOid && remoteRef && remoteOid
    );
}

export function choosePushedCommit(updates, headOid, headRef) {
  const commits = updates.filter(
    ({ localRef, localOid }) =>
      localRef !== "(delete)" && localOid && !ZERO_OID.test(localOid)
  );

  if (commits.length === 0) return updates.length === 0 ? headOid : null;

  return (
    commits.find(({ localRef }) => localRef === headRef)?.localOid ??
    commits.find(({ localOid }) => localOid === headOid)?.localOid ??
    commits[0].localOid
  );
}

export function parseAdbDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      const attributes = Object.fromEntries(
        details
          .map((detail) => detail.split(/:(.*)/s).slice(0, 2))
          .filter(([key, value]) => key && value)
      );
      const connection = serial.startsWith("emulator-")
        ? "emulator"
        : serial.startsWith("adb-") || serial.includes(":")
          ? "wireless"
          : "usb";

      return { serial, state, connection, attributes };
    })
    .filter(({ serial, state }) => serial && state);
}

export function selectAndroidDevice(devices, requestedSerial = "") {
  const authorized = devices.filter(({ state }) => state === "device");

  if (requestedSerial) {
    const requested = authorized.find(
      ({ serial }) => serial === requestedSerial
    );
    return requested
      ? { device: requested, reason: "requested" }
      : { device: null, reason: "requested-device-unavailable" };
  }

  const usb = authorized.filter(({ connection }) => connection === "usb");
  if (usb.length === 1) return { device: usb[0], reason: "single-usb" };
  if (usb.length > 1) return { device: null, reason: "multiple-usb" };

  const hardware = authorized.filter(
    ({ connection }) => connection !== "emulator"
  );
  if (hardware.length === 1) {
    return { device: hardware[0], reason: "single-hardware" };
  }
  if (hardware.length > 1) {
    return { device: null, reason: "multiple-hardware" };
  }

  if (authorized.length === 1) {
    return { device: authorized[0], reason: "single-emulator" };
  }
  if (authorized.length > 1) {
    return { device: null, reason: "multiple-emulators" };
  }

  return { device: null, reason: "none" };
}

export function readJavaProperty(contents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = contents.match(
    new RegExp(`^\\s*${escapedKey}\\s*=\\s*(.+?)\\s*$`, "m")
  );
  if (!match) return null;

  return match[1]
    .replace(/\\\\/g, "\\")
    .replace(/\\:/g, ":")
    .replace(/\\ /g, " ");
}

export function parseJavaMajor(versionOutput) {
  const match = versionOutput.match(
    /(?:javac\s+|version\s+\"?)(\d+)(?:\.(\d+))?/i
  );
  if (!match) return null;

  const first = Number(match[1]);
  return first === 1 && match[2] ? Number(match[2]) : first;
}

export function buildWindowsCommandLine(command, args) {
  const tokens = [command, ...args];
  const unsafe = tokens.find((token) => /[\s\"&|<>^%!()]/.test(token));
  if (unsafe) {
    throw new Error(
      `Windows command token requires unsupported quoting: ${unsafe}`
    );
  }
  return tokens.join(" ");
}

export function createNativeBuildEnv(exampleContents, localContents) {
  const localPublicLines = new Map();
  for (const line of localContents.split(/\r?\n/)) {
    const match = line.match(/^\s*((?:PUBLIC_|VITE_)[A-Z0-9_]+)\s*=.*$/);
    if (match) localPublicLines.set(match[1], line);
  }

  const exampleLines = exampleContents.split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    return !match || !localPublicLines.has(match[1]);
  });

  return [...localPublicLines.values(), ...exampleLines].join("\n");
}
