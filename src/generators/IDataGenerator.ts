/**
 * IDataGenerator — Interface for pagination-aware lazy data generators
 *
 * Design rationale: ADR-005
 *
 * Generators produce endpoint/entity data on-demand rather than pre-allocating
 * all items in memory. This keeps memory proportional to page size (O(pageSize))
 * rather than total dataset size (O(70K)).
 *
 * Key properties:
 * - Deterministic: generateItem(i) always returns the same entity for a given index
 * - Pagination-aware: generatePage() generates only the requested slice
 * - Lazily iterable: [Symbol.iterator] yields items one-by-one for search/sort paths
 */

/**
 * Options for paginated generation.
 */
export interface PaginationOptions {
  /** Zero-based page number */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Contract for all large-scale data generators.
 *
 * @template T - The entity type produced (e.g., WindowsEndpoint)
 */
export interface IDataGenerator<T = unknown> {
  /**
   * Total number of items this generator can produce.
   * Used as the `totalItems` in paginated API responses.
   */
  readonly totalItems: number;

  /**
   * Entity type name. Matches the key used in ProfileManager fixture maps.
   * e.g. 'windowsEndpoints', 'software', 'windowsUpdates'
   */
  readonly entityType: string;

  /**
   * Generate a single item at the given zero-based index.
   *
   * Contract: pure function of `index` — same index always returns an
   * equivalent entity (deterministic, no side effects, no random state).
   *
   * @param index - Zero-based position in the full dataset (0 to totalItems - 1)
   * @returns The entity at that position
   * @throws RangeError if index < 0 or index >= totalItems
   */
  generateItem(index: number): T;

  /**
   * Generate the items for a specific page.
   *
   * This is the fast path for requests with no SearchQuery or OrderBy.
   * Only `pageSize` items are generated; no unnecessary allocations.
   *
   * @param options - Page number and page size
   * @returns Array of items for the requested page (may be shorter than pageSize on last page)
   */
  generatePage(options: PaginationOptions): T[];

  /**
   * Lazily iterate all items.
   *
   * Used when a SearchQuery or OrderBy is present — the caller spreads this
   * into a temporary array, applies filter/sort, then slices. The iterator
   * avoids allocating the full dataset upfront.
   *
   * @example
   * const all = [...generator]; // materializes lazily
   * const filtered = all.filter(item => item.displayName.includes(query));
   */
  [Symbol.iterator](): Iterator<T>;
}
