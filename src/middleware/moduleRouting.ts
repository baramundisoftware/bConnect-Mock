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

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { BmsVersion } from '../profiles/ProfileManager';
import { MODULE_ROUTES, ROUTE_DETAILS, RESPONSE_SHAPES, type ResponseShape } from '../generated/moduleRoutes';
import { MOCK_REASON_HEADER, ROUTE_LOCAL, sendProblem, sendValidationProblem, type MatchedRoute } from './bmsErrors';

export { MOCK_REASON_HEADER } from './bmsErrors';

export type ModuleRoutingMode = 'strict' | 'lenient';

/** The text/plain body a live bMS sends for a path whose module it doesn't know */
export const UNKNOWN_MODULE_TEXT =
  'The request URI is invalid. Route data could not be determined. Maybe you entered a wrong URI format or bConnect version?';

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

interface CompiledRoute {
  method: string;
  pattern: RegExp;
  /** Number of path parameters (fewer wins: a literal segment beats a parameter) */
  params: number;
  /** The spec's names for the path parameters, in order */
  paramNames: readonly string[];
  /** The spec's request body schema, if any */
  body?: string;
  /** The spec's response shape, if the route answers with JSON */
  shape?: ResponseShape;
}

/** decodeURIComponent that keeps a malformed escape as it is instead of throwing */
function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

const GUID_VALUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Compile 'GET /v2.0/WindowsEndpoints/{}' into a method plus a case-insensitive path regex. */
function compileRoute(route: string, detail: { params?: readonly string[]; body?: string } = {}, shape?: ResponseShape): CompiledRoute {
  const [method = '', routePath = ''] = route.split(' ');
  const source = routePath
    .split('{}')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('([^/]+)');
  return {
    method,
    pattern: new RegExp(`^${source}$`, 'i'),
    params: routePath.split('{}').length - 1,
    paramNames: detail.params ?? [],
    ...(detail.body ? { body: detail.body } : {}),
    ...(shape !== undefined ? { shape } : {}),
  };
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
    const details = ROUTE_DETAILS[bmsVersion]?.[moduleName] ?? {};
    const shapes = RESPONSE_SHAPES[bmsVersion]?.[moduleName] ?? {};
    modules.set(moduleName, routes.map((route) => compileRoute(route, details[route], shapes[route])));
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

    // Every path parameter in the specs is a GUID; the bMS rejects anything else with 400.
    const route = pathMatches.find((r) => r.method === method) as CompiledRoute;
    const values = route.pattern.exec(apiPath)?.slice(1) ?? [];
    const params = Object.fromEntries(route.paramNames.map((name, i) => [name, safeDecode(values[i] ?? '')]));
    const invalid = Object.entries(params).filter(([, value]) => !GUID_VALUE.test(value));
    if (invalid.length > 0) {
      sendValidationProblem(
        res,
        Object.fromEntries(invalid.map(([name, value]) => [name, [`The value '${value}' is not valid.`]])),
        `${invalid.map(([name]) => name).join(', ')} must be a GUID`,
      );
      return;
    }

    const matched: MatchedRoute = {
      params,
      ...(route.body ? { body: route.body } : {}),
      ...(route.shape !== undefined ? { shape: route.shape } : {}),
    };
    res.locals[ROUTE_LOCAL] = matched;
    next();
  };
}
