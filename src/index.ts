/**
 * bConnect Mock Server — Entry Point
 *
 * Reads environment variables to determine profile and BMS version,
 * then starts the Express server.
 *
 * Environment variables:
 *   PORT                    — TCP port to listen on (default: 3433)
 *   BIND_ADDRESS            — Network interface to bind to (default: 0.0.0.0)
 *                             Set to 127.0.0.1 to restrict to loopback only.
 *                             A warning is emitted when binding to a non-loopback address.
 *   BCONNECT_PROFILE        — Profile mode (default: standard-readonly)
 *   BCONNECT_BMS_VERSION    — BMS version: 25r2 | 26r1 (default: 25r2)
 *   LOG_LEVEL               — Logging level: info | debug (default: info)
 *   LOG_FORMAT              — Log output format: text | json (default: text)
 */

import { createApp } from './app';
import { ProfileMode, BmsVersion } from './profiles/ProfileManager';

const PORT = parseInt(process.env.PORT ?? '3433', 10);

// P10.16 — Validate PORT is a valid TCP port number (1–65535)
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(
    `[bconnect-mock] Invalid PORT="${process.env.PORT}". Must be an integer between 1 and 65535.`
  );
  process.exit(1);
}

// Resolve profile mode from env
const profileEnv = (process.env.BCONNECT_PROFILE ?? 'standard-readonly').toLowerCase();
const profileMap: Record<string, ProfileMode> = {
  'minimal-readonly': ProfileMode.MINIMAL_READONLY,
  'minimal-readwrite': ProfileMode.MINIMAL_READWRITE,
  'standard-readonly': ProfileMode.STANDARD_READONLY,
  'standard-readwrite': ProfileMode.STANDARD_READWRITE,
  'largescale-readonly': ProfileMode.LARGESCALE_READONLY,
};
const profileMode = profileMap[profileEnv];
if (!profileMode) {
  console.error(
    `[bconnect-mock] Invalid BCONNECT_PROFILE="${profileEnv}". ` +
      `Valid values: ${Object.keys(profileMap).join(', ')}`
  );
  process.exit(1);
}

// Resolve BMS version from env
const versionEnv = (process.env.BCONNECT_BMS_VERSION ?? '25r2').toLowerCase();
const versionMap: Record<string, BmsVersion> = {
  '25r2': BmsVersion.BMS_25R2,
  '26r1': BmsVersion.BMS_26R1,
};
const bmsVersion = versionMap[versionEnv];
if (!bmsVersion) {
  console.error(
    `[bconnect-mock] Invalid BCONNECT_BMS_VERSION="${versionEnv}". Valid values: 25r2, 26r1`
  );
  process.exit(1);
}

// M1 — Bind address: default 0.0.0.0 (all interfaces). Set BIND_ADDRESS=127.0.0.1 to restrict
// to loopback only. A security warning is emitted for non-loopback binds.
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', 'localhost']);
const bindAddress = process.env.BIND_ADDRESS ?? '0.0.0.0';

const app = createApp(profileMode, bmsVersion);

const server = app.listen(PORT, bindAddress, () => {
  console.info(`[bconnect-mock] Server started`);
  console.info(`[bconnect-mock]   Profile:     ${profileEnv}`);
  console.info(`[bconnect-mock]   BMS version: ${versionEnv}`);
  console.info(`[bconnect-mock]   Listening:   http://${bindAddress}:${PORT}`);
  console.info(`[bconnect-mock]   Health:      http://localhost:${PORT}/health`);
  console.info(`[bconnect-mock]   Metrics:     http://localhost:${PORT}/metrics`);
  console.info(`[bconnect-mock]   API docs:    http://localhost:${PORT}/api-docs`);

  if (!LOOPBACK_ADDRESSES.has(bindAddress)) {
    console.warn(
      `[bconnect-mock] SECURITY WARNING: Server is bound to '${bindAddress}' — not restricted to loopback.`
    );
    console.warn(
      `[bconnect-mock] SECURITY WARNING: Do not expose this mock server on public or untrusted networks.`
    );
    console.warn(
      `[bconnect-mock] SECURITY WARNING: Set BIND_ADDRESS=127.0.0.1 to restrict to localhost only.`
    );
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('[bconnect-mock] SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.info('[bconnect-mock] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('[bconnect-mock] SIGINT received — shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
