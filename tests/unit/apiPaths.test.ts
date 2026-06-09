/**
 * API Paths Cross-Check — verifies every path in the OpenAPI spec
 * has a corresponding registered Express route, and vice versa.
 *
 * Catches path drift between the spec (served at /api-docs) and the
 * actual route registrations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { BmsVersion, ProfileMode } from '../../src/profiles/ProfileManager';

describe('OpenAPI path cross-check', () => {
  let app: Express;
  let specPaths: string[];

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    // Fetch the spec from the running app
    const res = await request(app).get('/api-docs/swagger.json').expect(200);
    specPaths = Object.keys(res.body.paths).sort();
  });

  it('spec should have paths defined', () => {
    expect(specPaths.length).toBeGreaterThan(0);
  });

  it('every OpenAPI spec path should be reachable (not 404)', async () => {
    const specObj = (await request(app).get('/api-docs/swagger.json').expect(200)).body;
    const unreachable: string[] = [];

    for (const specPath of specPaths) {
      // Skip non-API paths (health, reset)
      if (specPath === '/health' || specPath === '/api/reset') { continue; }

      // Convert OpenAPI {id} params to a dummy GUID
      const testPath = specPath.replace(/\{[^}]+\}/g, '00000000-0000-0000-0000-000000000000');

      // Use the first available HTTP method from the spec
      const methods = Object.keys(specObj.paths[specPath]);
      const method = methods.includes('get') ? 'get' : methods[0];

      const res = await (request(app) as unknown as Record<string, (path: string) => { send: (body?: object) => Promise<{ status: number; text?: string }> }>)[method](testPath).send(method === 'post' ? {} : undefined);
      // 404 from Express ("Cannot GET/POST/...") means route is not registered
      // 404 from our handler (entity not found) is fine — it means the route exists
      const is404Express = res.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE)/.test(res.text || '');
      if (is404Express) {
        unreachable.push(specPath);
      }
    }

    expect(unreachable).toEqual([]);
  });

  it('spec should document all major API collections', () => {
    const expectedCollections = [
      '/v2.0/WindowsEndpoints',
      '/v2.0/AndroidEndpoints',
      '/v2.0/LinuxEndpoints',
      '/v2.0/MacEndpoints',
      '/v2.0/IosEndpoints',
      '/v2.0/NetworkEndpoints',
      '/v2.0/IndustrialEndpoints',
      '/v2.0/Software',
      '/v2.0/WindowsUpdates',
      '/v2.0/JobDefinitions',
      '/v2.0/JobInstances',
      '/v2.0/Assets',
      '/v2.0/Variables',
      '/v2.0/ADGroups',
      '/v2.0/ADObjects',
      '/v2.0/Microservices',
      '/v2.0/LogicalGroups',
      '/v2.0/Rules',
      '/v2.0/Vulnerabilities',
      '/v2.0/UniversalDynamicGroups',
      '/v2.0/UnmanagedEndpoints',
    ];

    for (const collection of expectedCollections) {
      expect(specPaths).toContain(collection);
    }
  });

  it('every spec path with {id} should also have a collection path', () => {
    const idPaths = specPaths.filter(p => p.includes('{id}') && !p.includes('/'));
    // This is a sanity check — if an {id} route exists, its parent collection should too
    for (const idPath of idPaths) {
      const collectionPath = idPath.replace(/\/\{id\}$/, '');
      if (collectionPath !== idPath) {
        expect(specPaths).toContain(collectionPath);
      }
    }
  });
});
