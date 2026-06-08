/**
 * P6.10 - Swagger UI tests
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';

describe('Swagger UI / OpenAPI spec', () => {
  const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);

  it('GET /api-docs redirects or returns HTML with swagger-ui', async () => {
    const res = await request(app).get('/api-docs');
    // swagger-ui-express serves a redirect from /api-docs to /api-docs/
    expect([200, 301, 302]).toContain(res.status);
  });

  it('GET /api-docs/ returns swagger-ui HTML', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('swagger');
  });

  it('GET /api-docs/swagger.json returns valid OpenAPI spec', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    const spec = res.body as Record<string, unknown>;
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info).toBeDefined();
    expect(spec.paths).toBeDefined();
  });

  it('OpenAPI spec contains key endpoints', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    const spec = res.body as { paths: Record<string, unknown> };
    expect(spec.paths['/v2.0/WindowsEndpoints']).toBeDefined();
    expect(spec.paths['/v2.0/Software']).toBeDefined();
    expect(spec.paths['/health']).toBeDefined();
  });
});
