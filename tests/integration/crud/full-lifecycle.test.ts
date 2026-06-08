/**
 * Full CRUD Lifecycle Integration Test
 *
 * Tests complete CREATE → READ → UPDATE → DELETE lifecycle for WindowsEndpoints
 * including state reset functionality.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Full CRUD Lifecycle', () => {
  let app: Express;

  beforeAll(() => {
    // Use minimal-readwrite profile for CRUD testing
    app = createApp(ProfileMode.MINIMAL_READWRITE);
  });

  afterEach(async () => {
    // Reset state after each test
    await request(app).post('/api/reset');
  });

  describe('Complete CRUD Lifecycle', () => {
    it('should handle CREATE → READ → UPDATE → DELETE lifecycle', async () => {
      // Step 1: CREATE - POST /v2.0/WindowsEndpoints
      const createResponse = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({
          displayName: 'Lifecycle Test Endpoint',
          operatingSystem: 'Windows 11 Pro',
          primaryUser: 'testuser@example.com',
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body).toHaveProperty('guid');
      expect(createResponse.body.displayName).toBe('Lifecycle Test Endpoint');

      const endpointId = createResponse.body.id;

      // Step 2: READ - GET /v2.0/WindowsEndpoints/:id
      const readResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.id).toBe(endpointId);
      expect(readResponse.body.displayName).toBe('Lifecycle Test Endpoint');
      expect(readResponse.body.operatingSystem).toBe('Windows 11 Pro');

      // Step 3: UPDATE - PUT /v2.0/WindowsEndpoints/:id
      const updateResponse = await request(app)
        .put(`/v2.0/WindowsEndpoints/${endpointId}`)
        .send({
          displayName: 'Updated Lifecycle Endpoint',
          operatingSystem: 'Windows 11 Enterprise',
          primaryUser: 'admin@example.com',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.displayName).toBe('Updated Lifecycle Endpoint');
      expect(updateResponse.body.operatingSystem).toBe('Windows 11 Enterprise');

      // Step 4: READ (verify update) - GET /v2.0/WindowsEndpoints/:id
      const readAfterUpdateResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(readAfterUpdateResponse.status).toBe(200);
      expect(readAfterUpdateResponse.body.displayName).toBe('Updated Lifecycle Endpoint');

      // Step 5: DELETE - DELETE /v2.0/WindowsEndpoints/:id
      const deleteResponse = await request(app).delete(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(deleteResponse.status).toBe(204);

      // Step 6: READ (verify deletion) - GET /v2.0/WindowsEndpoints/:id
      const readAfterDeleteResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);

      expect(readAfterDeleteResponse.status).toBe(404);
    });

    it('should handle multiple endpoints in CRUD lifecycle', async () => {
      // Create 3 endpoints
      const endpoint1 = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Endpoint 1' });

      const endpoint2 = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Endpoint 2' });

      const endpoint3 = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Endpoint 3' });

      expect(endpoint1.status).toBe(201);
      expect(endpoint2.status).toBe(201);
      expect(endpoint3.status).toBe(201);

      // Read all endpoints (GET /v2.0/WindowsEndpoints)
      const listResponse = await request(app).get('/v2.0/WindowsEndpoints');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.totalItems).toBeGreaterThanOrEqual(5); // 2 from fixture + 3 created

      // Update endpoint 2
      await request(app)
        .put(`/v2.0/WindowsEndpoints/${endpoint2.body.id}`)
        .send({ displayName: 'Updated Endpoint 2' });

      // Delete endpoint 3
      await request(app).delete(`/v2.0/WindowsEndpoints/${endpoint3.body.id}`);

      // Verify final state
      const finalListResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(finalListResponse.body.totalItems).toBe(4); // 2 from fixture + 2 remaining
    });

    it('should handle PATCH (partial update) in lifecycle', async () => {
      // Create endpoint
      const createResponse = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({
          displayName: 'PATCH Test Endpoint',
          operatingSystem: 'Windows 10 Pro',
          primaryUser: 'user1@example.com',
        });

      const endpointId = createResponse.body.id;

      // PATCH (partial update) - only update displayName
      const patchResponse = await request(app)
        .patch(`/v2.0/WindowsEndpoints/${endpointId}`)
        .send({
          displayName: 'PATCHED Endpoint',
        });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.displayName).toBe('PATCHED Endpoint');
      expect(patchResponse.body.operatingSystem).toBe('Windows 10 Pro'); // Unchanged
      expect(patchResponse.body.primaryUser).toBe('user1@example.com'); // Unchanged

      // Verify PATCH persisted
      const readResponse = await request(app).get(`/v2.0/WindowsEndpoints/${endpointId}`);
      expect(readResponse.body.displayName).toBe('PATCHED Endpoint');
    });
  });

  describe('State Reset Functionality', () => {
    it('should reset state to initial fixtures with POST /api/reset', async () => {
      // Get initial state
      const initialResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const initialCount = initialResponse.body.totalItems;

      // Create 5 new endpoints
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/v2.0/WindowsEndpoints')
          .send({ displayName: `New Endpoint ${i}` });
      }

      // Verify state changed
      const afterCreateResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(afterCreateResponse.body.totalItems).toBe(initialCount + 5);

      // Reset state
      const resetResponse = await request(app).post('/api/reset');
      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body).toHaveProperty('message');

      // Verify state restored to initial fixtures
      const afterResetResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(afterResetResponse.body.totalItems).toBe(initialCount);
    });

    it('should restore deleted endpoints after reset', async () => {
      // Get initial endpoint IDs
      const initialResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const initialEndpoints = initialResponse.body.data;
      const firstEndpointId = initialEndpoints[0].id;

      // Delete first endpoint
      const deleteResponse = await request(app).delete(`/v2.0/WindowsEndpoints/${firstEndpointId}`);
      expect(deleteResponse.status).toBe(204);

      // Verify deletion
      const afterDeleteResponse = await request(app).get(`/v2.0/WindowsEndpoints/${firstEndpointId}`);
      expect(afterDeleteResponse.status).toBe(404);

      // Reset state
      await request(app).post('/api/reset');

      // Verify deleted endpoint is restored
      const afterResetResponse = await request(app).get(`/v2.0/WindowsEndpoints/${firstEndpointId}`);
      expect(afterResetResponse.status).toBe(200);
      expect(afterResetResponse.body.id).toBe(firstEndpointId);
    });

    it('should restore updated endpoints to original state after reset', async () => {
      // Get initial endpoint
      const initialResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const firstEndpoint = initialResponse.body.data[0];
      const originalDisplayName = firstEndpoint.displayName;

      // Update endpoint
      await request(app)
        .put(`/v2.0/WindowsEndpoints/${firstEndpoint.id}`)
        .send({ displayName: 'MODIFIED NAME' });

      // Verify update
      const afterUpdateResponse = await request(app).get(`/v2.0/WindowsEndpoints/${firstEndpoint.id}`);
      expect(afterUpdateResponse.body.displayName).toBe('MODIFIED NAME');

      // Reset state
      await request(app).post('/api/reset');

      // Verify original state restored
      const afterResetResponse = await request(app).get(`/v2.0/WindowsEndpoints/${firstEndpoint.id}`);
      expect(afterResetResponse.status).toBe(200);
      expect(afterResetResponse.body.displayName).toBe(originalDisplayName);
    });

    it('should handle reset after complex operations (CREATE + UPDATE + DELETE)', async () => {
      // Get initial count
      const initialResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const initialCount = initialResponse.body.totalItems;
      const firstEndpointId = initialResponse.body.data[0].id;

      // Complex operations:
      // 1. Create 3 new endpoints
      const created1 = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Created 1' });
      await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'Created 2' });
      await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'Created 3' });

      // 2. Update first created endpoint
      await request(app)
        .put(`/v2.0/WindowsEndpoints/${created1.body.id}`)
        .send({ displayName: 'Updated Created 1' });

      // 3. Delete first fixture endpoint
      await request(app).delete(`/v2.0/WindowsEndpoints/${firstEndpointId}`);

      // Verify state changed
      const beforeResetResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(beforeResetResponse.body.totalItems).toBe(initialCount + 2); // +3 created -1 deleted

      // Reset state
      await request(app).post('/api/reset');

      // Verify complete reset
      const afterResetResponse = await request(app).get('/v2.0/WindowsEndpoints');
      expect(afterResetResponse.body.totalItems).toBe(initialCount);

      // Verify created endpoints no longer exist
      const checkCreated = await request(app).get(`/v2.0/WindowsEndpoints/${created1.body.id}`);
      expect(checkCreated.status).toBe(404);

      // Verify deleted endpoint restored
      const checkRestored = await request(app).get(`/v2.0/WindowsEndpoints/${firstEndpointId}`);
      expect(checkRestored.status).toBe(200);
    });
  });

  describe('Error Handling in CRUD Lifecycle', () => {
    it('should handle 404 errors in UPDATE and DELETE operations', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';

      // Try to UPDATE non-existent endpoint
      const updateResponse = await request(app)
        .put(`/v2.0/WindowsEndpoints/${nonExistentId}`)
        .send({ displayName: 'Should Fail' });

      expect(updateResponse.status).toBe(404);

      // Try to DELETE non-existent endpoint
      const deleteResponse = await request(app).delete(`/v2.0/WindowsEndpoints/${nonExistentId}`);

      expect(deleteResponse.status).toBe(404);
    });

    it('should handle validation errors in CREATE operation', async () => {
      // Missing required field (displayName)
      const response = await request(app).post('/v2.0/WindowsEndpoints').send({
        operatingSystem: 'Windows 11',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid GUID format in READ/UPDATE/DELETE operations', async () => {
      const invalidGuid = 'not-a-valid-guid';

      // Try to READ with invalid GUID
      const readResponse = await request(app).get(`/v2.0/WindowsEndpoints/${invalidGuid}`);
      expect(readResponse.status).toBe(400);

      // Try to UPDATE with invalid GUID
      const updateResponse = await request(app)
        .put(`/v2.0/WindowsEndpoints/${invalidGuid}`)
        .send({ displayName: 'Should Fail' });
      expect(updateResponse.status).toBe(400);

      // Try to DELETE with invalid GUID
      const deleteResponse = await request(app).delete(`/v2.0/WindowsEndpoints/${invalidGuid}`);
      expect(deleteResponse.status).toBe(400);
    });
  });

  describe('Read-Only Profile Validation', () => {
    it('should return 403 for write operations in minimal-readonly profile', async () => {
      const readonlyApp = createApp(ProfileMode.MINIMAL_READONLY);

      // POST should return 403
      const postResponse = await request(readonlyApp)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Should Fail' });
      expect(postResponse.status).toBe(403);

      // GET should still work
      const getResponse = await request(readonlyApp).get('/v2.0/WindowsEndpoints');
      expect(getResponse.status).toBe(200);

      // Reset should return 403
      const resetResponse = await request(readonlyApp).post('/api/reset');
      expect(resetResponse.status).toBe(403);
    });
  });
});
