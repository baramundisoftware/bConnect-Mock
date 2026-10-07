/**
 * Assets routes — CRUD for Assets and Variables.
 * Extracted from app.ts (P13.0.8).
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import {
  validateAssetCreate,
  validateAssetUpdate,
  validateVariableCreate,
  validateVariableUpdate,
  validateGenericUpdate,
  validateWriteBody,
} from '../middleware/validateBody';
import { resolveEntityData, applyMultiKeywordSearch, parsePage, GUID_REGEX, parsePageSize } from './utils';
import { registerReadonlyList } from './factories/readonlyList';
import { registerGetById } from './factories/getById';

export function registerAssetRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/Assets
  app.get('/v2.0/Assets', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      if (sm) {
        let data = sm.assets.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['assetTag', 'department', 'location']); }
        const eff = pageSize;
        res.status(200).json({ data: data.slice(page * eff, page * eff + eff), pageSize: eff, page, totalItems: data.length });
      } else {
        const resolved = resolveEntityData(profile, 'assets', { searchQuery, orderBy, page, pageSize, searchFields: ['assetTag', 'department', 'location'] });
        const data = resolved?.data ?? [];
        const totalItems = resolved?.totalItems ?? 0;
        const eff = pageSize;
        res.status(200).json({ data, pageSize: eff, page, totalItems });
      }
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Assets/:id (P13.1.6)
  registerGetById(app, profile, {
    basePath: '/v2.0/Assets',
    entityType: 'assets',
    entityName: 'Asset',
  });

  // POST /v2.0/Assets
  app.post('/v2.0/Assets', validateAssetCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const created = sm.assets.create(req.body);
    // The spec identifies an asset by assetId; keep it equal to the store's id
    res.status(201).json((created.id && sm.assets.patch(created.id, { assetId: created.id })) || created);
  });

  // PUT /v2.0/Assets/:id
  app.put('/v2.0/Assets/:id', validateAssetUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.assets.update(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Asset not found' }); return; }
    res.status(200).json(updated);
  });

  // PATCH /v2.0/Assets/:id
  app.patch('/v2.0/Assets/:id', validateAssetUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.assets.patch(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Asset not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/Assets/:id
  app.delete('/v2.0/Assets/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.assets.delete(id)) { res.status(404).json({ error: 'Asset not found' }); return; }
    res.status(204).send();
  });
}

// ─── AssetStock routes (P13.4.11) ─────────────────────────────────────────
export function registerAssetStockRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/AssetStock/Assets
  app.get('/v2.0/AssetStock/Assets', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      let data: Record<string, unknown>[] = sm
        ? sm.assets.getAll()
        : (profile.getFixture('assets') as Record<string, unknown>[]);
      const stockFolderId = req.query.AssetStockFolderId as string | undefined;
      if (stockFolderId?.trim()) { data = data.filter((a) => a['assetStockFolderId'] === stockFolderId); }
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['assetTag', 'type', 'location']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AssetStock/Folders
  app.get('/v2.0/AssetStock/Folders', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('assetStockFolders', profile.getFixture('assetStockFolders') as { id: string }[]).getAll()
        : (profile.getFixture('assetStockFolders') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AssetStock/Folders/:id
  registerGetById(app, profile, {
    basePath: '/v2.0/AssetStock/Folders',
    entityType: 'assetStockFolders',
    entityName: 'Asset stock folder',
  });

  // GET /v2.0/AssetStock/Folders/:folderId/Folders (child navigation)
  app.get('/v2.0/AssetStock/Folders/:folderId/Folders', (req: Request, res: Response) => {
    try {
      const folderId = req.params.folderId as string;
      const sm: StateManager | undefined = app.locals.stateManager;
      const data: Record<string, unknown>[] = sm
        ? sm.addStore('assetStockFolders', profile.getFixture('assetStockFolders') as { id: string }[]).getAll()
        : (profile.getFixture('assetStockFolders') as Record<string, unknown>[]);
      const children = data.filter((f) => f['parentId'] === folderId);
      res.status(200).json({ data: children, pageSize: children.length, page: 0, totalItems: children.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/AssetStock/Folders
  app.post('/v2.0/AssetStock/Folders', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('assetStockFolders', profile.getFixture('assetStockFolders') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // PATCH /v2.0/AssetStock/Folders/:id
  app.patch('/v2.0/AssetStock/Folders/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore('assetStockFolders', profile.getFixture('assetStockFolders') as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Asset stock folder not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/AssetStock/Folders/:id
  app.delete('/v2.0/AssetStock/Folders/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('assetStockFolders', profile.getFixture('assetStockFolders') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Asset stock folder not found' }); return;
    }
    res.status(204).send();
  });
}

export function registerVariableRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/Variables
  app.get('/v2.0/Variables', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      let data: Record<string, unknown>[] = sm
        ? sm.variables.getAll()
        : (profile.getFixture('variables') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'description']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Variables
  app.post('/v2.0/Variables', validateVariableCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Missing required field: name' }); return; }
    res.status(201).json(sm.variables.create(req.body));
  });

  // PUT /v2.0/Variables/:id
  app.put('/v2.0/Variables/:id', validateVariableUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.variables.update(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Variable not found' }); return; }
    res.status(200).json(updated);
  });

  // PATCH /v2.0/Variables/:id
  app.patch('/v2.0/Variables/:id', validateVariableUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.variables.patch(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Variable not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/Variables/:id
  app.delete('/v2.0/Variables/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.variables.delete(id)) { res.status(404).json({ error: 'Variable not found' }); return; }
    res.status(204).send();
  });

  // VariableDefinitions — aliases for Variables with the 26R1 naming (P13.4.1)
  // GET /v2.0/VariableDefinitions (list)
  app.get('/v2.0/VariableDefinitions', (req: Request, res: Response) => {
    try {
      let data: Record<string, unknown>[];
      const sm: StateManager | undefined = app.locals.stateManager;
      data = sm ? (sm.variables.getAll() as Record<string, unknown>[]) : (profile.getFixture('variables') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = data.filter(v => JSON.stringify(v).includes(searchQuery)); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/VariableDefinitions/:id
  app.get('/v2.0/VariableDefinitions/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      const data = sm ? (sm.variables.getAll() as Record<string, unknown>[]) : (profile.getFixture('variables') as Record<string, unknown>[]);
      const item = data.find(v => v['id'] === id || v['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Variable definition not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/VariableDefinitions
  app.post('/v2.0/VariableDefinitions', validateVariableCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.variables.create(req.body));
  });

  // PATCH /v2.0/VariableDefinitions/:id
  app.patch('/v2.0/VariableDefinitions/:id', validateVariableUpdate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.variables.patch(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Variable definition not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/VariableDefinitions/:id
  app.delete('/v2.0/VariableDefinitions/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.variables.delete(id)) { res.status(404).json({ error: 'Variable definition not found' }); return; }
    res.status(204).send();
  });

  // VariableInstances — GET list, GET by id, PATCH (P13.4.2)
  registerReadonlyList(app, profile, {
    path: '/v2.0/VariableInstances',
    entityType: 'variableInstances',
    searchFields: ['value', 'variableDefinitionId', 'endpointId'],
    entityName: 'VariableInstances',
  });
  registerGetById(app, profile, {
    basePath: '/v2.0/VariableInstances',
    entityType: 'variableInstances',
    entityName: 'Variable instance',
  });
  // PATCH /v2.0/VariableInstances/:id
  app.patch('/v2.0/VariableInstances/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const store = sm.addStore('variableInstances', profile.getFixture('variableInstances') as { id: string }[]);
      const updated = store.patch(id, req.body as Record<string, unknown>);
      if (!updated) { res.status(404).json({ error: 'Variable instance not found' }); return; }
      res.status(200).json(updated);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
