/**
 * Catalog routes — KioskReleases, SecurityGroups, SecurityProfiles, AssetTypes.
 * P13.4.5, P13.4.7, P13.4.8, P13.4.9
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { GUID_REGEX, parsePage, applyMultiKeywordSearch } from './utils';
import { registerGetById } from './factories/getById';
import { registerCrudRoutes } from './factories/crudRoutes';
import { validateGenericUpdate, validateWriteBody } from '../middleware/validateBody';

export function registerCatalogRoutes(app: Express, profile: IProfile): void {

  // ─── KioskReleases (P13.4.5) ──────────────────────────────────────────────
  // GET /v2.0/KioskReleases
  app.get('/v2.0/KioskReleases', (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('kioskReleases', profile.getFixture('kioskReleases') as { id: string }[]).getAll()
        : (profile.getFixture('kioskReleases') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'version', 'status', 'description']); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
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

  // POST /v2.0/KioskReleases
  app.post('/v2.0/KioskReleases', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('kioskReleases', profile.getFixture('kioskReleases') as { id: string }[]).create(req.body as Record<string, unknown>));
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
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
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
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
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
