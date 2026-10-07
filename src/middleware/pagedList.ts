/**
 * pagedList — the bConnect paged-list envelope for every list response
 *
 * Every bConnect list answers with the spec's *PagedList schema, e.g. JobDefinitionPagedList:
 *   { currentPage, pageSize, totalPages, totalItems, hasPreviousPage, hasNextPage, data }
 * (a live 26R1 bMS: {"currentPage":0,"pageSize":1,"totalPages":66,"totalItems":66,…}).
 *
 * Paging follows a live bMS: zero-indexed Page, PageSize 20 by default and at most 1000
 * (see pageSizeDefaults). The mock's list handlers build { data, pageSize, page, totalItems }. Rather than change
 * each of them, this middleware rewrites any such body into the spec envelope: `page` (the
 * zero-indexed page the handler served) becomes `currentPage`, and the paging flags are
 * derived from pageSize and totalItems.
 */

import type { Request, Response, NextFunction } from 'express';

/** PageSize when the request has none, or 0, or an invalid value (spec and live bMS: 20) */
export const DEFAULT_PAGE_SIZE = 20;

/** The largest PageSize a live bMS serves; larger values are capped, not refused */
export const MAX_PAGE_SIZE = 1000;

/** The page size a live bMS uses for a requested PageSize (checked on 26R1, 2026-10-07) */
export function effectivePageSize(raw: unknown): number {
  const n = typeof raw === 'string' && /^\s*-?\d+\s*$/.test(raw) ? parseInt(raw, 10) : NaN;
  if (isNaN(n) || n <= 0) { return DEFAULT_PAGE_SIZE; }
  return Math.min(n, MAX_PAGE_SIZE);
}

/**
 * Give every GET the PageSize a live bMS would use: 20 when it's missing, 0 or invalid,
 * at most 1000, never an error. The query string is rewritten, so every list handler sees
 * the effective value. The parameter name is matched case-insensitively, as ASP.NET does.
 */
export function pageSizeDefaults(req: Request, _res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
  const q = req.url.indexOf('?');
  const path = q < 0 ? req.url : req.url.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : req.url.slice(q + 1));
  const keys = [...params.keys()].filter((k) => k.toLowerCase() === 'pagesize');
  const requested = keys.length > 0 ? params.get(keys[0] as string) : null;
  const effective = String(effectivePageSize(requested ?? undefined));
  if (keys.length === 1 && keys[0] === 'PageSize' && requested === effective) { next(); return; }
  for (const k of keys) { params.delete(k); }
  params.set('PageSize', effective);
  req.url = `${path}?${params.toString()}`;
  next();
}

/** True for the { data: [...], totalItems: n } bodies the list handlers produce */
function isPagedBody(body: unknown): body is Record<string, unknown> & { data: unknown[]; totalItems: number } {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    && Array.isArray((body as Record<string, unknown>)['data'])
    && typeof (body as Record<string, unknown>)['totalItems'] === 'number';
}

/** Rewrite a handler's paged body into the spec's PagedList envelope (field order as in the spec) */
export function toPagedListEnvelope(body: Record<string, unknown> & { data: unknown[]; totalItems: number }): Record<string, unknown> {
  const { data, totalItems, page, currentPage, pageSize: rawPageSize, ...rest } = body;
  const current = typeof currentPage === 'number' ? currentPage : typeof page === 'number' ? page : 0;
  const pageSize = typeof rawPageSize === 'number' ? rawPageSize : data.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  return {
    currentPage: current,
    pageSize,
    totalPages,
    totalItems,
    hasPreviousPage: current > 0,
    hasNextPage: current + 1 < totalPages,
    data,
    ...rest,
  };
}

export function pagedListEnvelope(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(isPagedBody(body) ? toPagedListEnvelope(body) : body);
  next();
}
