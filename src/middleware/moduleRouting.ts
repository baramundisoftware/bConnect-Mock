/**
 * moduleRouting — Module-prefix routing guard for bConnect mock (issue #49)
 *
 * A real bMS answers each route only under the module prefix whose OpenAPI spec
 * declares it, e.g. /bconnect/endpoints/v2.0/WindowsEndpoints. A path without a
 * module (/bconnect/v2.0/WindowsEndpoints) or under a module that does not own
 * the route (/bconnect/jobs/v2.0/WindowsEndpoints) gets 404.
 *
 * The mock's route handlers are registered without a module prefix, and app.ts
 * strips the prefix before routing. This guard runs before that stripping and
 * rejects what a real bMS would reject, using the route table generated from
 * the specs (src/generated/moduleRoutes.ts).
 *
 * Modes (environment variable BCONNECT_MODULE_ROUTING):
 *   strict  (default) — rejects what a live bMS rejects, with the same answer:
 *                       no module             → 404 application/json {"Message": …}
 *                       unknown module        → 400 text/plain "The request URI is invalid. …"
 *                       route not in module   → 404 application/problem+json
 *                       method not declared   → 405 application/problem+json, with Allow
 *   lenient           — previous behaviour: any module prefix, or none, is accepted
 *
 * Non-API paths (/health, /metrics, /api/reset, /api-docs) are never affected.
 */

import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { BmsVersion } from '../profiles/ProfileManager';
import { MODULE_ROUTES } from '../generated/moduleRoutes';

export type ModuleRoutingMode = 'strict' | 'lenient';

/**
 * Response header with the mock's explanation of a rejection. The bodies copy a live bMS
 * (26R1, checked 2026-10-07), which explains nothing, so the reason travels here and in
 * the request log.
 */
export const MOCK_REASON_HEADER = 'X-BConnect-Mock-Reason';

/** The text/plain body a live bMS sends for a path whose module it doesn't know */
export const UNKNOWN_MODULE_TEXT =
  'The request URI is invalid. Route data could not be determined. Maybe you entered a wrong URI format or bConnect version?';

/** A W3C trace id, as the bMS puts into its problem details */
function traceId(): string {
  return `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-00`;
}

/** RFC 7807 problem details, as a live bMS answers an unknown route (404) or method (405) */
function sendProblem(res: Response, status: 404 | 405, reason: string): void {
  const title = status === 404 ? 'Not Found' : 'Method Not Allowed';
  res.setHeader(MOCK_REASON_HEADER, reason);
  res.status(status).type('application/problem+json')
    .send(JSON.stringify({ type: `https://httpstatuses.io/${status}`, title, status, traceId: traceId() }));
}

/**
 * Returns the configured routing mode. Unset or empty means strict;
 * an unrecognised value logs a warning and falls back to strict.
 */
export function getModuleRoutingMode(): ModuleRoutingMode {
  const raw = process.env.BCONNECT_MODULE_ROUTING?.trim().toLowerCase();
  if (!raw || raw === 'strict') { return 'strict'; }
  if (raw === 'lenient') { return 'lenient'; }
  console.warn(
    `[bconnect-mock] BCONNECT_MODULE_ROUTING="${process.env.BCONNECT_MODULE_ROUTING}" is not valid ` +
    `(expected "strict" or "lenient") — defaulting to strict`
  );
  return 'strict';
}

interface CompiledRoute { method: string; pattern: RegExp; params: number }

/** Compile 'GET /v2.0/WindowsEndpoints/{}' into a method plus a case-insensitive path regex. */
function compileRoute(route: string): CompiledRoute {
  const [method = '', routePath = ''] = route.split(' ');
  const source = routePath
    .split('{}')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return { method, pattern: new RegExp(`^${source}$`, 'i'), params: routePath.split('{}').length - 1 };
}

// Optional /bconnect, optional module segment, then the API version and the rest of the path.
const API_PATH = /^(?:\/bconnect)?(?:\/([^/]+))?(\/v\d+\.\d+(?:\/.*)?)$/i;

/**
 * Build the guard for one bMS version. In lenient mode it passes every request through.
 */
export function createModuleRoutingGuard(
  bmsVersion: BmsVersion,
  mode: ModuleRoutingMode = getModuleRoutingMode()
): RequestHandler {
  if (mode === 'lenient') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const modules = new Map<string, CompiledRoute[]>();
  for (const [moduleName, routes] of Object.entries(MODULE_ROUTES[bmsVersion] ?? {})) {
    modules.set(moduleName, routes.map(compileRoute));
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // CORS preflight is answered by the cors middleware; never block it here.
    if (req.method === 'OPTIONS') { next(); return; }

    const match = API_PATH.exec(req.path);
    if (!match) { next(); return; }

    const [, moduleSegment, rawApiPath = ''] = match;
    const apiPath = rawApiPath.length > 1 ? rawApiPath.replace(/\/+$/, '') : rawApiPath;

    if (!moduleSegment) {
      res.setHeader(MOCK_REASON_HEADER, `${req.path} has no module prefix (e.g. /bconnect/endpoints${apiPath})`);
      res.status(404).json({ Message: `No HTTP resource was found that matches the request URI '${req.protocol}://${req.get('host') ?? ''}${req.originalUrl}'.` });
      return;
    }

    const routes = modules.get(moduleSegment.toLowerCase());
    if (!routes) {
      res.setHeader(MOCK_REASON_HEADER, `unknown module "${moduleSegment}" for bMS ${bmsVersion}`);
      res.status(400).type('text/plain').send(UNKNOWN_MODULE_TEXT);
      return;
    }

    // A literal segment wins over a path parameter, as in ASP.NET routing: AssetTypes/Folders
    // is its own route, not AssetTypes/{id} with id "Folders". Keep only the most specific matches.
    const matches = routes.filter((r) => r.pattern.test(apiPath));
    const fewestParams = Math.min(...matches.map((r) => r.params));
    const pathMatches = matches.filter((r) => r.params === fewestParams);
    if (pathMatches.length === 0) {
      sendProblem(res, 404, `${apiPath} is not a route of module "${moduleSegment}" in bMS ${bmsVersion}`);
      return;
    }

    const method = req.method === 'HEAD' ? 'GET' : req.method;
    if (!pathMatches.some((r) => r.method === method)) {
      const allowed = [...new Set(pathMatches.map((r) => r.method))].sort();
      res.setHeader('Allow', allowed.join(', '));
      sendProblem(res, 405, `${req.method} ${apiPath} is not a method of module "${moduleSegment}" (allowed: ${allowed.join(', ')})`);
      return;
    }

    next();
  };
}
