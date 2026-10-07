/**
 * Catalog routes — KioskReleases, SecurityGroups, SecurityProfiles, AssetTypes.
 * P13.4.5, P13.4.7, P13.4.8, P13.4.9
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { GUID_REGEX, parsePage, applyMultiKeywordSearch, parsePageSize } from './utils';
import { registerGetById } from './factories/getById';
import { currentRecords } from './factories/currentRecords';
import { registerCrudRoutes } from './factories/crudRoutes';
import { validateGenericUpdate, validateWriteBody } from '../middleware/validateBody';

/** Kiosk release search fields (spec KioskRelease) */
export const KIOSK_SEARCH_FIELDS = ['jobDefinitionName', 'jobDefinitionDisplayName', 'assignmentTargetName'];

/** Where an assignment target can live, and the spec's assignmentTargetType for it */
const ASSIGNMENT_TARGETS = [
  { fixture: 'windowsEndpoints', type: 'WindowsEndpoint', key: 'endpointId' },
  { fixture: 'androidEndpoints', type: 'AndroidEndpoint', key: 'endpointId' },
  { fixture: 'iosEndpoints', type: 'IosEndpoint', key: 'endpointId' },
  { fixture: 'macEndpoints', type: 'MacEndpoint', key: 'endpointId' },
  { fixture: 'logicalGroups', type: 'LogicalGroup', key: 'logicalGroupId' },
  { fixture: 'adObjects', type: 'ADObject', key: 'adObjectId' },
] as const;


export function registerCatalogRoutes(app: Express, profile: IProfile): void {

  /** Current records of an entity type: the state store in read-write profiles, else the fixture */
  const records = (fixture: string): Record<string, unknown>[] => currentRecords(app, profile, fixture) ?? [];

  // ─── KioskReleases (P13.4.5) ──────────────────────────────────────────────
  // GET /v2.0/KioskReleases
  app.get('/v2.0/KioskReleases', (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('kioskReleases', profile.getFixture('kioskReleases') as { id: string }[]).getAll()
        : (profile.getFixture('kioskReleases') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, KIOSK_SEARCH_FIELDS); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/KioskReleases/:id
  registerGetById(app, profile, {
    basePath: '/v2.0/KioskReleases',
    entityType: 'kioskReleases',
    entityName: 'Kiosk release',
  });

  // POST /v2.0/KioskReleases — spec KioskReleaseForCreation: { assignmentTargetId, jobDefinitionId }.
  // Releases the job definition to the target; name, type and job definition fields are derived.
  app.post('/v2.0/KioskReleases', validateWriteBody(['assignmentTargetId', 'jobDefinitionId']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { assignmentTargetId, jobDefinitionId } = req.body as { assignmentTargetId: string; jobDefinitionId: string };
    const jobDefinition = records('jobs').find((j) => j['id'] === jobDefinitionId);
    if (!jobDefinition) { res.status(404).json({ error: `Job definition ${jobDefinitionId} not found` }); return; }
    let target: { record: Record<string, unknown>; type: string; key: string } | undefined;
    for (const kind of ASSIGNMENT_TARGETS) {
      const record = records(kind.fixture).find((r) => r['id'] === assignmentTargetId);
      if (record) { target = { record, type: kind.type, key: kind.key }; break; }
    }
    if (!target) { res.status(404).json({ error: `Assignment target ${assignmentTargetId} not found` }); return; }
    const release = sm.addStore('kioskReleases', profile.getFixture('kioskReleases') as { id: string }[]).create({
      assignmentTargetId,
      assignmentTargetName: target.record['displayName'] ?? target.record['name'] ?? target.record['hostName'] ?? null,
      assignmentTargetType: target.type,
      jobDefinitionId,
      jobDefinitionName: jobDefinition['name'] ?? null,
      jobDefinitionDisplayName: jobDefinition['displayName'] ?? null,
      jobDefinitionCategory: jobDefinition['category'] ?? null,
      jobDefinitionSupportedPlatforms: ['Windows'],
      // internal relation, used by the Endpoints/LogicalGroups/ADObjects sub-resources
      [target.key]: assignmentTargetId,
    });
    res.status(201).json(release);
  });

  // DELETE /v2.0/KioskReleases/:id
  app.delete('/v2.0/KioskReleases/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('kioskReleases', profile.getFixture('kioskReleases') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Kiosk release not found' }); return;
    }
    res.status(204).send();
  });

  // ─── SecurityGroups (P13.4.7) ─────────────────────────────────────────────
  registerCrudRoutes(app, profile, {
    basePath: '/v2.0/SecurityGroups',
    entityType: 'securityGroups',
    entityName: 'Security group',
    requiredField: 'name',
    searchFields: ['name', 'description'],
    getStore: (sm) => sm.addStore('securityGroups', profile.getFixture('securityGroups') as { id: string }[]),
    validateCreate: validateWriteBody(['name']),
    validatePatch: validateGenericUpdate,
  });

  // ─── SecurityProfiles (P13.4.8) ───────────────────────────────────────────
  registerCrudRoutes(app, profile, {
    basePath: '/v2.0/SecurityProfiles',
    entityType: 'securityProfiles',
    entityName: 'Security profile',
    requiredField: 'name',
    searchFields: ['name', 'description', 'level'],
    getStore: (sm) => sm.addStore('securityProfiles', profile.getFixture('securityProfiles') as { id: string }[]),
    validateCreate: validateWriteBody(['name']),
    validatePatch: validateGenericUpdate,
  });

  // ─── AssetTypes (P13.4.9) + AssetTypes/Folders (P13.4.10) ───────────────────
  // NOTE: /Folders routes must be registered before /:id to prevent shadowing.

  // GET /v2.0/AssetTypes
  app.get('/v2.0/AssetTypes', (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('assetTypes', profile.getFixture('assetTypes') as { id: string }[]).getAll()
        : (profile.getFixture('assetTypes') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'description']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AssetTypes/Folders (must be before /:id)
  app.get('/v2.0/AssetTypes/Folders', (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('assetTypeFolders', profile.getFixture('assetTypeFolders') as { id: string }[]).getAll()
        : (profile.getFixture('assetTypeFolders') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AssetTypes/Folders/:id
  registerGetById(app, profile, {
    basePath: '/v2.0/AssetTypes/Folders',
    entityType: 'assetTypeFolders',
    entityName: 'Asset type folder',
  });

  // GET /v2.0/AssetTypes/Folders/:folderId/Folders (child navigation)
  app.get('/v2.0/AssetTypes/Folders/:folderId/Folders', (req: Request, res: Response) => {
    try {
      const folderId = req.params.folderId as string;
      if (!folderId || !GUID_REGEX.test(folderId)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm = app.locals.stateManager as StateManager | undefined;
      const data: Record<string, unknown>[] = sm
        ? sm.addStore('assetTypeFolders', profile.getFixture('assetTypeFolders') as { id: string }[]).getAll()
        : (profile.getFixture('assetTypeFolders') as Record<string, unknown>[]);
      const children = data.filter((f) => f['parentId'] === folderId);
      res.status(200).json({ data: children, pageSize: children.length, page: 0, totalItems: children.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/AssetTypes/Folders
  app.post('/v2.0/AssetTypes/Folders', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('assetTypeFolders', profile.getFixture('assetTypeFolders') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // PATCH /v2.0/AssetTypes/Folders/:id
  app.patch('/v2.0/AssetTypes/Folders/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore('assetTypeFolders', profile.getFixture('assetTypeFolders') as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Asset type folder not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/AssetTypes/Folders/:id
  app.delete('/v2.0/AssetTypes/Folders/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('assetTypeFolders', profile.getFixture('assetTypeFolders') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Asset type folder not found' }); return;
    }
    res.status(204).send();
  });

  // GET /v2.0/AssetTypes/:id (after /Folders routes to prevent shadowing)
  registerGetById(app, profile, {
    basePath: '/v2.0/AssetTypes',
    entityType: 'assetTypes',
    entityName: 'Asset type',
  });

  // POST /v2.0/AssetTypes
  app.post('/v2.0/AssetTypes', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('assetTypes', profile.getFixture('assetTypes') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // DELETE /v2.0/AssetTypes/:id
  app.delete('/v2.0/AssetTypes/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('assetTypes', profile.getFixture('assetTypes') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Asset type not found' }); return;
    }
    res.status(204).send();
  });
}
