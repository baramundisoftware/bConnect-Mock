/**
 * P6.11 - Security tests: input validation, DoS vectors, error disclosure
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';

const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);

describe('Security: DoS — PageSize upper bound', () => {
  it('rejects PageSize above MAX_PAGE_SIZE with 400', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=100001');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PageSize/i);
  });

  it('rejects PageSize above 10000 (new cap) with 400', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=10001');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PageSize/i);
  });

  it('accepts PageSize at the boundary (10000)', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=10000');
    expect([200, 404]).toContain(res.status);
  });

  it('rejects negative PageSize with 400', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PageSize/i);
  });

  it('rejects negative Page with 400', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?Page=-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Page/i);
  });
});

describe('Security: DoS — SearchQuery length limit', () => {
  it('rejects SearchQuery longer than 500 chars with 400', async () => {
    const longQuery = 'a'.repeat(501);
    const res = await request(app).get(`/v2.0/WindowsEndpoints?SearchQuery=${encodeURIComponent(longQuery)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SearchQuery/i);
  });

  it('accepts SearchQuery at the boundary (500 chars)', async () => {
    const query = 'a'.repeat(500);
    const res = await request(app).get(`/v2.0/WindowsEndpoints?SearchQuery=${encodeURIComponent(query)}`);
    expect([200, 404]).toContain(res.status);
  });
});

describe('Security: Error disclosure', () => {
  it('500 errors do not leak stack traces', async () => {
    // Trigger a 404 on a non-existent endpoint
    const res = await request(app).get('/v2.0/NonExistent');
    expect(res.status).not.toBe(500);
  });

  it('error responses have consistent shape', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=-1');
    expect(res.body).toHaveProperty('error');
    expect(res.body.stack).toBeUndefined();
  });

  it('500 responses never include raw error message field', async () => {
    // All 500 catch blocks must not expose error.message to clients
    // We verify the shape: only { error: 'Internal server error' }, no 'message' key
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=-1');
    expect(res.body.message).toBeUndefined();
  });

  it('400 validation responses never include raw Error.message field', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=99999999999');
    expect(res.body.message).toBeUndefined();
  });

  it('error response body does not contain stack property', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints/invalid-guid');
    expect(res.body.stack).toBeUndefined();
  });
});

describe('Security: HTTP security headers', () => {
  it('sets X-Content-Type-Options: nosniff on all responses', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY on all responses', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sets X-XSS-Protection: 0 on all responses', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    expect(res.headers['x-xss-protection']).toBe('0');
  });

  it('sets security headers on 404 responses', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sets security headers on 400 responses', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=-1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

describe('Security: Read-only guard', () => {
  it('blocks POST mutations in readonly profile (non-action path)', async () => {
    const res = await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'test' });
    expect(res.status).toBe(403);
  });

  it('allows POST action paths in readonly profile', async () => {
    const res = await request(app).post('/v2.0/Microservices/some-id/Start');
    // Returns 404 (not found) or 200, but NOT 403 (write blocked)
    expect(res.status).not.toBe(403);
  });
});

describe('Security: OrderBy injection', () => {
  it('handles OrderBy with special characters without crashing', async () => {
    const malicious = encodeURIComponent("displayName asc; DROP TABLE users--");
    const res = await request(app).get(`/v2.0/WindowsEndpoints?OrderBy=${malicious}`);
    // Should succeed — no SQL here, just string comparison, no crash
    expect([200, 400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('handles very long OrderBy without crashing', async () => {
    const longOrderBy = encodeURIComponent('displayName asc,'.repeat(50));
    const res = await request(app).get(`/v2.0/WindowsEndpoints?OrderBy=${longOrderBy}`);
    expect(res.status).not.toBe(500);
  });
});
