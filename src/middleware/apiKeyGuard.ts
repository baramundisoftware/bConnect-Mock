/**
 * apiKeyGuard — Optional authentication guard for bConnect mock
 *
 * Supports two modes controlled by environment variables:
 *
 * 1. REQUIRE_API_KEY  — When set, accepts `X-Api-Key` header matching this value.
 * 2. REQUIRE_BASIC_AUTH — When set (format "user:pass"), accepts Basic Auth matching
 *    these credentials.
 *
 * When both are set, either authentication method is accepted.
 * When neither is set, all requests pass through (no auth required).
 *
 * By default the guard applies to ALL requests (simulating real bConnect auth).
 * The write-only guard mode is used separately in app.ts for backward compatibility.
 *
 * Environment variables:
 *   REQUIRE_API_KEY    — API key secret; empty/whitespace disables API key auth
 *   REQUIRE_BASIC_AUTH — "username:password"; empty/whitespace disables basic auth
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Returns the configured API key, or null if not set.
 * Empty / whitespace-only values are treated as "not set".
 */
export function getConfiguredApiKey(): string | null {
  const raw = process.env.REQUIRE_API_KEY;
  if (!raw || raw.trim().length === 0) { return null; }
  return raw.trim();
}

/**
 * Returns the configured basic auth credentials, or null if not set.
 * Format: "username:password"
 */
export function getConfiguredBasicAuth(): { username: string; password: string } | null {
  const raw = process.env.REQUIRE_BASIC_AUTH;
  if (!raw || raw.trim().length === 0) { return null; }
  const colonIdx = raw.indexOf(':');
  if (colonIdx < 0) { return null; }
  return {
    username: raw.substring(0, colonIdx),
    password: raw.substring(colonIdx + 1),
  };
}

/** Timing-safe string comparison */
function timingSafeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Check if the request has a valid X-Api-Key header.
 */
function hasValidApiKey(req: Request, configuredKey: string): boolean {
  const providedKey = req.headers['x-api-key'];
  if (typeof providedKey !== 'string') { return false; }
  return timingSafeEquals(configuredKey, providedKey);
}

/**
 * Check if the request has valid Basic Auth credentials.
 */
function hasValidBasicAuth(req: Request, configuredAuth: { username: string; password: string }): boolean {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) { return false; }
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx < 0) { return false; }
  const username = decoded.substring(0, colonIdx);
  const password = decoded.substring(colonIdx + 1);
  return timingSafeEquals(configuredAuth.username, username) &&
    timingSafeEquals(configuredAuth.password, password);
}

/**
 * Express middleware that enforces authentication on requests.
 * When both API key and Basic Auth are configured, either is accepted.
 * Passes through when no auth is configured.
 */
export function apiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = getConfiguredApiKey();
  const configuredAuth = getConfiguredBasicAuth();

  // No auth configured — let the request through
  if (configuredKey === null && configuredAuth === null) {
    next();
    return;
  }

  // Check API key if configured
  if (configuredKey !== null && hasValidApiKey(req, configuredKey)) {
    next();
    return;
  }

  // Check Basic Auth if configured
  if (configuredAuth !== null && hasValidBasicAuth(req, configuredAuth)) {
    next();
    return;
  }

  // Neither method matched
  res.status(401).json({ error: 'Unauthorized: valid X-Api-Key header or Basic Auth credentials required' });
}
