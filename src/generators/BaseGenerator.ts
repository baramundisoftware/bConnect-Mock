/**
 * BaseGenerator — Abstract base class for all lazy data generators
 *
 * Provides default implementations of generatePage() and [Symbol.iterator]
 * on top of the abstract generateItem(index) method.
 *
 * Subclasses only need to implement generateItem(index) and declare
 * totalItems + entityType.
 */

import type { IDataGenerator, PaginationOptions } from './IDataGenerator';

export abstract class BaseGenerator<T = unknown> implements IDataGenerator<T> {
  abstract readonly totalItems: number;
  abstract readonly entityType: string;

  /**
   * Generate a single item at the given index.
   * Must be deterministic: same index → same entity.
   */
  abstract generateItem(index: number): T;

  /**
   * Generate the items for a specific page.
   * Calls generateItem() only for the indices in the requested page window.
   */
  generatePage({ page, pageSize }: PaginationOptions): T[] {
    if (pageSize <= 0) { return []; }
    const start = page * pageSize;
    if (start >= this.totalItems) { return []; }
    const end = Math.min(start + pageSize, this.totalItems);
    const result: T[] = [];
    for (let i = start; i < end; i++) {
      result.push(this.generateItem(i));
    }
    return result;
  }

  /**
   * Lazily iterate all items in index order.
   * Yields one item at a time; callers may break early without generating remaining items.
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.totalItems; i++) {
      yield this.generateItem(i);
    }
  }
}
