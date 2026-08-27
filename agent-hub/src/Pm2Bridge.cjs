// Small programmatic PM2 bridge for Agent Hub.
//
// PM2's interactive CLI can stay alive for several seconds on Windows after a
// command has completed. Agent Hub only needs one bounded request, so this
// bridge uses PM2's supported programmatic API and always disconnects from the
// daemon before it exits.

"use strict";

const path = require("path");

let pm2 = null;
let finished = false;

function fail(message) {
  finish(1, "", message instanceof Error ? message.message : String(message || "PM2 request failed."));
}

function finish(code, output, error) {
  if (finished) return;
  finished = true;

  const writeAndExit = () => {
    if (error) process.stderr.write(error.trim() + "\n");
    if (output) process.stdout.write(output.trim() + "\n");
    process.exit(code);
  };

  if (!pm2) {
    writeAndExit();
    return;
  }

  let disconnected = false;
  const afterDisconnect = () => {
    if (disconnected) return;
    disconnected = true;
    writeAndExit();
  };

  try {
    pm2.disconnect(afterDisconnect);
    setTimeout(afterDisconnect, 500);
  } catch (_) {
    afterDisconnect();
  }
}

function requireValue(value, name) {
  if (!value || /[\r\n\t]/.test(value)) throw new Error("Invalid " + name + ".");
  return value;
}

function connect(callback) {
  pm2.connect((error) => {
    if (error) {
      fail(error);
      return;
    }
    callback();
  });
}

function status(appName) {
  connect(() => {
    pm2.list((error, processes) => {
      if (error) {
        fail(error);
        return;
      }

      const processInfo = (processes || []).find((entry) => entry && entry.name === appName);
      if (!processInfo) {
        finish(0, "0\tmissing", "");
        return;
      }

      const pid = Number(processInfo.pid) > 0 ? Number(processInfo.pid) : 0;
      const state = processInfo.pm2_env && processInfo.pm2_env.status
        ? String(processInfo.pm2_env.status)
        : "unknown";
      finish(0, String(pid) + "\t" + state, "");
    });
  });
}

function restart(appName) {
  connect(() => {
    pm2.restart(appName, { updateEnv: true }, (error) => {
      if (error) fail(error);
      else finish(0, "ok", "");
    });
  });
}

function start(configPath, appName) {
  connect(() => {
    pm2.start(configPath, { only: appName, updateEnv: true }, (error) => {
      if (error) {
        fail(error);
        return;
      }

      pm2.dump((dumpError) => {
        if (dumpError) fail(dumpError);
        else finish(0, "ok", "");
      });
    });
  });
}

try {
  const action = requireValue(process.argv[2], "action");
  const pm2Root = path.resolve(requireValue(process.argv[3], "PM2 root"));
  pm2 = require(pm2Root);

  if (action === "status") {
    status(requireValue(process.argv[4], "PM2 app name"));
  } else if (action === "restart") {
    restart(requireValue(process.argv[4], "PM2 app name"));
  } else if (action === "start") {
    start(path.resolve(requireValue(process.argv[4], "PM2 config")), requireValue(process.argv[5], "PM2 app name"));
  } else {
    throw new Error("Unsupported PM2 action.");
  }
} catch (error) {
  fail(error);
}
