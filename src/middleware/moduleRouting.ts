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
 *   strict  (default) — 404 for a missing, unknown or wrong module, or a route the
 *                       selected bMS version's spec does not declare; 405 when the
 *                       module declares the path but not the method
 *   lenient           — previous behaviour: any module prefix, or none, is accepted
 *
 * Non-API paths (/health, /metrics, /api/reset, /api-docs) are never affected.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { BmsVersion } from '../profiles/ProfileManager';
import { MODULE_ROUTES } from '../generated/moduleRoutes';

export type ModuleRoutingMode = 'strict' | 'lenient';

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

interface CompiledRoute { method: string; pattern: RegExp }

/** Compile 'GET /v2.0/WindowsEndpoints/{}' into a method plus a case-insensitive path regex. */
function compileRoute(route: string): CompiledRoute {
  const [method = '', routePath = ''] = route.split(' ');
  const source = routePath
    .split('{}')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return { method, pattern: new RegExp(`^${source}$`, 'i') };
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
      res.status(404).json({
        error: `Not found: ${req.path} has no module prefix (e.g. /bconnect/endpoints${apiPath})`,
      });
      return;
    }

    const routes = modules.get(moduleSegment.toLowerCase());
    if (!routes) {
      res.status(404).json({ error: `Not found: unknown module "${moduleSegment}" for bMS ${bmsVersion}` });
      return;
    }

    const pathMatches = routes.filter((r) => r.pattern.test(apiPath));
    if (pathMatches.length === 0) {
      res.status(404).json({
        error: `Not found: ${apiPath} is not a route of module "${moduleSegment}" in bMS ${bmsVersion}`,
      });
      return;
    }

    const method = req.method === 'HEAD' ? 'GET' : req.method;
    if (!pathMatches.some((r) => r.method === method)) {
      const allowed = [...new Set(pathMatches.map((r) => r.method))].sort();
      res.setHeader('Allow', allowed.join(', '));
      res.status(405).json({
        error: `Method not allowed: ${req.method} ${apiPath} in module "${moduleSegment}" (allowed: ${allowed.join(', ')})`,
      });
      return;
    }

    next();
  };
}
