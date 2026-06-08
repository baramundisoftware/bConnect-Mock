/**
 * Miscellaneous routes — OSFolders, EntraIdData, Folders (jobs context).
 * Extracted from app.ts (P13.0.8). Folders added P13.4.6.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { resolveEntityData, applyMultiKeywordSearch, applyMultiFieldSort, parsePage, GUID_REGEX } from './utils';
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
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
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
  // GET /v2.0/Folders
  app.get('/v2.0/Folders', (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      let data: Record<string, unknown>[] = sm
        ? sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).getAll()
        : (profile.getFixture('jobFolders') as Record<string, unknown>[]);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Folders/:id
  app.get('/v2.0/Folders/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm = app.locals.stateManager as StateManager | undefined;
      const data: Record<string, unknown>[] = sm
        ? sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).getAll()
        : (profile.getFixture('jobFolders') as Record<string, unknown>[]);
      const item = data.find((f) => f['id'] === id);
      if (!item) { res.status(404).json({ error: 'Folder not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Folders/:id/Folders — sub-navigation (children)
  app.get('/v2.0/Folders/:id/Folders', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm = app.locals.stateManager as StateManager | undefined;
      const all: Record<string, unknown>[] = sm
        ? sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).getAll()
        : (profile.getFixture('jobFolders') as Record<string, unknown>[]);
      const parent = all.find((f) => f['id'] === id);
      if (!parent) { res.status(404).json({ error: 'Folder not found' }); return; }
      const children = all.filter((f) => f['parentId'] === id);
      res.status(200).json({ data: children, pageSize: children.length, page: 0, totalItems: children.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Folders
  app.post('/v2.0/Folders', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // PATCH /v2.0/Folders/:id
  app.patch('/v2.0/Folders/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Folder not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/Folders/:id
  app.delete('/v2.0/Folders/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('jobFolders', profile.getFixture('jobFolders') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Folder not found' }); return;
    }
    res.status(204).send();
  });

  // GET /v2.0/EntraIdData + GET /v2.0/EntraIdData/:deviceId (26R1 only)
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    app.get('/v2.0/EntraIdData', (req: Request, res: Response) => {
      try {
        const page = parsePage(req.query.Page);
        const pageSize = parseInt(req.query.PageSize as string) || 0;
        const resolved = resolveEntityData(profile, 'entraIdData', { page, pageSize, searchFields: [] });
        if (!resolved) { res.status(200).json({ data: [], pageSize: 0, page: 0, totalItems: 0 }); return; }
        const eff = pageSize > 0 ? pageSize : resolved.data.length;
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
