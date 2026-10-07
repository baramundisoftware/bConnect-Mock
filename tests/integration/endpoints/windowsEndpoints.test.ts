import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('GET /v2.0/WindowsEndpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Arrange: Create app with minimal-readonly profile
    app = createApp(ProfileMode.MINIMAL_READONLY);
  });

  describe('minimal-readonly profile', () => {
    it('should return 200 and array with 2 endpoints', async () => {
      // Act: Make GET request to WindowsEndpoints
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Response contains exactly 2 endpoints
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return endpoint with valid structure', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect(200);

      // Assert: Endpoint has required fields
      const endpoint = response.body.data[0];
      expect(endpoint).toBeDefined();
      expect(endpoint).toHaveProperty('id');
      expect(endpoint).toHaveProperty('type', 'WindowsEndpoint');
      expect(endpoint).toHaveProperty('displayName');
      expect(endpoint).toHaveProperty('operatingSystem');
      expect(endpoint).toHaveProperty('primaryUser');
      expect(endpoint).toHaveProperty('guid');

      // Validate GUID format
      expect(endpoint.guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return pagination metadata', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect(200);

      // Assert: Response contains pagination fields
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalItems');

      // Verify pagination values for minimal profile
      expect(response.body.pageSize).toBeGreaterThan(0);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.totalItems).toBe(2);
    });

    it('should have realistic endpoint data', async () => {
      // Act: Make GET request
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect(200);

      // Assert: Endpoint data is realistic (not placeholder values)
      const endpoint = response.body.data[0];
      expect(endpoint.displayName).not.toBe('');
      expect(endpoint.displayName).not.toBe('test');
      expect(endpoint.displayName).not.toMatch(/foo|bar|baz/i);

      // Check OS is valid Windows version
      expect(endpoint.operatingSystem).toMatch(/Windows (10|11|Server)/i);
    });

    it('should return consistent data on multiple requests', async () => {
      // Act: Make two GET requests
      const response1 = await request(app).get('/v2.0/WindowsEndpoints');
      const response2 = await request(app).get('/v2.0/WindowsEndpoints');

      // Assert: Data is deterministic (same on every request)
      expect(response1.body).toEqual(response2.body);
      expect(response1.body.data[0].guid).toBe(response2.body.data[0].guid);
    });
  });

  describe('pagination query parameters', () => {
    it('should respect PageSize=1 and Page=0 query parameters', async () => {
      // Act: Request with pagination parameters
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?PageSize=1&Page=0')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Pagination parameters are respected
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize', 1);
      expect(response.body).toHaveProperty('currentPage', 0);
      expect(response.body).toHaveProperty('totalItems', 2);

      // Assert: Only 1 endpoint returned per page (PageSize=1)
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return empty array when Page exceeds available data', async () => {
      // Act: Request page beyond available data (2 endpoints exist, request page 3 — zero-indexed, beyond the data)
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?PageSize=1&Page=3')
        .expect(200);

      // Assert: Empty data array, but pagination metadata still present
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pageSize).toBe(1);
      expect(response.body.totalItems).toBe(2);
    });

    it('should handle PageSize larger than total count', async () => {
      // Act: Request with PageSize=10 (but only 2 endpoints exist)
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?PageSize=10&Page=0')
        .expect(200);

      // Assert: All available data returned (2 endpoints)
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pageSize).toBe(10);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.totalItems).toBe(2);
    });

    it('should use default pagination when parameters not provided', async () => {
      // Act: Request without pagination parameters
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect(200);

      // Assert: Default pagination (all data returned - 2 endpoints)
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pageSize).toBeGreaterThan(0);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.totalItems).toBe(2);
    });
  });

  describe('SearchQuery filtering', () => {
    it('should filter by DisplayName (exact match)', async () => {
      // Act: Search for exact DisplayName
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=DESKTOP-WS001')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Only matching endpoint returned
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].displayName).toBe('DESKTOP-WS001');
      expect(response.body.totalItems).toBe(1);
    });

    it('should filter by DisplayName (partial match - case insensitive)', async () => {
      // Act: Search with partial DisplayName (lowercase)
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=desktop')
        .expect(200);

      // Assert: Partial match found
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].displayName).toMatch(/desktop/i);
    });

    it('should filter by DisplayName (substring match)', async () => {
      // Act: Search with substring "WS001"
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=WS001')
        .expect(200);

      // Assert: Substring match found
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].displayName).toContain('WS001');
    });

    it('should return empty array when SearchQuery has no matches', async () => {
      // Act: Search for non-existent DisplayName
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=NonExistentComputer')
        .expect(200);

      // Assert: Empty results
      expect(response.body.data).toHaveLength(0);
      expect(response.body.totalItems).toBe(0);
      expect(response.body.currentPage).toBe(0);
    });

    it('should combine SearchQuery with pagination', async () => {
      // Act: Search with pagination parameters
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=DESKTOP&PageSize=10&Page=0')
        .expect(200);

      // Assert: Pagination and filtering work together
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pageSize).toBe(10);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.totalItems).toBe(1);
    });

    it('should handle empty SearchQuery (return all results)', async () => {
      // Act: Request with empty SearchQuery
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=')
        .expect(200);

      // Assert: All endpoints returned (same as no SearchQuery - 2 endpoints)
      expect(response.body.data).toHaveLength(2);
      expect(response.body.totalItems).toBe(2);
    });
  });

  describe('OrderBy sorting', () => {
    it('should sort by DisplayName ascending (asc)', async () => {
      // Act: Request with OrderBy=DisplayName asc
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName asc')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Data is sorted by DisplayName in ascending order
      expect(response.body.data).toBeDefined();
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

      // Check if array is sorted in ascending order
      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeLessThanOrEqual(0);
      }
    });

    it('should sort by DisplayName descending (desc)', async () => {
      // Act: Request with OrderBy=DisplayName desc
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName desc')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Data is sorted by DisplayName in descending order
      expect(response.body.data).toBeDefined();
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

      // Check if array is sorted in descending order
      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeGreaterThanOrEqual(0);
      }
    });

    it('should sort case-insensitively', async () => {
      // Act: Request with OrderBy=DisplayName asc
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName asc')
        .expect(200);

      // Assert: Sorting is case-insensitive (A comes before a, not after z)
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

      // Compare with case-insensitive sorted version
      const sortedNames = [...displayNames].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      expect(displayNames).toEqual(sortedNames);
    });

    it('should default to ascending when order direction not specified', async () => {
      // Act: Request with OrderBy=DisplayName (no direction)
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName')
        .expect(200);

      // Assert: Data is sorted in ascending order (default)
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeLessThanOrEqual(0);
      }
    });

    it('should combine OrderBy with SearchQuery', async () => {
      // Act: Request with both OrderBy and SearchQuery
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=DESKTOP&OrderBy=DisplayName desc')
        .expect(200);

      // Assert: Filtering applied, then sorting
      expect(response.body.data).toBeDefined();

      // All results should match the search query
      response.body.data.forEach((e: { displayName: string }) => {
        expect(e.displayName.toLowerCase()).toContain('desktop');
      });

      // Results should be sorted in descending order
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);
      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeGreaterThanOrEqual(0);
      }
    });

    it('should combine OrderBy with pagination', async () => {
      // Act: Request with OrderBy and pagination
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName asc&PageSize=2&Page=0')
        .expect(200);

      // Assert: Sorting applied before pagination
      expect(response.body.data).toBeDefined();
      expect(response.body.pageSize).toBe(2);
      expect(response.body.currentPage).toBe(0);

      // Data should be sorted
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);
      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeLessThanOrEqual(0);
      }
    });

    it('should handle OrderBy with all three parameters (SearchQuery + OrderBy + Pagination)', async () => {
      // Act: Request with SearchQuery, OrderBy, and Pagination
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=D&OrderBy=DisplayName desc&PageSize=5&Page=0')
        .expect(200);

      // Assert: All three operations work together
      // 1. Filtering by SearchQuery
      response.body.data.forEach((e: { displayName: string }) => {
        expect(e.displayName.toLowerCase()).toContain('d');
      });

      // 2. Sorting by OrderBy (descending)
      const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);
      for (let i = 0; i < displayNames.length - 1; i++) {
        expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeGreaterThanOrEqual(0);
      }

      // 3. Pagination applied
      expect(response.body.pageSize).toBe(5);
      expect(response.body.currentPage).toBe(0);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty result set with OrderBy', async () => {
      // Act: Request with OrderBy on empty result set (no matches)
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints?SearchQuery=NonExistent&OrderBy=DisplayName asc')
        .expect(200);

      // Assert: Empty array, no errors
      expect(response.body.data).toHaveLength(0);
      expect(response.body.totalItems).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should return 404 for non-existent endpoint ID', async () => {
      // Act: Request non-existent endpoint
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
        .expect(404);

      // Assert: Error response format
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/not found/i);
    });

    it('should return 400 for invalid GUID format', async () => {
      // Act: Request with invalid GUID
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints/invalid-guid')
        .expect(400);

      // Assert: Validation error response
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/invalid|guid/i);
    });
  });

  describe('read-only guard (minimal-readonly profile)', () => {
    it('should return 403 Not Implemented for POST /v2.0/WindowsEndpoints', async () => {
      // Arrange: Valid WindowsEndpoint data
      const newEndpoint = {
        displayName: 'NEW-ENDPOINT-001',
        operatingSystem: 'Windows 11 Pro',
        primaryUser: 'testuser@example.com',
        guid: '00000000-0000-0000-0000-000000000001'
      };

      // Act: Attempt to create new endpoint via POST
      const response = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send(newEndpoint)
        .expect('Content-Type', /json/)
        .expect(403);

      // Assert: Read-only guard prevents POST operation
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/not implemented|read-only/i);
    });

    it('should return 403 Not Implemented for PUT /v2.0/WindowsEndpoints/{id}', async () => {
      // Arrange: Get existing endpoint ID
      const getResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const existingId = getResponse.body.data[0].id;

      const updateData = {
        displayName: 'UPDATED-NAME'
      };

      // Act: Attempt to update endpoint via PUT
      const response = await request(app)
        .put(`/v2.0/WindowsEndpoints/${existingId}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(403);

      // Assert: Read-only guard prevents PUT operation
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/not implemented|read-only/i);
    });

    it('should return 403 Not Implemented for PATCH /v2.0/WindowsEndpoints/{id}', async () => {
      // Arrange: Get existing endpoint ID
      const getResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const existingId = getResponse.body.data[0].id;

      const patchData = {
        displayName: 'PATCHED-NAME'
      };

      // Act: Attempt to partially update endpoint via PATCH
      const response = await request(app)
        .patch(`/v2.0/WindowsEndpoints/${existingId}`)
        .send(patchData)
        .expect('Content-Type', /json/)
        .expect(403);

      // Assert: Read-only guard prevents PATCH operation
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/not implemented|read-only/i);
    });

    it('should return 403 Not Implemented for DELETE /v2.0/WindowsEndpoints/{id}', async () => {
      // Arrange: Get existing endpoint ID
      const getResponse = await request(app).get('/v2.0/WindowsEndpoints');
      const existingId = getResponse.body.data[0].id;

      // Act: Attempt to delete endpoint via DELETE
      const response = await request(app)
        .delete(`/v2.0/WindowsEndpoints/${existingId}`)
        .expect('Content-Type', /json/)
        .expect(403);

      // Assert: Read-only guard prevents DELETE operation
      expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
      expect(response.headers['x-bconnect-mock-reason']).toMatch(/not implemented|read-only/i);
    });

    it('should still allow GET requests (read operations)', async () => {
      // Act: Verify GET requests still work
      const response = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Read operations are unaffected
      expect(response.body.data).toHaveLength(2);
    });
  });
});

describe('GET /v2.0/WindowsEndpoints (standard-readonly profile)', () => {
  let app: Express;

  beforeAll(() => {
    // Arrange: Create app with standard-readonly profile
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('should return 200 and array with 10 endpoints', async () => {
    // Act: Make GET request to WindowsEndpoints with standard-readonly profile
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: Response contains exactly 10 endpoints
    expect(response.body).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.totalItems).toBe(10);
  });

  it('should return endpoints with varied operating systems', async () => {
    // Act: Make GET request
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .expect(200);

    // Assert: Endpoints have different OS versions (Windows 10, 11, Server)
    const operatingSystems = response.body.data.map((e: { operatingSystem: string }) => e.operatingSystem);
    const uniqueOS = new Set(operatingSystems);

    expect(uniqueOS.size).toBeGreaterThan(1); // At least 2 different OS versions
    expect(operatingSystems.some((os: string) => os.includes('Windows 11'))).toBe(true);
    expect(operatingSystems.some((os: string) => os.includes('Windows 10'))).toBe(true);
  });

  it('should return endpoints with varied geographic locations', async () => {
    // Act: Make GET request
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .expect(200);

    // Assert: Endpoints from different locations (NYC, LON, SIN, etc.)
    const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

    // Check for geographic diversity in endpoint names
    expect(displayNames.some((name: string) => name.includes('NYC'))).toBe(true);
    expect(displayNames.some((name: string) => name.includes('LON') || name.includes('FRA') || name.includes('BER'))).toBe(true);
    expect(displayNames.some((name: string) => name.includes('SIN') || name.includes('TOK') || name.includes('SYD'))).toBe(true);
  });

  it('should return endpoints with realistic organizational units', async () => {
    // Act: Make GET request
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .expect(200);

    // Assert: OrgUnits follow proper structure (ou=Region,ou=Location,ou=Department)
    const orgUnits = response.body.data.map((e: { orgUnit: string }) => e.orgUnit);

    orgUnits.forEach((ou: string) => {
      expect(ou).toMatch(/ou=/i); // Contains OU designation
      expect(ou.split(',').length).toBeGreaterThanOrEqual(2); // Multi-level hierarchy
    });

    // Check for different departments
    const allOUs = orgUnits.join(' ');
    expect(allOUs).toMatch(/Finance|Engineering|Marketing|Sales|IT|Support|Operations|Research/i);
  });

  it('should support pagination with PageSize=5', async () => {
    // Act: Request first page with PageSize=5
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?PageSize=5&Page=0')
      .expect(200);

    // Assert: Returns exactly 5 endpoints
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pageSize).toBe(5);
    expect(response.body.currentPage).toBe(0);
    expect(response.body.totalItems).toBe(10);
  });

  it('should support pagination with Page=1 (second page, zero-indexed)', async () => {
    // Arrange: Get all endpoints first to verify correct slice
    const allResponse = await request(app)
      .get('/v2.0/WindowsEndpoints?PageSize=100&Page=0')
      .expect(200);

    const allEndpoints = allResponse.body.data;
    const expectedSlice = allEndpoints.slice(5, 10); // Second page (indices 5-9)

    // Act: Request second page with PageSize=5 (Page=1 is the zero-indexed second page)
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?PageSize=5&Page=1')
      .expect(200);

    // Assert: Returns remaining 5 endpoints (second page)
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pageSize).toBe(5);
    expect(response.body.totalItems).toBe(10);

    // Assert: Correct slice returned (endpoints 6-10, indices 5-9)
    expect(response.body.data[0].id).toBe(expectedSlice[0].id);
    expect(response.body.data[4].id).toBe(expectedSlice[4].id);

    // Verify IDs match expected endpoints from fixture (PCDE006-010)
    const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);
    expect(displayNames).toContain('PCDE006-FRA');
    expect(displayNames).toContain('PCDE007-TOK');
    expect(displayNames).toContain('PCDE008-NYC');
    expect(displayNames).toContain('PCDE009-BER');
    expect(displayNames).toContain('PCDE010-SYD');
  });

  it('should filter endpoints by multiple keywords in SearchQuery', async () => {
    // Act: Search for endpoints with "NYC" OR "Enterprise" keywords (space-separated)
    // Expected matches: PCDE001-NYC (Windows 11 Enterprise), PCDE002-NYC (Windows 10 Enterprise),
    //                   PCDE005-NYC (Windows 11 Enterprise), PCDE008-NYC (Windows Server),
    //                   PCDE010-SYD (Windows 11 Enterprise)
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?SearchQuery=NYC Enterprise')
      .expect(200);

    // Assert: Returns endpoints matching ANY keyword (NYC location OR Enterprise OS)
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.length).toBeLessThanOrEqual(10);

    // All returned endpoints should match at least one keyword
    response.body.data.forEach((endpoint: { displayName: string; operatingSystem: string }) => {
      const matchesNYC = endpoint.displayName.includes('NYC');
      const matchesEnterprise = endpoint.operatingSystem.includes('Enterprise');
      expect(matchesNYC || matchesEnterprise).toBe(true);
    });

    // Verify specific expected matches are present
    const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);
    expect(displayNames).toContain('PCDE001-NYC'); // Has NYC
    expect(displayNames).toContain('PCDE002-NYC'); // Has NYC
    expect(displayNames).toContain('PCDE005-NYC'); // Has NYC
    expect(displayNames).toContain('PCDE008-NYC'); // Has NYC
    expect(displayNames).toContain('PCDE010-SYD'); // Has Enterprise (but not NYC)

    // Total count should reflect filtered results
    expect(response.body.totalItems).toBe(response.body.data.length);
  });

  it('should sort endpoints by multiple fields (DisplayName asc, LastSeen desc)', async () => {
    // Act: Request with multi-field OrderBy (primary: DisplayName asc, secondary: LastSeen desc)
    // Note: bConnect V2.0 API uses comma-separated fields in OrderBy parameter
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName asc,LastSeen desc')
      .expect(200);

    // Assert: Data is sorted by DisplayName first (ascending)
    const endpoints = response.body.data;
    expect(endpoints).toBeDefined();
    expect(endpoints.length).toBe(10);

    // Primary sort: DisplayName ascending
    for (let i = 0; i < endpoints.length - 1; i++) {
      const currentName = endpoints[i].displayName;
      const nextName = endpoints[i + 1].displayName;
      const comparison = currentName.localeCompare(nextName);

      // DisplayName should be in ascending order (current <= next)
      expect(comparison).toBeLessThanOrEqual(0);

      // Secondary sort: If DisplayNames are equal, LastSeen should be descending
      if (comparison === 0) {
        const currentLastSeen = new Date(endpoints[i].lastSeen).getTime();
        const nextLastSeen = new Date(endpoints[i + 1].lastSeen).getTime();

        // LastSeen should be in descending order (current >= next)
        expect(currentLastSeen).toBeGreaterThanOrEqual(nextLastSeen);
      }
    }

    // Verify that first endpoint has earliest DisplayName alphabetically
    const sortedNames = endpoints.map((e: { displayName: string }) => e.displayName).sort();
    expect(endpoints[0].displayName).toBe(sortedNames[0]);
  });

  it('should filter endpoints by location using SearchQuery', async () => {
    // Act: Search for NYC endpoints
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?SearchQuery=NYC')
      .expect(200);

    // Assert: Returns only NYC endpoints
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.length).toBeLessThan(10);

    response.body.data.forEach((endpoint: { displayName: string }) => {
      expect(endpoint.displayName).toContain('NYC');
    });
  });

  it('should sort endpoints by DisplayName', async () => {
    // Act: Request with OrderBy=DisplayName asc
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints?OrderBy=DisplayName asc')
      .expect(200);

    // Assert: Endpoints are sorted alphabetically
    const displayNames = response.body.data.map((e: { displayName: string }) => e.displayName);

    for (let i = 0; i < displayNames.length - 1; i++) {
      expect(displayNames[i].localeCompare(displayNames[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  it('should have consistent deterministic data across multiple requests', async () => {
    // Act: Make two GET requests
    const response1 = await request(app).get('/v2.0/WindowsEndpoints');
    const response2 = await request(app).get('/v2.0/WindowsEndpoints');

    // Assert: Data is identical (deterministic fixture)
    expect(response1.body).toEqual(response2.body);
    expect(response1.body.data[0].id).toBe(response2.body.data[0].id);
    expect(response1.body.data[9].id).toBe(response2.body.data[9].id);
  });
});

describe('POST /v2.0/WindowsEndpoints (minimal-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    // Arrange: Create app with minimal-readwrite profile
    app = createApp(ProfileMode.MINIMAL_READWRITE);
  });

  it('should create new endpoint with HTTP 201 and auto-generated GUID', async () => {
    // Arrange: Valid WindowsEndpoint data (without GUID)
    const newEndpoint = {
      displayName: 'TEST-ENDPOINT-001',
      operatingSystem: 'Windows 11 Pro',
      primaryUser: 'testuser@example.com'
    };

    // Act: Create new endpoint via POST
    const response = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send(newEndpoint)
      .expect('Content-Type', /json/)
      .expect(201);

    // Assert: Response contains created endpoint with auto-generated GUID
    expect(response.body).toBeDefined();
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('guid');
    expect(response.body.guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(response.body.displayName).toBe('TEST-ENDPOINT-001');
    expect(response.body.operatingSystem).toBe('Windows 11 Pro');
    expect(response.body.primaryUser).toBe('testuser@example.com');
  });

  it('should persist created endpoint (GET returns newly created endpoint)', async () => {
    // Arrange: Create new endpoint first
    const newEndpoint = {
      displayName: 'TEST-ENDPOINT-002',
      operatingSystem: 'Windows 10 Pro',
      primaryUser: 'user2@example.com'
    };

    const postResponse = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send(newEndpoint)
      .expect(201);

    const createdId = postResponse.body.id;

    // Act: Retrieve the newly created endpoint via GET
    const getResponse = await request(app)
      .get(`/v2.0/WindowsEndpoints/${createdId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: GET returns the same endpoint data
    expect(getResponse.body).toBeDefined();
    expect(getResponse.body.id).toBe(createdId);
    expect(getResponse.body.displayName).toBe('TEST-ENDPOINT-002');
    expect(getResponse.body.operatingSystem).toBe('Windows 10 Pro');
    expect(getResponse.body.primaryUser).toBe('user2@example.com');
  });

  it('should validate required fields (return HTTP 400 for missing displayName)', async () => {
    // Arrange: Invalid endpoint data (missing displayName)
    const invalidEndpoint = {
      operatingSystem: 'Windows 11 Pro',
      primaryUser: 'user@example.com'
    };

    // Act: Attempt to create invalid endpoint
    const response = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send(invalidEndpoint)
      .expect('Content-Type', /json/)
      .expect(400);

    // Assert: Validation error returned
    expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
    expect(response.headers['x-bconnect-mock-reason']).toMatch(/displayName|required/i);
  });
});

describe('PUT /v2.0/WindowsEndpoints/:id (minimal-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    // Arrange: Create app with minimal-readwrite profile
    app = createApp(ProfileMode.MINIMAL_READWRITE);
  });

  it('should update existing endpoint with HTTP 200', async () => {
    // Arrange: Create endpoint first
    const newEndpoint = {
      displayName: 'TEST-ENDPOINT-PUT-001',
      operatingSystem: 'Windows 10 Pro',
      primaryUser: 'original@example.com'
    };

    const postResponse = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send(newEndpoint)
      .expect(201);

    const createdId = postResponse.body.id;

    // Act: Update the endpoint via PUT
    const updateData = {
      displayName: 'UPDATED-ENDPOINT-001',
      operatingSystem: 'Windows 11 Enterprise',
      primaryUser: 'updated@example.com'
    };

    const putResponse = await request(app)
      .put(`/v2.0/WindowsEndpoints/${createdId}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: Response contains updated endpoint
    expect(putResponse.body).toBeDefined();
    expect(putResponse.body.id).toBe(createdId);
    expect(putResponse.body.displayName).toBe('UPDATED-ENDPOINT-001');
    expect(putResponse.body.operatingSystem).toBe('Windows 11 Enterprise');
    expect(putResponse.body.primaryUser).toBe('updated@example.com');
  });

  it('should persist updated endpoint (GET returns updated data)', async () => {
    // Arrange: Create and update endpoint
    const postResponse = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: 'TEST-002', operatingSystem: 'Windows 10', primaryUser: 'user@example.com' })
      .expect(201);

    const createdId = postResponse.body.id;

    await request(app)
      .put(`/v2.0/WindowsEndpoints/${createdId}`)
      .send({ displayName: 'UPDATED-002', operatingSystem: 'Windows 11', primaryUser: 'new@example.com' })
      .expect(200);

    // Act: Retrieve updated endpoint via GET
    const getResponse = await request(app)
      .get(`/v2.0/WindowsEndpoints/${createdId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: GET returns updated data
    expect(getResponse.body.displayName).toBe('UPDATED-002');
    expect(getResponse.body.operatingSystem).toBe('Windows 11');
    expect(getResponse.body.primaryUser).toBe('new@example.com');
  });

  it('should return HTTP 404 for non-existent endpoint', async () => {
    // Arrange: Non-existent GUID
    const fakeId = '00000000-0000-0000-0000-000000000999';

    // Act: Attempt to update non-existent endpoint
    const response = await request(app)
      .put(`/v2.0/WindowsEndpoints/${fakeId}`)
      .send({ displayName: 'SHOULD-FAIL' })
      .expect('Content-Type', /json/)
      .expect(404);

    // Assert: Error response
    expect(response.headers).toHaveProperty('x-bconnect-mock-reason');
    expect(response.headers['x-bconnect-mock-reason']).toMatch(/not found/i);
  });
});
