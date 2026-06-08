/**
 * Action routes — fire-and-forget POST endpoints (P13.5.1–P13.5.4).
 *
 * These endpoints trigger operations on the BMS server and return
 * a simple 200/204 response without changing mock state.
 */

import type { Express } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { registerActionRoute } from './factories/actionRoute';

export function registerActionRoutes(app: Express, profile: IProfile): void {

  // P13.5.1 — Enrollment actions
  for (const ep of ['AndroidEndpoints', 'IosEndpoints', 'MacEndpoints', 'WindowsEndpoints']) {
    const fixture = ep.charAt(0).toLowerCase() + ep.slice(1) as
      'androidEndpoints' | 'iosEndpoints' | 'macEndpoints' | 'windowsEndpoints';
    registerActionRoute(app, profile, {
      path: `/v2.0/${ep}/:id/StartEnrollment`,
      status: 200,
      responseBody: { message: 'Enrollment started', status: 'pending' },
      parentFixture: fixture,
      parentEntityName: ep.replace('Endpoints', ' endpoint'),
    });
  }

  // P13.5.2 — Trigger installation via Intune (Windows only)
  registerActionRoute(app, profile, {
    path: '/v2.0/WindowsEndpoints/:id/TriggerInstallationViaIntune',
    status: 204,
    parentFixture: 'windowsEndpoints',
    parentEntityName: 'Windows endpoint',
  });

  // P13.5.3 — AssignJobDefinition for group types
  for (const group of ['LogicalGroups', 'StaticGroups', 'DynamicGroups', 'UniversalDynamicGroups']) {
    const fixture = group.charAt(0).toLowerCase() + group.slice(1) as
      'logicalGroups' | 'staticGroups' | 'dynamicGroups' | 'universalDynamicGroups';
    registerActionRoute(app, profile, {
      path: `/v2.0/${group}/:id/AssignJobDefinition`,
      status: 200,
      responseBody: { message: 'Job definition assigned successfully' },
      parentFixture: fixture,
      parentEntityName: group.slice(0, -1), // remove trailing 's'
    });
  }

  // P13.5.4 — Server actions
  registerActionRoute(app, profile, {
    path: '/v2.0/Restart',
    status: 204,
  });
  registerActionRoute(app, profile, {
    path: '/v2.0/CancelScheduledRestart',
    status: 204,
  });
  registerActionRoute(app, profile, {
    path: '/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id/TriggerUpdateOnClient',
    status: 204,
    parentFixture: 'windowsEndpoints',
    parentEntityName: 'Windows endpoint',
  });
}
