/**
 * P6.12 - Rate limiting tests (optional, configurable via RATE_LIMIT_ENABLED)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';

describe('Rate Limiting — disabled by default', () => {
  it('does not rate-limit when RATE_LIMIT_ENABLED is unset', async () => {
    delete process.env.RATE_LIMIT_ENABLED;
    const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);
    // Fire 20 requests — none should be rate-limited
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get('/health');
      expect(res.status).not.toBe(429);
    }
  });
});

describe('Rate Limiting — enabled via RATE_LIMIT_ENABLED=true', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_MAX = '5';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_ENABLED;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('allows requests within the limit', async () => {
    const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('blocks the 6th request from the same IP with 429', async () => {
    const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);
    for (let i = 0; i < 5; i++) {
      await request(app).get('/health');
    }
    const res = await request(app).get('/health');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/rate limit/i);
  });

  it('includes Retry-After header on 429 responses', async () => {
    const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);
    for (let i = 0; i < 5; i++) {
      await request(app).get('/health');
    }
    const res = await request(app).get('/health');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
