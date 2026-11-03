/**
 * JSON Patch (RFC 6902) → plain merge object, with the bMS's case-insensitive paths
 *
 * Connectors send PATCH as [{op:'replace',path:'/field',value:'x'},...], but the routes and the
 * state store expect a plain object {field: 'x'}. A live bMS applies the patch with ASP.NET Core
 * JsonPatch, which resolves each path segment against the target's properties case-insensitively
 * (an exact match first, then ignoring case); the spec's own examples write `/Value`, `/IsActive`.
 * So each segment maps to the real (camelCase) property name of the resource the route patches
 * (the shape of its GET, found by the module routing guard). Without a known property (lenient
 * routing, or a field the resource doesn't have) the segment only loses its leading capital, so
 * routes that check their modifiable fields still reject it, by a camelCase name.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ResponseShape } from '../generated/moduleRoutes';
import { ROUTE_LOCAL, type MatchedRoute } from './bmsErrors';

type Operation = { op?: string; path?: string; value?: unknown };

/** The properties of an object shape (a list's items for an array shape) */
function propertiesOf(shape: ResponseShape | undefined): Readonly<Record<string, ResponseShape>> | undefined {
  if (shape === undefined || shape === 0) { return undefined; }
  if ('a' in shape) { return propertiesOf(shape.a); }
  return shape.o;
}

/** A JSON Patch path's segments under their real property names */
export function resolvePatchPath(path: string, target: ResponseShape | undefined): string {
  let shape = target;
  return path.replace(/^\//, '').split('/').map((segment) => {
    const properties = propertiesOf(shape);
    const name = properties && (segment in properties ? segment : Object.keys(properties).find((p) => p.toLowerCase() === segment.toLowerCase()));
    shape = name ? properties?.[name] : undefined;
    return name ?? (segment.charAt(0).toLowerCase() + segment.slice(1));
  }).join('/');
}

/** The merge object of a JSON Patch's replace and add operations */
export function jsonPatchToMerge(operations: Operation[], target?: ResponseShape): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const op of operations) {
    if (op.op === 'replace' || op.op === 'add') {
      const key = resolvePatchPath(op.path ?? '', target);
      if (key) { merged[key] = op.value; }
    }
  }
  return merged;
}

export function jsonPatchBodies(req: Request, res: Response, next: NextFunction): void {
  if (['PATCH', 'PUT'].includes(req.method) && Array.isArray(req.body)) {
    req.body = jsonPatchToMerge(req.body as Operation[], (res.locals[ROUTE_LOCAL] as MatchedRoute | undefined)?.target);
  }
  next();
}
