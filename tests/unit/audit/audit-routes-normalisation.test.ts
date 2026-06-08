/**
 * P15.9 — Audit Script Path-Parameter Normalisation Tests (REQ-21.1.1 + REQ-21.1.2)
 *
 * Verifies:
 * 1. normalisePath replaces any {paramName} with {_}
 * 2. Parameter-name variants compare equal after normalisation
 * 3. StaticGroups write phantom routes are annotated in PHANTOM_REASONS
 *    (REQ-21.1.2: no "Unknown — needs review" entries for known extensions)
 */

import { describe, it, expect } from 'vitest';

// ── Re-implement the tiny helpers from the audit script so we can unit-test them
// without requiring a built dist.

function expressPathToOpenApi(p: string): string {
  return p.replace(/:([^/]+)/g, '{$1}');
}

function normalisePath(p: string): string {
  return p.replace(/\{[^}]+\}/g, '{_}');
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — normalisePath
// ─────────────────────────────────────────────────────────────────────────────

describe('normalisePath (REQ-21.1.1)', () => {
  it('replaces a simple {id} with {_}', () => {
    expect(normalisePath('/v2.0/Endpoints/{id}')).toBe('/v2.0/Endpoints/{_}');
  });

  it('replaces multi-word param names', () => {
    expect(normalisePath('/v2.0/ADGroups/{adGroupId}/ADUsers')).toBe('/v2.0/ADGroups/{_}/ADUsers');
  });

  it('replaces all params in nested paths', () => {
    expect(normalisePath('/v2.0/A/{parentId}/B/{childId}')).toBe('/v2.0/A/{_}/B/{_}');
  });

  it('leaves paths without params unchanged', () => {
    expect(normalisePath('/v2.0/Endpoints')).toBe('/v2.0/Endpoints');
  });

  it('{parentId} and {adGroupId} variants compare equal after normalisation', () => {
    const a = normalisePath('/v2.0/ADGroups/{parentId}/ADUsers');
    const b = normalisePath('/v2.0/ADGroups/{adGroupId}/ADUsers');
    expect(a).toBe(b);
  });

  it('{id} and {endpointId} variants compare equal after normalisation', () => {
    expect(normalisePath('/v2.0/Endpoints/{id}')).toBe(normalisePath('/v2.0/Endpoints/{endpointId}'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — expressPathToOpenApi
// ─────────────────────────────────────────────────────────────────────────────

describe('expressPathToOpenApi', () => {
  it('converts :id to {id}', () => {
    expect(expressPathToOpenApi('/v2.0/Endpoints/:id')).toBe('/v2.0/Endpoints/{id}');
  });

  it('converts multiple params', () => {
    expect(expressPathToOpenApi('/v2.0/A/:parentId/B/:childId')).toBe('/v2.0/A/{parentId}/B/{childId}');
  });

  it('leaves OpenAPI-style paths unchanged', () => {
    expect(expressPathToOpenApi('/v2.0/Endpoints/{id}')).toBe('/v2.0/Endpoints/{id}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PHANTOM_REASONS completeness (REQ-21.1.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('PHANTOM_REASONS annotations (REQ-21.1.2)', () => {
  // Load the audit script's PHANTOM_REASONS via require to avoid duplicating the map.
  // We read the source and extract the object rather than requiring the script
  // (which has side-effects via main()).
  const fs = require('fs');
  const src = fs.readFileSync(
    require('path').resolve(__dirname, '../../../scripts/audit-routes.js'),
    'utf8',
  ) as string;

  // Extract the PHANTOM_REASONS keys by parsing the object literal lines.
  const keyMatches = [...src.matchAll(/'([A-Z]+\s+\/[^']+)':\s*\n?\s*'/g)];
  const annotatedKeys = new Set(keyMatches.map(m => m[1]));

  it('StaticGroups POST is annotated', () => {
    expect(annotatedKeys.has('POST /v2.0/StaticGroups')).toBe(true);
  });

  it('StaticGroups DELETE /{_} is annotated', () => {
    expect(annotatedKeys.has('DELETE /v2.0/StaticGroups/{_}')).toBe(true);
  });

  it('StaticGroups PATCH /{_} is annotated', () => {
    expect(annotatedKeys.has('PATCH /v2.0/StaticGroups/{_}')).toBe(true);
  });

  it('no PHANTOM_REASONS value equals the fallback "Unknown — needs review"', () => {
    const _unknownMatches = [...src.matchAll(/'Unknown — needs review'/g)];
    // Only the PHANTOM_REASON_FALLBACK const declaration should match, not object values.
    // The fallback const line: `const PHANTOM_REASON_FALLBACK = 'Unknown...';`
    // Object values should all be descriptive strings.
    const objectValueMatches = [...src.matchAll(/:\s*\n?\s*'Unknown — needs review'/g)];
    expect(objectValueMatches).toHaveLength(0);
  });
});
