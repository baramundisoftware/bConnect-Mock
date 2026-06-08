/**
 * Concurrency Safety Tests
 *
 * Tests that concurrent POST/PUT/PATCH/DELETE operations don't cause
 * data corruption, race conditions, or ID conflicts.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Concurrent Operations', () => {
  let app: Express;

  beforeAll(() => {
    // Use minimal-readwrite profile for CRUD testing
    app = createApp(ProfileMode.MINIMAL_READWRITE);
  });

  afterEach(async () => {
    // Reset state after each test
    await request(app).post('/api/reset');
  });

  describe('Concurrent POST Requests', () => {
    it('should handle 10 concurrent POST requests without ID conflicts', async () => {
      // Reset state first
      await request(app).post('/api/reset');

      // Create 10 concurrent POST requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Concurrent Endpoint ${i}` })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed with HTTP 201
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('guid');
        expect(response.body.displayName).toMatch(/^Concurrent Endpoint \d$/);
      });

      // All IDs should be unique
      const ids = responses.map((r) => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      // All GUIDs should be unique
      const guids = responses.map((r) => r.body.guid);
      const uniqueGuids = new Set(guids);
      expect(uniqueGuids.size).toBe(10);
    });

    it('should handle 100 concurrent POST requests without ID conflicts', async () => {
      // Reset state first
      await request(app).post('/api/reset');

      // Stress test: 100 concurrent POST requests
      const promises = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Stress Endpoint ${i}` })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // All IDs should be unique
      const ids = responses.map((r) => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });

    it('should persist all concurrently created endpoints (GET by ID)', async () => {
      // Reset state first
      await request(app).post('/api/reset');

      // Create 10 endpoints concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Persisted Endpoint ${i}` })
      );

      const createResponses = await Promise.all(promises);

      // Verify each created endpoint can be retrieved by ID
      const verifyPromises = createResponses.map((createRes) =>
        request(app).get(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
      );

      const verifyResponses = await Promise.all(verifyPromises);

      verifyResponses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.displayName).toMatch(/^Persisted Endpoint \d$/);
      });
    });
  });

  describe('Concurrent PUT Requests', () => {
    it('should handle concurrent updates to different endpoints', async () => {
      // Create 5 endpoints
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Original ${i}` })
      );

      const createResponses = await Promise.all(createPromises);

      // Update all 5 endpoints concurrently
      const updatePromises = createResponses.map((createRes, i) =>
        request(app)
          .put(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
          .send({ displayName: `Updated ${i}` })
      );

      const updateResponses = await Promise.all(updatePromises);

      // All updates should succeed
      updateResponses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.displayName).toBe(`Updated ${i}`);
      });
    });

    it('should handle concurrent updates to the same endpoint (last write wins)', async () => {
      // Create one endpoint
      const createResponse = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Original' });

      const endpointId = createResponse.body.id;

      // Update same endpoint concurrently with different values
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .put(`/v2.0/WindowsEndpoints/${endpointId}`)
          .send({ displayName: `Update ${i}` })
      );

      const updateResponses = await Promise.all(updatePromises);

      // All updates should succeed
      updateResponses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(endpointId);
      });

      // Final state should be one of the updates (last write wins)
      const finalResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.body.displayName).toMatch(/^Update \d$/);
    });
  });

  describe('Concurrent DELETE Requests', () => {
    it('should handle concurrent deletes to different endpoints', async () => {
      // Create 5 endpoints
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `ToDelete ${i}` })
      );

      const createResponses = await Promise.all(createPromises);

      // Delete all 5 endpoints concurrently
      const deletePromises = createResponses.map((createRes) =>
        request(app).delete(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
      );

      const deleteResponses = await Promise.all(deletePromises);

      // All deletes should succeed
      deleteResponses.forEach((response) => {
        expect(response.status).toBe(204);
      });

      // Verify all endpoints are deleted
      const verifyPromises = createResponses.map((createRes) =>
        request(app).get(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
      );

      const verifyResponses = await Promise.all(verifyPromises);

      verifyResponses.forEach((response) => {
        expect(response.status).toBe(404);
      });
    });

    it('should handle concurrent deletes to the same endpoint (idempotent)', async () => {
      // Create one endpoint
      const createResponse = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'ToDelete' });

      const endpointId = createResponse.body.id;

      // Delete same endpoint concurrently 10 times
      const deletePromises = Array.from({ length: 10 }, () =>
        request(app).delete(`/v2.0/WindowsEndpoints/${endpointId}`)
      );

      const deleteResponses = await Promise.all(deletePromises);

      // First delete should succeed (204), others should return 404
      const successCount = deleteResponses.filter((r) => r.status === 204).length;
      const notFoundCount = deleteResponses.filter((r) => r.status === 404).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(successCount + notFoundCount).toBe(10);

      // Verify endpoint is deleted
      const finalResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(finalResponse.status).toBe(404);
    });
  });

  describe('Mixed Concurrent Operations', () => {
    it('should handle mix of POST/PUT/DELETE operations concurrently', async () => {
      // Reset state first
      await request(app).post('/api/reset');

      // Create 5 endpoints first
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Mixed ${i}` })
      );

      const createResponses = await Promise.all(createPromises);

      // Mix of operations:
      // - 5 new POST requests
      // - 3 PUT updates to existing endpoints
      // - 2 DELETE requests to existing endpoints
      const mixedPromises = [
        // New POSTs
        ...Array.from({ length: 5 }, (_, i) =>
          request(app)
            .post('/v2.0/WindowsEndpoints')
            .send({ displayName: `New ${i}` })
        ),
        // PUTs
        ...createResponses.slice(0, 3).map((createRes, i) =>
          request(app)
            .put(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
            .send({ displayName: `Updated ${i}` })
        ),
        // DELETEs
        ...createResponses.slice(3, 5).map((createRes) =>
          request(app).delete(`/v2.0/WindowsEndpoints/${createRes.body.id}`)
        ),
      ];

      const responses = await Promise.all(mixedPromises);

      // Verify responses
      // 5 POSTs should return 201
      expect(responses.slice(0, 5).every((r) => r.status === 201)).toBe(true);

      // 3 PUTs should return 200
      expect(responses.slice(5, 8).every((r) => r.status === 200)).toBe(true);

      // 2 DELETEs should return 204
      expect(responses.slice(8, 10).every((r) => r.status === 204)).toBe(true);

      // Verify created and updated endpoints can be retrieved by ID
      const newIds = responses.slice(0, 5).map((r) => r.body.id);
      const updatedIds = createResponses.slice(0, 3).map((r) => r.body.id);

      const verifyPromises = [...newIds, ...updatedIds].map((id) =>
        request(app).get(`/v2.0/WindowsEndpoints/${id}`)
      );

      const verifyResponses = await Promise.all(verifyPromises);

      // All should be retrievable (5 new + 3 updated)
      expect(verifyResponses.every((r) => r.status === 200)).toBe(true);
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle rapid sequential creates (no delay between requests)', async () => {
      const ids: string[] = [];

      // Create 20 endpoints sequentially (but fast)
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `Sequential ${i}` });

        expect(response.status).toBe(201);
        ids.push(response.body.id);
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });

    it('should maintain state consistency after concurrent operations', async () => {
      // Perform 50 random operations concurrently
      const operations = [];

      for (let i = 0; i < 50; i++) {
        const op = i % 3;

        if (op === 0) {
          // POST
          operations.push(
            request(app)
              .post('/v2.0/WindowsEndpoints')
              .send({ displayName: `Random ${i}` })
          );
        } else if (op === 1) {
          // PUT (try to update a potentially non-existent endpoint)
          const randomGuid = '12345678-1234-1234-1234-123456789012';
          operations.push(
            request(app)
              .put(`/v2.0/WindowsEndpoints/${randomGuid}`)
              .send({ displayName: `Updated ${i}` })
          );
        } else {
          // DELETE (try to delete a potentially non-existent endpoint)
          const randomGuid = '12345678-1234-1234-1234-123456789012';
          operations.push(request(app).delete(`/v2.0/WindowsEndpoints/${randomGuid}`));
        }
      }

      const responses = await Promise.all(operations);

      // No 500 errors should occur
      const serverErrors = responses.filter((r) => r.status >= 500);
      expect(serverErrors.length).toBe(0);

      // Verify state is still queryable
      const listResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.totalItems).toBeGreaterThan(0);
    });
  });
});
