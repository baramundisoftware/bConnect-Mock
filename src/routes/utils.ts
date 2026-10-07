/**
 * Shared utility functions for route handlers.
 *
 * Extracted from app.ts to enable reuse across route modules and factories.
 * All functions are pure (no side effects) and independently testable.
 */

import type { IProfile } from '../profiles/ProfileManager';

/** Shared GUID format regex */
export const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

function parseOrderBy(orderBy: string): SortSpec[] {
  return orderBy.split(',').map((part) => {
    const segments = part.trim().split(/\s+/);
    const field = segments[0] ?? '';
    const direction = (segments[1] ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    return { field, direction };
  });
}

function getFieldValue(item: Record<string, unknown>, fieldName: string): unknown {
  const key = Object.keys(item).find((k) => k.toLowerCase() === fieldName.toLowerCase());
  return key !== undefined ? item[key] : undefined;
}

function compareValues(a: unknown, b: unknown, fieldName: string): number {
  if (fieldName.toLowerCase() === 'lastseen' || fieldName.toLowerCase() === 'firstseen') {
    const aTime = typeof a === 'string' ? new Date(a).getTime() : 0;
    const bTime = typeof b === 'string' ? new Date(b).getTime() : 0;
    return aTime - bTime;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return 0;
}

export function applyMultiFieldSort<T extends Record<string, unknown>>(data: T[], orderBy: string): T[] {
  const sorts = parseOrderBy(orderBy);
  return [...data].sort((a, b) => {
    for (const { field, direction } of sorts) {
      const aVal = getFieldValue(a, field);
      const bVal = getFieldValue(b, field);
      const cmp = compareValues(aVal, bVal, field);
      if (cmp !== 0) {
        return direction === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

export function applyMultiKeywordSearch<T extends Record<string, unknown>>(
  data: T[],
  searchQuery: string,
  searchableFields: string[]
): T[] {
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) { return data; }

  if (keywords.length === 1) {
    const primaryField = searchableFields[0] ?? '';
    return data.filter((item) => {
      const val = getFieldValue(item, primaryField);
      return typeof val === 'string' && val.toLowerCase().includes(keywords[0] ?? '');
    });
  }

  return data.filter((item) =>
    keywords.some((keyword) =>
      searchableFields.some((field) => {
        const val = getFieldValue(item, field);
        return typeof val === 'string' && val.toLowerCase().includes(keyword);
      })
    )
  );
}

export interface ResolvedEntityData {
  data: Record<string, unknown>[];
  totalItems: number;
}

/**
 * Parse the `Page` query parameter. bConnect pages are zero-indexed: the spec describes
 * `Page` as "the zero-indexed number of the first page", and a live bMS reports
 * currentPage 0 for the first page. Missing or invalid values mean page 0.
 */
export function parsePage(raw: unknown): number {
  const pg = parseInt(raw as string, 10);
  if (isNaN(pg) || pg < 0) { return 0; }
  return pg;
}

/**
 * Resolve entity data for a given entity type from the profile.
 * Implements ADR-007: Generator-Aware Routing.
 */
export function resolveEntityData(
  profile: IProfile,
  entityType: string,
  options: {
    searchQuery?: string;
    orderBy?: string;
    page: number;
    pageSize: number;
    searchFields?: string[];
  }
): ResolvedEntityData | null {
  const { searchQuery, orderBy, page, pageSize, searchFields = [] } = options;
  const hasFilter = searchQuery && searchQuery.trim() !== '';
  const hasSort = orderBy && orderBy.trim() !== '';

  const generator = profile.getGenerator?.(entityType) ?? null;

  if (generator) {
    if (hasFilter || hasSort) {
      let all = [...generator] as Record<string, unknown>[];
      if (hasFilter && searchQuery) {
        all = applyMultiKeywordSearch(all, searchQuery, searchFields);
      }
      if (hasSort && orderBy) {
        all = applyMultiFieldSort(all, orderBy);
      }
      const totalItems = all.length;
      const effectivePageSize = pageSize > 0 ? pageSize : totalItems;
      const startIndex = page * effectivePageSize;
      return { data: all.slice(startIndex, startIndex + effectivePageSize), totalItems };
    } else {
      const effectivePageSize = pageSize > 0 ? pageSize : generator.totalItems;
      const data = generator.generatePage({ page, pageSize: effectivePageSize }) as Record<string, unknown>[];
      return { data, totalItems: generator.totalItems };
    }
  }

  const fixtureResult = profile.getFixture(entityType);
  if (!Array.isArray(fixtureResult)) {
    return null;
  }
  let data = fixtureResult as Record<string, unknown>[];
  if (data.length === 0) {
    return null;
  }
  if (hasFilter && searchQuery) {
    data = applyMultiKeywordSearch(data, searchQuery, searchFields);
  }
  if (hasSort && orderBy) {
    data = applyMultiFieldSort(data, orderBy);
  }
  const totalItems = data.length;
  const effectivePageSize = pageSize > 0 ? pageSize : totalItems;
  const startIndex = page * effectivePageSize;
  return { data: data.slice(startIndex, startIndex + effectivePageSize), totalItems };
}
