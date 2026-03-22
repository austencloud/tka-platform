"use strict";
/**
 * Firebase Cloud Functions Entry Point
 *
 * Exports all Cloud Functions for the TKA Composer application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastGetServerTime = exports.broadcastForceGenerate = exports.broadcastConductor = void 0;
// Live Broadcast System
var conductor_1 = require("./broadcast/conductor");
Object.defineProperty(exports, "broadcastConductor", { enumerable: true, get: function () { return conductor_1.conductorTick; } });
Object.defineProperty(exports, "broadcastForceGenerate", { enumerable: true, get: function () { return conductor_1.forceGenerate; } });
Object.defineProperty(exports, "broadcastGetServerTime", { enumerable: true, get: function () { return conductor_1.getServerTime; } });
//# sourceMappingURL=index.js.map