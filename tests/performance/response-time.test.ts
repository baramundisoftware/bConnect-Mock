/**
 * P3.15 + P3.16 — Performance Tests: standard-readonly profile
 *
 * Targets (from Requirements.md / ProfileManager metadata):
 *   - P95 response time < 100ms for all standard-readonly GET endpoints
 *   - Heap usage < 200MB after serving 500 requests
 *
 * Methodology:
 *   1. Warm-up: 20 sequential requests (not measured)
 *   2. Measurement: 200 sequential requests, record duration each
 *   3. Compute P50 / P95 / P99 from samples
 *   4. Assert P95 < 100ms
 *
 * Memory test:
 *   - Record heap before load
 *   - Fire 500 requests
 *   - Force GC (if available) then record heap after
 *   - Assert heap delta < 200MB
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { ProfileMode } from '../../src/profiles/ProfileManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function measureRequestMs(app: Express, url: string): Promise<number> {
  const start = performance.now();
  await request(app).get(url).expect(200);
  return performance.now() - start;
}

async function runBench(
  app: Express,
  url: string,
  warmup = 20,
  samples = 200
): Promise<{ p50: number; p95: number; p99: number; max: number }> {
  // Warm-up (discard results)
  for (let i = 0; i < warmup; i++) {
    await request(app).get(url);
  }

  // Measurement
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    durations.push(await measureRequestMs(app, url));
  }

  durations.sort((a, b) => a - b);

  return {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: durations[durations.length - 1] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Performance: standard-readonly profile', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  // P3.15 — Response time < 100ms P95 -------------------------------------------

  describe('P3.15 — Response time < 100ms (P95)', () => {
    const TARGET_P95_MS = 100;

    it('GET /v2.0/WindowsEndpoints — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/WindowsEndpoints');

      console.info(
        `WindowsEndpoints  P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/AndroidEndpoints — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/AndroidEndpoints');

      console.info(
        `AndroidEndpoints  P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/LinuxEndpoints — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/LinuxEndpoints');

      console.info(
        `LinuxEndpoints    P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/MacEndpoints — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/MacEndpoints');

      console.info(
        `MacEndpoints      P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/Software — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/Software');

      console.info(
        `Software          P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/WindowsUpdates — P95 < 100ms', async () => {
      const result = await runBench(app, '/v2.0/WindowsUpdates');

      console.info(
        `WindowsUpdates    P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);

    it('GET /v2.0/WindowsEndpoints with pagination+search+sort — P95 < 100ms', async () => {
      const url = '/v2.0/WindowsEndpoints?SearchQuery=PCDE&OrderBy=DisplayName asc&PageSize=5&Page=0';
      const result = await runBench(app, url);

      console.info(
        `WindowsEndpoints(complex)  P50=${result.p50.toFixed(1)}ms  P95=${result.p95.toFixed(1)}ms  P99=${result.p99.toFixed(1)}ms  max=${result.max.toFixed(1)}ms`
      );

      expect(result.p95).toBeLessThan(TARGET_P95_MS);
    }, 60_000);
  });

  // P3.16 — Heap usage < 200MB --------------------------------------------------

  describe('P3.16 — Heap usage < 200MB (standard-readonly)', () => {
    const TARGET_HEAP_MB = 200;

    it('heap delta < 200MB after 500 requests across all endpoints', async () => {
      // Force GC before baseline if available (Node --expose-gc)
      const gcFn = (globalThis as { gc?: () => void }).gc;
      if (gcFn) { gcFn(); }

      const heapBefore = process.memoryUsage().heapUsed;

      const endpoints = [
        '/v2.0/WindowsEndpoints',
        '/v2.0/AndroidEndpoints',
        '/v2.0/LinuxEndpoints',
        '/v2.0/MacEndpoints',
        '/v2.0/Software',
        '/v2.0/WindowsUpdates',
      ];

      // 500 requests distributed across endpoints
      for (let i = 0; i < 500; i++) {
        const url = endpoints[i % endpoints.length] ?? endpoints[0];
        await request(app).get(url as string);
      }

      // Force GC after load if available
      if (gcFn) { gcFn(); }

      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);
      const heapTotalMB = heapAfter / (1024 * 1024);

      console.info(
        `Heap before: ${(heapBefore / 1024 / 1024).toFixed(1)}MB  ` +
        `after: ${heapTotalMB.toFixed(1)}MB  delta: ${heapDeltaMB.toFixed(1)}MB`
      );

      expect(heapTotalMB).toBeLessThan(TARGET_HEAP_MB);
    }, 120_000);
  });
});
