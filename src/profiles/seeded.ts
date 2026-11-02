/**
 * Seeded values — helpers for synthetic data fixed per item (endpointInventory, recordFields)
 *
 * Every value derives from a seed made of the item's ID, so the same item always gets the same
 * values in every profile, list and lookup by ID.
 */

export type Item = Record<string, unknown>;

/**
 * FNV-1a over the item's ID, then MurmurHash3's finalizer: the seed of all its values. Without
 * the finalizer the low bits depend on the last characters only, and IDs that differ there
 * (fixtures numbered ...001, ...002) all got the same `h % 2`.
 */
export function seedOf(id: unknown): number {
  let h = 0x811c9dc5;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 0-99 for one decision about an item (salt: which decision), independent of its other ones */
export function roll(h: number, salt: number): number {
  return ((Math.imul(h ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b) >>> 0) >>> 7) % 100;
}

export const pick = <T>(pool: readonly T[], h: number): T => pool[h % pool.length] as T;
export const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

const BASE = Date.UTC(2026, 9, 30, 8, 0, 0);
const MINUTES = 30 * 24 * 60;
/** The ISO strings of the minutes before BASE, made once each (a full scan fills 60,000 items) */
const minuteIso: string[] = [];
/**
 * A moment up to 30 days before 2026-10-30, as a live bMS writes it: without a fraction of a
 * second, or with seven digits of ticks
 */
export function moment(h: number, minutesBack: number, fraction: 'none' | 'ticks'): string {
  const m = (h + minutesBack) % MINUTES;
  const iso = (minuteIso[m] ??= new Date(BASE - m * 60_000).toISOString().slice(0, 19));
  return fraction === 'none' ? `${iso}Z` : `${iso}.${String(h % 10_000_000).padStart(7, '0')}Z`;
}

/** dd.MM.yyyy HH:mm, as texts of a live bMS show dates */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}

/** A GUID made from the seed and a salt (one item can need several) */
export function guidOf(h: number, salt: number): string {
  const hex = (n: number, len: number): string => (n >>> 0).toString(16).padStart(8, '0').slice(-len);
  const a = Math.imul(h ^ salt, 0x9e3779b1) >>> 0;
  const b = Math.imul(a ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return `${hex(a, 8)}-${hex(b, 4)}-4${hex(b >>> 4, 3)}-a${hex(a >>> 8, 3)}-${hex(a ^ b, 8)}${hex(b, 4)}`;
}

/** The item with the derived fields it has none of (missing or null) */
export function fillMissing(item: Item, derived: Item): Item {
  let out: Item | undefined;
  for (const key in derived) {
    const value = derived[key];
    if (value === undefined || (item[key] !== undefined && item[key] !== null)) { continue; }
    out ??= { ...item };
    out[key] = value;
  }
  return out ?? item;
}
