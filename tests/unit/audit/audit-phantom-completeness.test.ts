/**
 * P15.10 — Phantom Routes Completeness (REQ-21.1.2)
 *
 * After path-parameter normalisation (P15.9), the generated status docs must:
 *   1. Have 0 MISSING routes (100% spec coverage for both BMS versions)
 *   2. Have 0 "Unknown — needs review" phantom entries
 *
 * These tests read the generated Markdown files produced by `scripts/audit-routes.js`.
 * They act as a CI gate: if the docs are stale or regressions exist, the suite fails.
 *
 * Run `node scripts/audit-routes.js` to regenerate docs before running these tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../');
const DOC_26R1 = resolve(ROOT, 'docs/archive/bConnectMockImplementationStatus.md');
const DOC_25R2 = resolve(ROOT, 'docs/archive/bConnectMockImplementationStatus_25R2.md');

function readDoc(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Status doc not found: ${filePath}. Run: node scripts/audit-routes.js`);
  }
  return readFileSync(filePath, 'utf8');
}

function countOccurrences(text: string, needle: string): number {
  return (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function extractCoverage(text: string): number {
  const match = text.match(/\| Coverage \| (\d+)% \|/);
  return match ? parseInt(match[1], 10) : -1;
}

function extractMissingCount(text: string): number {
  const match = text.match(/\| Missing from mock \| (\d+) \|/);
  return match ? parseInt(match[1], 10) : -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 26R1
// ─────────────────────────────────────────────────────────────────────────────

describe('bConnectMockImplementationStatus.md (26R1) �� REQ-21.1.2', () => {
  const doc = readDoc(DOC_26R1);

  it('status doc exists and is non-empty', () => {
    expect(doc.length).toBeGreaterThan(100);
  });

  it('coverage is 100%', () => {
    expect(extractCoverage(doc)).toBe(100);
  });

  it('0 MISSING routes', () => {
    expect(extractMissingCount(doc)).toBe(0);
  });

  it('no "- MISSING" table rows exist', () => {
    expect(countOccurrences(doc, '- MISSING')).toBe(0);
  });

  it('no "Unknown — needs review" phantom entries', () => {
    expect(countOccurrences(doc, 'Unknown — needs review')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 25R2
// ─────────────────────────────────────────────────────────────────────────────

describe('bConnectMockImplementationStatus_25R2.md (25R2) — REQ-21.1.2', () => {
  const doc = readDoc(DOC_25R2);

  it('status doc exists and is non-empty', () => {
    expect(doc.length).toBeGreaterThan(100);
  });

  it('coverage is 100%', () => {
    expect(extractCoverage(doc)).toBe(100);
  });

  it('0 MISSING routes', () => {
    expect(extractMissingCount(doc)).toBe(0);
  });

  it('no "- MISSING" table rows exist', () => {
    expect(countOccurrences(doc, '- MISSING')).toBe(0);
  });

  it('no "Unknown — needs review" phantom entries', () => {
    expect(countOccurrences(doc, 'Unknown — needs review')).toBe(0);
  });
});
