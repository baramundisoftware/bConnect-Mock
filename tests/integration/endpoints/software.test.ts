import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('GET /v2.0/Software', () => {
  let app: Express;

  beforeAll(() => {
    // Arrange: Create app with minimal-readonly profile
    app = createApp(ProfileMode.MINIMAL_READONLY);
  });

  describe('minimal-readonly profile', () => {
    it('should return 200 and array with 1 software item', async () => {
      // Act: Make GET request to Software
      const response = await request(app)
        .get('/v2.0/Software')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Response contains exactly 1 software item
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return software item with valid structure', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/Software')
        .expect(200);

      // Assert: Software item has required fields
      const software = response.body.data[0];
      expect(software).toBeDefined();
      expect(software).toHaveProperty('id');
      expect(software).toHaveProperty('name');
      expect(software).toHaveProperty('vendor');
      expect(software).toHaveProperty('version');

      // Validate GUID format for ID
      expect(software.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return pagination metadata', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/Software')
        .expect(200);

      // Assert: Response contains pagination fields
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalItems');

      // Verify pagination values
      expect(response.body.pageSize).toBeGreaterThan(0);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.totalItems).toBe(1);
    });

    it('should have realistic software data', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/Software')
        .expect(200);

      // Assert: Software data is realistic (not placeholder values)
      const software = response.body.data[0];
      expect(software.name).not.toBe('');
      expect(software.name).not.toBe('test');
      expect(software.name).not.toMatch(/foo|bar|baz/i);

      // Check vendor is a known software vendor
      expect(software.vendor).toBeDefined();
      expect(software.vendor).not.toBe('');
    });

    it('should return consistent data on multiple requests', async () => {
      // Act: Make two GET requests
      const response1 = await request(app).get('/v2.0/Software');
      const response2 = await request(app).get('/v2.0/Software');

      // Assert: Data is deterministic (same on every request)
      expect(response1.body).toEqual(response2.body);
      expect(response1.body.data[0].id).toBe(response2.body.data[0].id);
    });
  });

  describe('pagination query parameters', () => {
    it('should respect PageSize and Page query parameters', async () => {
      // Act: Request with pagination parameters
      const response = await request(app)
        .get('/v2.0/Software?PageSize=10&Page=0')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Pagination parameters are respected
      expect(response.body).toHaveProperty('pageSize', 10);
      expect(response.body).toHaveProperty('currentPage', 0);
      expect(response.body).toHaveProperty('totalItems', 1);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('SearchQuery filtering', () => {
    it('should filter by software name', async () => {
      // Arrange: Get the software name
      const getResponse = await request(app).get('/v2.0/Software');
      const softwareName = getResponse.body.data[0].name;

      // Act: Search for software by name
      const response = await request(app)
        .get(`/v2.0/Software?SearchQuery=${softwareName}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Software item is returned
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe(softwareName);
    });

    it('should return empty array when SearchQuery has no matches', async () => {
      // Act: Search for non-existent software
      const response = await request(app)
        .get('/v2.0/Software?SearchQuery=NonExistentSoftware12345')
        .expect(200);

      // Assert: Empty results
      expect(response.body.data).toHaveLength(0);
      expect(response.body.totalItems).toBe(0);
    });
  });

  describe('read-only guard', () => {
    it('should return 403 Not Implemented for POST /v2.0/Software', async () => {
      // Arrange: Valid software data
      const newSoftware = {
        name: 'New Software',
        vendor: 'Test Vendor',
        version: '1.0.0'
      };

      // Act: Attempt to create software via POST
      const response = await request(app)
        .post('/v2.0/Software')
        .send(newSoftware)
        .expect('Content-Type', /json/)
        .expect(403);

      // Assert: Read-only guard prevents POST operation
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not implemented|read-only/i);
    });
  });
});
