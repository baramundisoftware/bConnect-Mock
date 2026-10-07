/**
 * Groups routes — LogicalGroups, StaticGroups, DynamicGroups, UnmanagedEndpoints, UniversalDynamicGroups.
 * Extracted from app.ts (P13.0.8). Sub-resource routes added in P13.2.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { currentRecords } from './factories/currentRecords';
import type { StateManager } from '../state/StateManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { validateWriteBody, validateGenericUpdate } from '../middleware/validateBody';
// Spec LogicalGroupForCreation (25R2 + 26R1) requires `name`; there is no `displayName`.
const validateLogicalGroupCreate = validateWriteBody(['name']);
const LOGICAL_GROUP_SEARCH_FIELDS = ['name', 'comment', 'displayName', 'description'];
import { resolveEntityData, applyMultiKeywordSearch, applyMultiFieldSort, parsePage, GUID_REGEX, parsePageSize, withReleaseEndpointType } from './utils';
import { registerReadonlyList } from './factories/readonlyList';
import { registerGetById } from './factories/getById';
import { registerSubResourceList } from './factories/subResourceList';
import { withTreeParent } from './factories/treeParent';

export function registerGroupRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/LogicalGroups
  app.get('/v2.0/LogicalGroups', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const page = parsePage(req.query.Page);
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        let data = sm.logicalGroups.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, LOGICAL_GROUP_SEARCH_FIELDS); }
        if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
        const pageSize = parsePageSize(req.query.PageSize);
        res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
        return;
      }
      const pageSize = parsePageSize(req.query.PageSize);
      const resolved = resolveEntityData(profile, 'logicalGroups', { searchQuery, orderBy, page, pageSize, searchFields: LOGICAL_GROUP_SEARCH_FIELDS }, app.locals.stateManager);
      if (!resolved) { res.status(200).json({ data: [], pageSize: 0, page: 0, totalItems: 0 }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/LogicalGroups/:id
  app.get('/v2.0/LogicalGroups/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.logicalGroups.getById(id);
        if (!item) { res.status(404).json({ error: 'Logical group not found' }); return; }
        res.status(200).json(item); return;
      }
      const data = profile.getFixture('logicalGroups') as Record<string, unknown>[];
      const item = data.find((g) => g['id'] === id || g['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Logical group not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST/PATCH/DELETE LogicalGroups write routes
  app.post('/v2.0/LogicalGroups', validateLogicalGroupCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const body = req.body as Record<string, unknown>;
    // Fixture groups carry both `name` and `displayName`; mirror so created groups read back the same way.
    res.status(201).json(sm.logicalGroups.create(withTreeParent(app, profile, 'logicalGroups', { ...body, displayName: body['displayName'] ?? body['name'] }, 'create')));
  });

  app.patch('/v2.0/LogicalGroups/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.logicalGroups.patch(id, withTreeParent(app, profile, 'logicalGroups', req.body as Record<string, unknown>, 'update'));
    if (!updated) { res.status(404).json({ error: 'Logical group not found' }); return; }
    res.status(200).json(updated);
  });

  app.delete('/v2.0/LogicalGroups/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.logicalGroups.delete(id)) { res.status(404).json({ error: 'Logical group not found' }); return; }
    res.status(204).send();
  });

  // DELETE /v2.0/UnmanagedEndpoints/:id (26R1 only) — P13.4.14
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    app.delete('/v2.0/UnmanagedEndpoints/:id', (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
        const sm = app.locals.stateManager as StateManager | undefined;
        if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
        if (!sm.addStore('unmanagedEndpoints', profile.getFixture('unmanagedEndpoints') as { id: string }[]).delete(id)) {
          res.status(404).json({ error: 'Unmanaged endpoint not found' }); return;
        }
        res.status(204).send();
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });
  }

  // Sub-resource routes: LogicalGroups/{id}/ChildEndpoints (P13.2.5)
  const endpointSubResources: Array<{ childPath: string; childFixture: string; childEntityName: string; searchFields: string[] }> = [
    { childPath: 'WindowsEndpoints',  childFixture: 'windowsEndpoints',  childEntityName: 'Windows endpoint',  searchFields: ['displayName', 'hostName', 'primaryIP', 'operatingSystem'] },
    { childPath: 'AndroidEndpoints',  childFixture: 'androidEndpoints',  childEntityName: 'Android endpoint',  searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'LinuxEndpoints',    childFixture: 'linuxEndpoints',    childEntityName: 'Linux endpoint',    searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'MacEndpoints',      childFixture: 'macEndpoints',      childEntityName: 'Mac endpoint',      searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'IosEndpoints',      childFixture: 'iosEndpoints',      childEntityName: 'iOS endpoint',      searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'NetworkEndpoints',  childFixture: 'networkEndpoints',  childEntityName: 'Network endpoint',  searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'LogicalGroups',     childFixture: 'logicalGroups',     childEntityName: 'Logical group',     searchFields: LOGICAL_GROUP_SEARCH_FIELDS },
  ];

  for (const sub of endpointSubResources) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/LogicalGroups',
      childPath: sub.childPath,
      parentFixture: 'logicalGroups',
      childFixture: sub.childFixture,
      foreignKey: sub.childPath === 'LogicalGroups' ? 'parentId' : 'logicalGroupId',
      searchFields: sub.searchFields,
      parentEntityName: 'Logical group',
      childEntityName: sub.childEntityName,
    });
  }

  // GET /v2.0/LogicalGroups/:parentId/Endpoints — aggregates ALL endpoint types
  // (the real bConnect API returns all endpoint types for a logical group)
  app.get('/v2.0/LogicalGroups/:parentId/Endpoints', (req: Request, res: Response) => {
    try {
      const parentId = req.params['parentId'] as string;
      if (!parentId || !GUID_REGEX.test(parentId)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const parentData = profile.getFixture('logicalGroups') as Record<string, unknown>[];
      if (!parentData.some((p) => p['id'] === parentId)) {
        res.status(404).json({ error: 'Logical group not found' });
        return;
      }
      const allFixtures = ['windowsEndpoints', 'androidEndpoints', 'linuxEndpoints', 'macEndpoints', 'iosEndpoints', 'networkEndpoints', 'industrialEndpoints'];
      let combined: Record<string, unknown>[] = [];
      for (const fixture of allFixtures) {
        const data = profile.getFixture(fixture) as Record<string, unknown>[];
        if (Array.isArray(data)) {
          combined = combined.concat(data.filter((ep) => ep['logicalGroupId'] === parentId));
        }
      }
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      if (searchQuery?.trim()) { combined = applyMultiKeywordSearch(combined, searchQuery, ['displayName', 'hostName', 'primaryIP', 'operatingSystem']); }
      if (orderBy?.trim()) { combined = applyMultiFieldSort(combined, orderBy); }
      const totalItems = combined.length;
      const eff = pageSize;
      const data = (eff > 0 ? combined.slice(page * eff, page * eff + eff) : combined).map((ep) => withReleaseEndpointType(ep, profile.bmsVersion));
      res.status(200).json({ data, pageSize: eff, page, totalItems });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // StaticGroups routes (P13.2.6)
  registerReadonlyList(app, profile, {
    path: '/v2.0/StaticGroups',
    entityType: 'staticGroups',
    searchFields: ['displayName', 'description'],
    entityName: 'StaticGroups',
  });
  registerGetById(app, profile, {
    basePath: '/v2.0/StaticGroups',
    entityType: 'staticGroups',
    entityName: 'Static group',
  });

  // StaticGroups write routes
  app.post('/v2.0/StaticGroups', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('staticGroups', profile.getFixture('staticGroups') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  app.patch('/v2.0/StaticGroups/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    const updated = sm.addStore('staticGroups', profile.getFixture('staticGroups') as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Static group not found' }); return; }
    res.status(200).json(updated);
  });

  app.delete('/v2.0/StaticGroups/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!sm.addStore('staticGroups', profile.getFixture('staticGroups') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Static group not found' }); return;
    }
    res.status(204).send();
  });

  // DynamicGroups routes (P13.2.7)
  registerReadonlyList(app, profile, {
    path: '/v2.0/DynamicGroups',
    entityType: 'dynamicGroups',
    searchFields: ['displayName', 'description'],
    entityName: 'DynamicGroups',
  });
  registerGetById(app, profile, {
    basePath: '/v2.0/DynamicGroups',
    entityType: 'dynamicGroups',
    entityName: 'Dynamic group',
  });

  // GET /v2.0/UnmanagedEndpoints (26R1 only)
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    app.get('/v2.0/UnmanagedEndpoints', (req: Request, res: Response) => {
      try {
        const searchQuery = req.query.SearchQuery as string | undefined;
        const orderBy = req.query.OrderBy as string | undefined;
        const page = parsePage(req.query.Page);
        const pageSize = parsePageSize(req.query.PageSize);
        const resolved = resolveEntityData(profile, 'unmanagedEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'primaryIP', 'detectedOS'] }, app.locals.stateManager);
        if (!resolved) { res.status(200).json({ data: [], pageSize: 0, page: 0, totalItems: 0 }); return; }
        const eff = pageSize;
        res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });

    // GET /v2.0/UnmanagedEndpoints/:id (26R1 only)
    app.get('/v2.0/UnmanagedEndpoints/:id', (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
        const item = (currentRecords(app, profile, 'unmanagedEndpoints') ?? []).find((e) => e['id'] === id || e['guid'] === id);
        if (!item) { res.status(404).json({ error: 'Unmanaged endpoint not found' }); return; }
        res.status(200).json(item);
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });
  }

  // P13.9.3-5 — IndustrialEndpoints sub-resources moved to subResources.ts (P15.8)
  // for proper GUID validation and FK-based filtering via registerSubResourceList factory.

  // P13.3.6 — LogicalGroups/{id}/MaintenanceWindow (GET/POST/PATCH/DELETE + PUT for 25R2)
  // P13.9.2 — PUT is the 25R2 verb; PATCH is 26R1 — both registered to same handler
  const groupMaintenanceWindows: Map<string, Record<string, unknown>> = new Map();

  const defaultGroupMW = (groupId: string): Record<string, unknown> => ({
    id: `mw-group-${groupId}`,
    logicalGroupId: groupId,
    maintenanceWindowDefinitionType: 'Everyday',
    startTime: '22:00:00',
    durationInMinutes: 120,
  });

  app.get('/v2.0/LogicalGroups/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const mw = groupMaintenanceWindows.get(id) ?? defaultGroupMW(id);
      res.status(200).json(mw);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/v2.0/LogicalGroups/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const mw = { ...defaultGroupMW(id), ...(req.body as object) };
      groupMaintenanceWindows.set(id, mw);
      res.status(201).json(mw);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  const groupMWUpdateHandler = (req: Request, res: Response): void => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const existing = groupMaintenanceWindows.get(id) ?? defaultGroupMW(id);
      const updated = { ...existing, ...(req.body as object) };
      groupMaintenanceWindows.set(id, updated);
      res.status(200).json(updated);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  };
  // REQ-20.4.2: both PATCH (26R1 preferred) and PUT (25R2 alias) must be registered in all versions
  app.patch('/v2.0/LogicalGroups/:id/MaintenanceWindow', groupMWUpdateHandler);
  app.put('/v2.0/LogicalGroups/:id/MaintenanceWindow', groupMWUpdateHandler);

  app.delete('/v2.0/LogicalGroups/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      groupMaintenanceWindows.delete(id);
      res.status(204).send();
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}

export function registerUniversalDynamicGroupRoutes(app: Express, profile: IProfile): void {

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
  // GET /v2.0/UniversalDynamicGroups
  app.get('/v2.0/UniversalDynamicGroups', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'universalDynamicGroups', { searchQuery, orderBy, page, pageSize, searchFields: ['name', 'folderName', 'comment'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'UniversalDynamicGroups not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/UniversalDynamicGroups/:id
  app.get('/v2.0/UniversalDynamicGroups/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('universalDynamicGroups') as Record<string, unknown>[];
      const item = data.find((g) => g['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'UniversalDynamicGroup not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/UniversalDynamicGroupsFolder
  app.get('/v2.0/UniversalDynamicGroupsFolder', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('folders') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'parent']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/UniversalDynamicGroupsFolder/:id
  app.get('/v2.0/UniversalDynamicGroupsFolder/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('folders') as Record<string, unknown>[];
      const item = data.find((f) => f['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Folder not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  } // end 26R1-only block

  // Sub-resource routes: UniversalDynamicGroups/{id}/... (P13.2.8)
  const udgSubResources: Array<{ childPath: string; childFixture: string; searchFields: string[] }> = [
    { childPath: 'WindowsEndpoints', childFixture: 'windowsEndpoints', searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'AndroidEndpoints', childFixture: 'androidEndpoints', searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'LinuxEndpoints',   childFixture: 'linuxEndpoints',   searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'MacEndpoints',     childFixture: 'macEndpoints',     searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'IosEndpoints',     childFixture: 'iosEndpoints',     searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'NetworkEndpoints', childFixture: 'networkEndpoints', searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'Endpoints',        childFixture: 'windowsEndpoints', searchFields: ['displayName', 'hostName', 'primaryIP'] },
  ];

  for (const sub of udgSubResources) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/UniversalDynamicGroups',
      childPath: sub.childPath,
      parentFixture: 'universalDynamicGroups',
      childFixture: sub.childFixture,
      foreignKey: 'universalDynamicGroupId',
      searchFields: sub.searchFields,
      parentEntityName: 'UniversalDynamicGroup',
    });
  }

  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    // UniversalDynamicGroupsFolder/{id}/Folders sub-resource
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/UniversalDynamicGroupsFolder',
      childPath: 'Folders',
      parentFixture: 'folders',
      childFixture: 'folders',
      foreignKey: 'parentId',
      searchFields: ['name'],
      parentEntityName: 'Folder',
    });
  }
}
