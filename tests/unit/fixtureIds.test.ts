/**
 * Every ID in the fixtures is a GUID. bConnect path parameters are all GUIDs (the specs say so),
 * and the module routing guard answers anything else with 400, as a live bMS does, so a fixture
 * ID like "bl000001-…" could never be fetched by ID.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const FIXTURES = path.resolve(__dirname, '../../fixtures');
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUID_SHAPED = /^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/i;

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : [];
  });
}

/** Values of id, guid and *Id fields that look like GUIDs but aren't valid ones */
function invalidIds(node: unknown, file: string, key?: string): string[] {
  if (Array.isArray(node)) { return node.flatMap((v) => invalidIds(v, file, key)); }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => invalidIds(v, file, k));
  }
  if (typeof node === 'string' && key && (key === 'id' || key === 'guid' || key.endsWith('Id'))
    && GUID_SHAPED.test(node) && !GUID.test(node)) {
    return [`${path.relative(FIXTURES, file)} ${key}=${node}`];
  }
  return [];
}

describe('fixture IDs', () => {
  it('are valid GUIDs', () => {
    const bad = jsonFiles(FIXTURES).flatMap((f) => invalidIds(JSON.parse(readFileSync(f, 'utf8')) as unknown, f));
    expect(bad).toEqual([]);
  });
});
