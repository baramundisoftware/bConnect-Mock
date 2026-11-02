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
 * define are dropped, nullable spec fields the data doesn't have are added as null. Before an
 * object is projected, specFields derives the spec fields its data keeps under other names
 * (#86). The data itself stays as it is. Lenient routing (no matched route) answers
 * unprojected, as before.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { ResponseShape } from '../generated/moduleRoutes';
import type { IProfile } from '../profiles/ProfileManager';
import { ROUTE_LOCAL, type MatchedRoute } from './bmsErrors';
import { createLookup, fillSpecFields, type Lookup } from './specFields';

/** Project a value onto a response shape; with a lookup, named objects get their spec fields filled first */
export function projectOntoShape(value: unknown, shape: ResponseShape | undefined, lookup?: Lookup): unknown {
  if (!shape || value === null || value === undefined) { return value; }
  if ('a' in shape) {
    return Array.isArray(value) ? value.map((item) => projectOntoShape(item, shape.a, lookup)) : value;
  }
  if (typeof value !== 'object' || Array.isArray(value)) { return value; }
  let source = value as Record<string, unknown>;
  if (lookup && shape.n) { source = fillSpecFields(shape.n, source, lookup); }
  const out: Record<string, unknown> = {};
  for (const [name, child] of Object.entries(shape.o)) {
    if (name in source) {
      out[name] = projectOntoShape(source[name], child, lookup);
    } else if (shape.z.includes(name)) {
      out[name] = null;
    }
  }
  return out;
}

export function specProjection(req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    const route = res.locals[ROUTE_LOCAL] as MatchedRoute | undefined;
    if (route?.shape === undefined || res.statusCode < 200 || res.statusCode >= 300) { return json(body); }
    return json(projectOntoShape(body, route.shape, createLookup(req.app as Express, req.app.locals['profile'] as IProfile | undefined)));
  };
  next();
}
