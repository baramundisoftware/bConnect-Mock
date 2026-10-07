/**
 * pagedList — the bConnect paged-list envelope for every list response
 *
 * Every bConnect list answers with the spec's *PagedList schema, e.g. JobDefinitionPagedList:
 *   { currentPage, pageSize, totalPages, totalItems, hasPreviousPage, hasNextPage, data }
 * (a live 26R1 bMS: {"currentPage":0,"pageSize":1,"totalPages":66,"totalItems":66,…}).
 *
 * The mock's list handlers build { data, pageSize, page, totalItems }. Rather than change
 * each of them, this middleware rewrites any such body into the spec envelope: `page` (the
 * zero-indexed page the handler served) becomes `currentPage`, and the paging flags are
 * derived from pageSize and totalItems.
 */

import type { Request, Response, NextFunction } from 'express';

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
