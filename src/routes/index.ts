/**
 * Route registration barrel — registers all domain routes on the Express app.
 *
 * Import `registerAllRoutes` in app.ts and call it after middleware setup.
 * This keeps app.ts slim (middleware + registerAllRoutes) and domain logic in modules.
 */

import type { Express } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { BmsVersion } from '../profiles/ProfileManager';

import { registerEndpointRoutes } from './endpoints';
import { registerJobRoutes } from './jobs';
import { registerAssetRoutes, registerAssetStockRoutes, registerVariableRoutes } from './assets';
import { registerSoftwareRoutes, registerSoftware26R1Routes } from './software';
import { registerComplianceRoutes } from './compliance';
import { registerActiveDirectoryRoutes } from './activeDirectory';
import { registerDefenseControlRoutes } from './defenseControl';
import { registerServerManagementRoutes, registerServerManagement26R1Routes } from './serverManagement';
import { registerGroupRoutes, registerUniversalDynamicGroupRoutes } from './groups';
import { registerMiscRoutes } from './misc';
import { registerActionRoutes } from './actions';
import { registerCatalogRoutes } from './catalog';
import { registerSubResourceRoutes } from './subResources';
import { registerUpdateManagementRoutes } from './updateManagement';

/**
 * Register all API routes on the Express application.
 *
 * Call this after all middleware has been configured and StateManager has been
 * set on app.locals.
 *
 * @param app - Express application
 * @param profile - Active IProfile
 */
export function registerAllRoutes(app: Express, profile: IProfile): void {
  // Update Management (all versions — separate base path /updatemanagement/v2.0)
  registerUpdateManagementRoutes(app, profile);

  // Endpoint collections (all versions)
  registerEndpointRoutes(app, profile);

  // Jobs (all versions)
  registerJobRoutes(app, profile);

  // Assets & Variables (all versions)
  registerAssetRoutes(app, profile);
  registerAssetStockRoutes(app, profile);
  registerVariableRoutes(app, profile);

  // Software & WindowsUpdates (all versions)
  registerSoftwareRoutes(app, profile);

  // ActiveDirectory (all versions)
  registerActiveDirectoryRoutes(app, profile);

  // DefenseControl/BitLocker (all versions)
  registerDefenseControlRoutes(app, profile);

  // ServerManagement/Microservices (all versions)
  registerServerManagementRoutes(app, profile);

  // Groups & UnmanagedEndpoints
  registerGroupRoutes(app, profile);

  // Misc: OSFolders, EntraIdData
  registerMiscRoutes(app, profile);

  // Catalog: KioskReleases, SecurityGroups, SecurityProfiles, AssetTypes
  registerCatalogRoutes(app, profile);

  // Action routes (fire-and-forget)
  registerActionRoutes(app, profile);

  // Scoped sub-resource routes (P13.2.10)
  registerSubResourceRoutes(app, profile);

  // UniversalDynamicGroups (all versions — sub-resource routes used by both 25R2 and 26R1)
  registerUniversalDynamicGroupRoutes(app, profile);

  // 26R1-only routes
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerComplianceRoutes(app, profile);
    registerSoftware26R1Routes(app, profile);
    registerServerManagement26R1Routes(app, profile);
  }
}

// Re-export factories for use by new route modules
export * from './factories/index';
export * from './utils';
