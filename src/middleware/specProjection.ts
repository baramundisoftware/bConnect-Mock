/**
 * specProjection — answers carry exactly the spec's fields, as a live bMS does
 *
 * A read-only probe of a live 26R1 bMS (2026-10-07) found that the items of all 39 list routes
 * with data have exactly the fields of the spec's schema: no undocumented extra field, and no
 * spec field left out (empty ones come as null). The mock's data has many more fields (its
 * fixtures and generators keep relations such as logicalGroupId for sub-resources and search)
 * and lacks some spec fields.
 *
 * In strict routing, every successful JSON answer is projected onto the matched route's
 * response shape (src/generated/moduleRoutes.ts, RESPONSE_SHAPES): fields the spec doesn't
 * define are dropped, nullable spec fields the data doesn't have are added as null. The data
 * itself stays as it is. Lenient routing (no matched route) answers unprojected, as before.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ResponseShape } from '../generated/moduleRoutes';
import { ROUTE_LOCAL, type MatchedRoute } from './bmsErrors';

/** Project a value onto a response shape */
export function projectOntoShape(value: unknown, shape: ResponseShape | undefined): unknown {
  if (!shape || value === null || value === undefined) { return value; }
  if ('a' in shape) {
    return Array.isArray(value) ? value.map((item) => projectOntoShape(item, shape.a)) : value;
  }
  if (typeof value !== 'object' || Array.isArray(value)) { return value; }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [name, child] of Object.entries(shape.o)) {
    if (name in source) {
      out[name] = projectOntoShape(source[name], child);
    } else if (shape.z.includes(name)) {
      out[name] = null;
    }
  }
  return out;
}

export function specProjection(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    const route = res.locals[ROUTE_LOCAL] as MatchedRoute | undefined;
    if (route?.shape === undefined || res.statusCode < 200 || res.statusCode >= 300) { return json(body); }
    return json(projectOntoShape(body, route.shape));
  };
  next();
}
