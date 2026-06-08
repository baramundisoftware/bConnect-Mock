/**
 * Scoped sub-resource routes (P13.2.10).
 *
 * Registers all remaining sub-resource GET endpoints using registerSubResourceList factory.
 * Routes are grouped by parent collection.
 */

import type { Express } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { registerSubResourceList } from './factories/subResourceList';

export function registerSubResourceRoutes(app: Express, profile: IProfile): void {

  // ─── Endpoints sub-resources ────────────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Endpoints',
    childPath: 'JobInstances',
    parentFixture: 'windowsEndpoints',
    childFixture: 'jobInstances',
    foreignKey: 'endpointId',
    searchFields: ['jobDefinitionName', 'state'],
    parentEntityName: 'Endpoint',
    childEntityName: 'Job instance',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Endpoints',
    childPath: 'KioskReleases',
    parentFixture: 'windowsEndpoints',
    childFixture: 'kioskReleases',
    foreignKey: 'endpointId',
    searchFields: ['name', 'version', 'status'],
    parentEntityName: 'Endpoint',
    childEntityName: 'Kiosk release',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Endpoints',
    childPath: 'VariableInstances',
    parentFixture: 'windowsEndpoints',
    childFixture: 'variableInstances',
    foreignKey: 'endpointId',
    searchFields: ['value'],
    parentEntityName: 'Endpoint',
    childEntityName: 'Variable instance',
  });

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/Endpoints',
      childPath: 'DetectedVulnerabilities',
      parentFixture: 'windowsEndpoints',
      childFixture: 'detectedVulnerabilities',
      foreignKey: 'endpointId',
      searchFields: ['cveId'],
      parentEntityName: 'Endpoint',
      childEntityName: 'Detected vulnerability',
    });

    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/Endpoints',
      childPath: 'DetectedRuleViolations',
      parentFixture: 'windowsEndpoints',
      childFixture: 'ruleViolations',
      foreignKey: 'endpointId',
      searchFields: ['ruleName'],
      parentEntityName: 'Endpoint',
      childEntityName: 'Rule violation',
    });
  }

  // ─── WindowsEndpoints sub-resources ─────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/WindowsEndpoints',
    childPath: 'InstalledWindowsSoftware',
    parentFixture: 'windowsEndpoints',
    childFixture: 'installedWindowsSoftware',
    foreignKey: 'endpointId',
    searchFields: ['displayName', 'publisher', 'version'],
    parentEntityName: 'Windows endpoint',
    childEntityName: 'Installed software',
  });

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/WindowsEndpoints',
      childPath: 'DetectedVulnerabilities',
      parentFixture: 'windowsEndpoints',
      childFixture: 'detectedVulnerabilities',
      foreignKey: 'endpointId',
      searchFields: ['cveId'],
      parentEntityName: 'Windows endpoint',
      childEntityName: 'Detected vulnerability',
    });
  }

  // ─── JobDefinitions sub-resources ───────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/JobDefinitions',
    childPath: 'JobInstances',
    parentFixture: 'jobs',
    childFixture: 'jobInstances',
    foreignKey: 'jobDefinitionId',
    searchFields: ['state', 'endpointName'],
    parentEntityName: 'Job definition',
    childEntityName: 'Job instance',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/JobDefinitions',
    childPath: 'KioskReleases',
    parentFixture: 'jobs',
    childFixture: 'kioskReleases',
    foreignKey: 'jobDefinitionId',
    searchFields: ['name', 'version', 'status'],
    parentEntityName: 'Job definition',
    childEntityName: 'Kiosk release',
  });

  // ─── ADObjects sub-resources ─────────────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADObjects',
    childPath: 'KioskReleases',
    parentFixture: 'adObjects',
    childFixture: 'kioskReleases',
    foreignKey: 'adObjectId',
    searchFields: ['name', 'version'],
    parentEntityName: 'AD object',
    childEntityName: 'Kiosk release',
  });

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/ADObjects',
      childPath: 'Assets',
      parentFixture: 'adObjects',
      childFixture: 'assets',
      foreignKey: 'adObjectId',
      searchFields: ['assetTag', 'type'],
      parentEntityName: 'AD object',
      childEntityName: 'Asset',
    });
  }

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADObjects',
    childPath: 'VariableInstances',
    parentFixture: 'adObjects',
    childFixture: 'variableInstances',
    foreignKey: 'adObjectId',
    searchFields: ['value'],
    parentEntityName: 'AD object',
    childEntityName: 'Variable instance',
  });

  // ADObjects/{id}/ADGroupMemberships — returns adGroups that have this adObject as a member
  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADObjects',
    childPath: 'ADGroupMemberships',
    parentFixture: 'adObjects',
    childFixture: 'adGroups',
    foreignKey: 'memberAdObjectIds',
    searchFields: ['name', 'distinguishedName'],
    parentEntityName: 'AD object',
    childEntityName: 'AD group membership',
  });

  // ─── ADGroups sub-resources ──────────────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADGroups',
    childPath: 'ADGroups',
    parentFixture: 'adGroups',
    childFixture: 'adGroups',
    foreignKey: 'parentAdGroupId',
    searchFields: ['name', 'distinguishedName'],
    parentEntityName: 'AD group',
    childEntityName: 'AD group',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADGroups',
    childPath: 'ADObjects',
    parentFixture: 'adGroups',
    childFixture: 'adObjects',
    foreignKey: 'adGroupId',
    searchFields: ['name', 'distinguishedName', 'samAccountName'],
    parentEntityName: 'AD group',
    childEntityName: 'AD object',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/ADGroups',
    childPath: 'ADUsers',
    parentFixture: 'adGroups',
    childFixture: 'adUsers',
    foreignKey: 'adGroupId',
    searchFields: ['displayName', 'samAccountName'],
    parentEntityName: 'AD group',
    childEntityName: 'AD user',
  });

  // ─── LogicalGroups extended sub-resources ────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'Assets',
    parentFixture: 'logicalGroups',
    childFixture: 'assets',
    foreignKey: 'logicalGroupId',
    searchFields: ['assetTag', 'type', 'location'],
    parentEntityName: 'Logical group',
    childEntityName: 'Asset',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'JobInstances',
    parentFixture: 'logicalGroups',
    childFixture: 'jobInstances',
    foreignKey: 'logicalGroupId',
    searchFields: ['jobDefinitionName', 'state'],
    parentEntityName: 'Logical group',
    childEntityName: 'Job instance',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'KioskReleases',
    parentFixture: 'logicalGroups',
    childFixture: 'kioskReleases',
    foreignKey: 'logicalGroupId',
    searchFields: ['name', 'version'],
    parentEntityName: 'Logical group',
    childEntityName: 'Kiosk release',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'InstalledWindowsSoftware',
    parentFixture: 'logicalGroups',
    childFixture: 'installedWindowsSoftware',
    foreignKey: 'logicalGroupId',
    searchFields: ['displayName', 'publisher'],
    parentEntityName: 'Logical group',
    childEntityName: 'Installed software',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'VariableInstances',
    parentFixture: 'logicalGroups',
    childFixture: 'variableInstances',
    foreignKey: 'logicalGroupId',
    searchFields: ['value'],
    parentEntityName: 'Logical group',
    childEntityName: 'Variable instance',
  });

  // ─── OrgUnits sub-resources ──────────────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/OrgUnits',
    childPath: 'ADGroups',
    parentFixture: 'orgUnits',
    childFixture: 'adGroups',
    foreignKey: 'orgUnitId',
    searchFields: ['name', 'distinguishedName'],
    parentEntityName: 'Org unit',
    childEntityName: 'AD group',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/OrgUnits',
    childPath: 'ADObjects',
    parentFixture: 'orgUnits',
    childFixture: 'adObjects',
    foreignKey: 'orgUnitId',
    searchFields: ['name', 'distinguishedName'],
    parentEntityName: 'Org unit',
    childEntityName: 'AD object',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/OrgUnits',
    childPath: 'ADUsers',
    parentFixture: 'orgUnits',
    childFixture: 'adUsers',
    foreignKey: 'orgUnitId',
    searchFields: ['displayName', 'samAccountName'],
    parentEntityName: 'Org unit',
    childEntityName: 'AD user',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/OrgUnits',
    childPath: 'OrgUnits',
    parentFixture: 'orgUnits',
    childFixture: 'orgUnits',
    foreignKey: 'parentId',
    searchFields: ['name', 'distinguishedName'],
    parentEntityName: 'Org unit',
    childEntityName: 'Org unit',
  });

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/OrgUnits',
      childPath: 'Assets',
      parentFixture: 'orgUnits',
      childFixture: 'assets',
      foreignKey: 'orgUnitId',
      searchFields: ['assetTag', 'type'],
      parentEntityName: 'Org unit',
      childEntityName: 'Asset',
    });
  }

  // ─── StaticGroups / DynamicGroups sub-resources ──────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/StaticGroups',
    childPath: 'JobInstances',
    parentFixture: 'staticGroups',
    childFixture: 'jobInstances',
    foreignKey: 'staticGroupId',
    searchFields: ['jobDefinitionName', 'state'],
    parentEntityName: 'Static group',
    childEntityName: 'Job instance',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/DynamicGroups',
    childPath: 'JobInstances',
    parentFixture: 'dynamicGroups',
    childFixture: 'jobInstances',
    foreignKey: 'dynamicGroupId',
    searchFields: ['jobDefinitionName', 'state'],
    parentEntityName: 'Dynamic group',
    childEntityName: 'Job instance',
  });

  // ─── Folders sub-resources (Jobs context) ────────────────────────────────────
  // Note: Folders/{id}/Folders already registered in misc.ts (P13.4.6)

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Folders',
    childPath: 'JobDefinitions',
    parentFixture: 'jobFolders',
    childFixture: 'jobs',
    foreignKey: 'folderId',
    searchFields: ['name', 'type', 'status'],
    parentEntityName: 'Folder',
    childEntityName: 'Job definition',
  });

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/Folders',
      childPath: 'UniversalDynamicGroups',
      parentFixture: 'folders',
      childFixture: 'universalDynamicGroups',
      foreignKey: 'folderId',
      searchFields: ['name'],
      parentEntityName: 'Folder',
      childEntityName: 'Universal dynamic group',
    });
  }

  // ─── UniversalDynamicGroups sub-resources (all versions) ─────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/UniversalDynamicGroups',
    childPath: 'JobInstances',
    parentFixture: 'universalDynamicGroups',
    childFixture: 'jobInstances',
    foreignKey: 'universalDynamicGroupId',
    searchFields: ['jobDefinitionName', 'state'],
    parentEntityName: 'Universal dynamic group',
    childEntityName: 'Job instance',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/UniversalDynamicGroups',
    childPath: 'InstalledWindowsSoftware',
    parentFixture: 'universalDynamicGroups',
    childFixture: 'installedWindowsSoftware',
    foreignKey: 'universalDynamicGroupId',
    searchFields: ['displayName', 'publisher'],
    parentEntityName: 'Universal dynamic group',
    childEntityName: 'Installed software',
  });

  // ─── MicrosoftDefender sub-resources ─────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/MicrosoftDefender/LogicalGroups',
    childPath: 'Threats',
    parentFixture: 'logicalGroups',
    childFixture: 'microsoftDefenderThreats',
    foreignKey: 'logicalGroupId',
    searchFields: ['name', 'severity', 'category'],
    parentEntityName: 'Logical group',
    childEntityName: 'Threat',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/MicrosoftDefender/WindowsEndpoints',
    childPath: 'Threats',
    parentFixture: 'windowsEndpoints',
    childFixture: 'microsoftDefenderThreats',
    foreignKey: 'windowsEndpointId',
    searchFields: ['name', 'severity', 'category'],
    parentEntityName: 'Windows endpoint',
    childEntityName: 'Threat',
  });

  // ─── Bundle/Folders sub-resources (26R1 only) ────────────────────────────────

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/Bundle/Folders',
      childPath: 'Folders',
      parentFixture: 'bundleFolders',
      childFixture: 'bundleFolders',
      foreignKey: 'parentId',
      searchFields: ['name'],
      parentEntityName: 'Bundle folder',
      childEntityName: 'Bundle folder',
    });
  }

  // ─── Bundles/{id}/BundleApplications ─────────────────────────────────────────

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/Bundles',
      childPath: 'BundleApplications',
      parentFixture: 'bundles',
      childFixture: 'bundleApplications',
      foreignKey: 'bundleId',
      searchFields: ['applicationName', 'applicationVendor'],
      parentEntityName: 'Bundle',
      childEntityName: 'Bundle application',
    });
  }

  // ─── StaticGroups/{id}/[typed endpoint] ──────────────────────────────────────

  for (const [childPath, childFixture, childEntityName] of [
    ['Endpoints',        'windowsEndpoints',  'Endpoint'],
    ['WindowsEndpoints', 'windowsEndpoints',  'Windows endpoint'],
    ['AndroidEndpoints', 'androidEndpoints',  'Android endpoint'],
    ['IosEndpoints',     'iosEndpoints',      'iOS endpoint'],
    ['LinuxEndpoints',   'linuxEndpoints',    'Linux endpoint'],
    ['MacEndpoints',     'macEndpoints',      'Mac endpoint'],
    ['NetworkEndpoints', 'networkEndpoints',  'Network endpoint'],
  ] as [string, string, string][]) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/StaticGroups',
      childPath,
      parentFixture: 'staticGroups',
      childFixture,
      foreignKey: 'staticGroupId',
      searchFields: ['displayName'],
      parentEntityName: 'Static group',
      childEntityName,
    });
  }

  // ─── DynamicGroups/{id}/[typed endpoint] ─────────────────────────────────────

  for (const [childPath, childFixture, childEntityName] of [
    ['Endpoints',        'windowsEndpoints', 'Endpoint'],
    ['WindowsEndpoints', 'windowsEndpoints', 'Windows endpoint'],
  ] as [string, string, string][]) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/DynamicGroups',
      childPath,
      parentFixture: 'dynamicGroups',
      childFixture,
      foreignKey: 'dynamicGroupId',
      searchFields: ['displayName'],
      parentEntityName: 'Dynamic group',
      childEntityName,
    });
  }

  // ─── WindowsEndpoint/{id}/Assets ─────────────────────────────────────────────
  // Note: spec uses singular "WindowsEndpoint" (not "WindowsEndpoints")

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/WindowsEndpoint',
    childPath: 'Assets',
    parentFixture: 'windowsEndpoints',
    childFixture: 'assets',
    foreignKey: 'endpointId',
    searchFields: ['name', 'serialNumber'],
    parentEntityName: 'Windows endpoint',
    childEntityName: 'Asset',
  });

  // ─── IndustrialEndpoints as sub-resources of group collections (all versions) ─

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/LogicalGroups',
    childPath: 'IndustrialEndpoints',
    parentFixture: 'logicalGroups',
    childFixture: 'industrialEndpoints',
    foreignKey: 'logicalGroupId',
    searchFields: ['displayName', 'deviceType', 'zone'],
    parentEntityName: 'Logical group',
    childEntityName: 'Industrial endpoint',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/StaticGroups',
    childPath: 'IndustrialEndpoints',
    parentFixture: 'staticGroups',
    childFixture: 'industrialEndpoints',
    foreignKey: 'staticGroupId',
    searchFields: ['displayName', 'deviceType', 'zone'],
    parentEntityName: 'Static group',
    childEntityName: 'Industrial endpoint',
  });

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/UniversalDynamicGroups',
    childPath: 'IndustrialEndpoints',
    parentFixture: 'universalDynamicGroups',
    childFixture: 'industrialEndpoints',
    foreignKey: 'universalDynamicGroupId',
    searchFields: ['displayName', 'deviceType', 'zone'],
    parentEntityName: 'Universal dynamic group',
    childEntityName: 'Industrial endpoint',
  });

  // ─── Folders/{id}/UniversalDynamicGroups (B5) ────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Folders',
    childPath: 'UniversalDynamicGroups',
    parentFixture: 'folders',
    childFixture: 'universalDynamicGroups',
    foreignKey: 'folderId',
    searchFields: ['name', 'comment'],
    parentEntityName: 'Folder',
    childEntityName: 'Universal dynamic group',
  });

  // ─── Applications/{id}/Variables (B6) ────────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/Applications',
    childPath: 'Variables',
    parentFixture: 'windowsApplications',
    childFixture: 'variableInstances',
    foreignKey: 'windowsApplicationId',
    searchFields: ['value'],
    parentEntityName: 'Application',
    childEntityName: 'Variable',
  });

  // ─── JobDefinitions/{id}/Variables (B7) ─────────────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/JobDefinitions',
    childPath: 'Variables',
    parentFixture: 'jobs',
    childFixture: 'variableInstances',
    foreignKey: 'windowsJobDefinitionId',
    searchFields: ['value'],
    parentEntityName: 'Job definition',
    childEntityName: 'Variable',
  });

  // ─── WindowsApplications/{id}/VariableInstances ───────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/WindowsApplications',
    childPath: 'VariableInstances',
    parentFixture: 'windowsApplications',
    childFixture: 'variableInstances',
    foreignKey: 'windowsApplicationId',
    searchFields: ['value'],
    parentEntityName: 'Windows application',
    childEntityName: 'Variable instance',
  });

  // ─── WindowsJobDefinitions/{id}/VariableInstances ─────────────────────────────

  registerSubResourceList(app, profile, {
    parentPath: '/v2.0/WindowsJobDefinitions',
    childPath: 'VariableInstances',
    parentFixture: 'windowsJobDefinitions',
    childFixture: 'variableInstances',
    foreignKey: 'windowsJobDefinitionId',
    searchFields: ['value'],
    parentEntityName: 'Windows job definition',
    childEntityName: 'Variable instance',
  });
}
