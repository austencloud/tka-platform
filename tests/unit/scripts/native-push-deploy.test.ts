import { describe, expect, it } from "vitest";

import {
  buildWindowsCommandLine,
  choosePushedCommit,
  createNativeBuildEnv,
  parseAdbDevices,
  parseJavaMajor,
  parsePushUpdates,
  readJavaProperty,
  selectAndroidDevice,
} from "../../../scripts/lib/native-push-deploy-core.mjs";

describe("native push commit selection", () => {
  const head = "1".repeat(40);
  const other = "2".repeat(40);
  const remote = "3".repeat(40);

  it("builds the current branch commit from the pre-push input", () => {
    const updates = parsePushUpdates(
      `refs/heads/other ${other} refs/heads/other ${remote}\n` +
        `refs/heads/main ${head} refs/heads/main ${remote}\n`
    );

    expect(choosePushedCommit(updates, head, "refs/heads/main")).toBe(head);
  });

  it("falls back to HEAD when invoked outside a hook", () => {
    expect(choosePushedCommit([], head, "refs/heads/main")).toBe(head);
  });

  it("skips a deletion-only push", () => {
    const updates = parsePushUpdates(
      `(delete) ${"0".repeat(40)} refs/heads/old ${remote}\n`
    );

    expect(choosePushedCommit(updates, head, "refs/heads/main")).toBeNull();
  });
});

describe("Android device selection", () => {
  const output = `List of devices attached
RFCY30FJN5D device product:q6qsqw model:SM_F956U device:q6q transport_id:6
emulator-5554 device product:sdk_gphone model:sdk_gphone64_x86_64 transport_id:9
adb-wireless._adb-tls-connect._tcp device product:q6qsqw model:SM_F956U transport_id:12
OFFLINE123 unauthorized usb:1-2 transport_id:7
`;

  it("prefers the single USB phone over emulators and wireless entries", () => {
    const devices = parseAdbDevices(output);
    const selection = selectAndroidDevice(devices);

    expect(selection.reason).toBe("single-usb");
    expect(selection.device?.serial).toBe("RFCY30FJN5D");
    expect(selection.device?.attributes.model).toBe("SM_F956U");
  });

  it("honors ANDROID_SERIAL when the requested device is authorized", () => {
    const devices = parseAdbDevices(output);
    const selection = selectAndroidDevice(devices, "emulator-5554");

    expect(selection.reason).toBe("requested");
    expect(selection.device?.serial).toBe("emulator-5554");
  });

  it("does not guess when multiple USB devices are connected", () => {
    const devices = parseAdbDevices(
      "List of devices attached\nPHONE1 device\nPHONE2 device\n"
    );

    expect(selectAndroidDevice(devices)).toEqual({
      device: null,
      reason: "multiple-usb",
    });
  });

  it("ignores unauthorized devices", () => {
    const devices = parseAdbDevices(
      "List of devices attached\nPHONE1 unauthorized\n"
    );

    expect(selectAndroidDevice(devices)).toEqual({
      device: null,
      reason: "none",
    });
  });
});

describe("Android SDK property parsing", () => {
  it("decodes Windows backslashes from local.properties", () => {
    expect(
      readJavaProperty(
        "sdk.dir=C:\\\\Users\\\\Austen\\\\AppData\\\\Local\\\\Android\\\\Sdk\n",
        "sdk.dir"
      )
    ).toBe("C:\\Users\\Austen\\AppData\\Local\\Android\\Sdk");
  });
});

describe("Android JDK selection", () => {
  it("reads the Java major version from javac output", () => {
    expect(parseJavaMajor("javac 21.0.10")).toBe(21);
    expect(parseJavaMajor('openjdk version "24.0.1" 2026-04-15')).toBe(24);
    expect(parseJavaMajor('java version "1.8.0_411"')).toBe(8);
  });
});

describe("Windows command execution", () => {
  it("builds a shell-free command line for the fixed pnpm and Gradle commands", () => {
    expect(buildWindowsCommandLine("pnpm.cmd", ["run", "build"])).toBe(
      "pnpm.cmd run build"
    );
    expect(buildWindowsCommandLine(".\\gradlew.bat", ["assembleDebug"])).toBe(
      ".\\gradlew.bat assembleDebug"
    );
  });

  it("rejects tokens that would need cmd.exe quoting", () => {
    expect(() =>
      buildWindowsCommandLine("pnpm.cmd", ["run", "build & deploy"])
    ).toThrow("unsupported quoting");
  });
});

describe("native build environment", () => {
  it("copies local public values without copying local secrets", () => {
    const example = [
      "PUBLIC_FIREBASE_API_KEY=example-public",
      "ANTHROPIC_API_KEY=example-placeholder",
      "PUBLIC_APP_NAME=Flow Arts Composer",
    ].join("\n");
    const local = [
      "PUBLIC_FIREBASE_API_KEY=real-public",
      "VITE_R2_PUBLIC_URL=https://assets.example.com",
      "ANTHROPIC_API_KEY=local-secret",
    ].join("\n");

    const result = createNativeBuildEnv(example, local);

    expect(result).toContain("PUBLIC_FIREBASE_API_KEY=real-public");
    expect(result).toContain("VITE_R2_PUBLIC_URL=https://assets.example.com");
    expect(result).toContain("ANTHROPIC_API_KEY=example-placeholder");
    expect(result).not.toContain("local-secret");
    expect(result).not.toContain("example-public");
  });
});
