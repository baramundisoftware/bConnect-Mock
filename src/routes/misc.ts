/**
 * Miscellaneous routes — OSFolders, EntraIdData, Folders (jobs context).
 * Extracted from app.ts (P13.0.8). Folders added P13.4.6.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { resolveEntityData, applyMultiKeywordSearch, applyMultiFieldSort, parsePage, GUID_REGEX, parsePageSize } from './utils';
import { validateGenericUpdate, validateWriteBody } from '../middleware/validateBody';

export function registerMiscRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/OSFolders
  app.get('/v2.0/OSFolders', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('osFolders') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/OSFolders/:id
  app.get('/v2.0/OSFolders/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('osFolders') as Record<string, unknown>[];
      const item = data.find((f) => f['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'OS folder not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── /v2.0/Folders — Jobs context (P13.4.6) ────────────────────────────────
  registerFolderRoutes(app, profile, { basePath: '/v2.0/Folders', fixtureKey: 'jobFolders' });

  // GET /v2.0/EntraIdData + GET /v2.0/EntraIdData/:deviceId (26R1 only)
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    app.get('/v2.0/EntraIdData', (req: Request, res: Response) => {
      try {
        const page = parsePage(req.query.Page);
        const pageSize = parsePageSize(req.query.PageSize);
        const resolved = resolveEntityData(profile, 'entraIdData', { page, pageSize, searchFields: [] }, app.locals.stateManager);
        if (!resolved) { res.status(200).json({ data: [], pageSize: 0, page: 0, totalItems: 0 }); return; }
        const eff = pageSize;
        res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });

    app.get('/v2.0/EntraIdData/:deviceId', (req: Request, res: Response) => {
      try {
        const deviceId = req.params.deviceId as string;
        if (!deviceId || Array.isArray(deviceId)) { res.status(400).json({ error: 'Invalid device ID' }); return; }
        const data = profile.getFixture('entraIdData') as Record<string, unknown>[];
        const item = data.find((e) => e['deviceId'] === deviceId || e['id'] === deviceId);
        if (!item) { res.status(404).json({ error: 'EntraId data not found for device' }); return; }
        res.status(200).json(item);
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });
  }
}

export interface FolderRoutesConfig {
  /** e.g. '/v2.0/Folders' (jobs) or '/operatingsystems/v2.0/Folders' */
  basePath: string;
  /** Fixture and state-store key, e.g. 'jobFolders' or 'osFolders' */
  fixtureKey: string;
}

/**
 * The spec's folder routes: list, get, child folders (optionally all descendants with
 * includeSubfolders=true), create, update, delete. Writes need a read-write profile.
 */
export function registerFolderRoutes(app: Express, profile: IProfile, config: FolderRoutesConfig): void {
  const { basePath, fixtureKey } = config;
  const folders = (): Record<string, unknown>[] => {
    const sm = app.locals.stateManager as StateManager | undefined;
    return sm
      ? sm.addStore(fixtureKey, profile.getFixture(fixtureKey) as { id: string }[]).getAll()
      : (profile.getFixture(fixtureKey) as Record<string, unknown>[]);
  };

  app.get(basePath, (req: Request, res: Response) => {
    try {
      let data = folders();
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get(`${basePath}/:id`, (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const item = folders().find((f) => f['id'] === id);
      if (!item) { res.status(404).json({ error: 'Folder not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // Child folders; includeSubfolders=true returns all descendants
  app.get(`${basePath}/:id/Folders`, (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const all = folders();
      if (!all.some((f) => f['id'] === id)) { res.status(404).json({ error: 'Folder not found' }); return; }
      const recursive = String(req.query.includeSubfolders).toLowerCase() === 'true';
      const result: Record<string, unknown>[] = [];
      const parents = [id];
      while (parents.length > 0) {
        const parentId = parents.shift();
        for (const child of all.filter((f) => f['parentId'] === parentId)) {
          result.push(child);
          if (recursive) { parents.push(String(child['id'])); }
        }
      }
      res.status(200).json({ data: result, pageSize: result.length, page: 0, totalItems: result.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post(basePath, validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore(fixtureKey, profile.getFixture(fixtureKey) as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  app.patch(`${basePath}/:id`, validateGenericUpdate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore(fixtureKey, profile.getFixture(fixtureKey) as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Folder not found' }); return; }
    res.status(200).json(updated);
  });

  app.delete(`${basePath}/:id`, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore(fixtureKey, profile.getFixture(fixtureKey) as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Folder not found' }); return;
    }
    res.status(204).send();
  });
}
