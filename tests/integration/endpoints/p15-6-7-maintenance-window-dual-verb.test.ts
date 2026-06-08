/**
 * P15.6 + P15.7 — PUT /v2.0/Endpoints/{id}/MaintenanceWindow (REQ-20.1.1)
 *                  PUT /v2.0/LogicalGroups/{id}/MaintenanceWindow (REQ-20.1.2)
 *
 * REQ-20.4.2: Both PUT and PATCH must be registered in all BMS versions.
 * The handler is identical; 25R2 added PUT, 26R1 switched preferred verb to PATCH,
 * but consumers may still use either verb.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

describe('MaintenanceWindow dual-verb (REQ-20.4.2)', () => {
  let app25rw: Express;
  let app26rw: Express;

  beforeAll(() => {
    app25rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    app26rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
  });

  // ─── Endpoints ───────────────────────────────────────────────────────────────

  describe('Endpoints/{id}/MaintenanceWindow', () => {
    const id = 'test-mw-dual-ep-001';

    it('PUT works in 25R2 (primary verb)', async () => {
      const res = await request(app25rw)
        .put(`/v2.0/Endpoints/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Weekly', startTime: '02:00' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Weekly');
    });

    it('PATCH works in 25R2 (alias verb — REQ-20.4.2)', async () => {
      const res = await request(app25rw)
        .patch(`/v2.0/Endpoints/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Daily' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Daily');
    });

    it('PATCH works in 26R1 (primary verb)', async () => {
      const res = await request(app26rw)
        .patch(`/v2.0/Endpoints/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Weekly', startTime: '03:00' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Weekly');
    });

    it('PUT works in 26R1 (alias verb — REQ-20.4.2)', async () => {
      const res = await request(app26rw)
        .put(`/v2.0/Endpoints/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Monthly' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Monthly');
    });
  });

  // ─── LogicalGroups ───────────────────────────────────────────────────────────

  describe('LogicalGroups/{id}/MaintenanceWindow', () => {
    const id = 'test-mw-dual-lg-001';

    it('PUT works in 25R2 (primary verb)', async () => {
      const res = await request(app25rw)
        .put(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Weekly', startTime: '02:00' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Weekly');
    });

    it('PATCH works in 25R2 (alias verb — REQ-20.4.2)', async () => {
      const res = await request(app25rw)
        .patch(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Daily' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Daily');
    });

    it('PATCH works in 26R1 (primary verb)', async () => {
      const res = await request(app26rw)
        .patch(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Weekly', startTime: '03:00' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Weekly');
    });

    it('PUT works in 26R1 (alias verb — REQ-20.4.2)', async () => {
      const res = await request(app26rw)
        .put(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`)
        .send({ maintenanceWindowDefinitionType: 'Monthly' })
        .expect(200);
      expect(res.body.maintenanceWindowDefinitionType).toBe('Monthly');
    });
  });
});
