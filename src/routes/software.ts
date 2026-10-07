/**
 * Software routes — Software, WindowsUpdates, Bundles, BundleApplications, Bundle/Folders.
 * Extracted from app.ts (P13.0.8). Bundle mutations added P13.4.16.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { resolveEntityData, applyMultiKeywordSearch, parsePage, GUID_REGEX, parsePageSize } from './utils';
import { currentRecords } from './factories/currentRecords';
import { validateWriteBody, validateGenericUpdate } from '../middleware/validateBody';

export function registerSoftwareRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/Software
  app.get('/v2.0/Software', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'software', { searchQuery, orderBy, page, pageSize, searchFields: ['name', 'vendor', 'category'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'Software not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/WindowsUpdates
  app.get('/v2.0/WindowsUpdates', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'windowsUpdates', { searchQuery, orderBy, page, pageSize, searchFields: ['kbArticle', 'title', 'severity', 'classification'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'WindowsUpdates not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}

export function registerSoftware26R1Routes(app: Express, profile: IProfile): void {

  // GET /v2.0/Bundles
  app.get('/v2.0/Bundles', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'bundles', { searchQuery, orderBy, page, pageSize, searchFields: ['name', 'type', 'comment'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'Bundles not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Bundles/:id
  app.get('/v2.0/Bundles/:id', (req: Request, res: Response) => {
    try {
      const item = (currentRecords(app, profile, 'bundles') ?? []).find((b) => b['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Bundle not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/BundleApplications
  app.get('/v2.0/BundleApplications', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'bundleApplications', { searchQuery, page, pageSize, searchFields: ['applicationName', 'applicationVendor', 'bundleName'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'BundleApplications not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/BundleApplications/:id
  app.get('/v2.0/BundleApplications/:id', (req: Request, res: Response) => {
    try {
      const item = (currentRecords(app, profile, 'bundleApplications') ?? []).find((a) => a['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'BundleApplication not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Bundle/Folders
  app.get('/v2.0/Bundle/Folders', (req: Request, res: Response) => {
    try {
      let data = currentRecords(app, profile, 'bundleFolders') ?? [];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'comment']); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Bundle/Folders/:id
  app.get('/v2.0/Bundle/Folders/:id', (req: Request, res: Response) => {
    try {
      const item = (currentRecords(app, profile, 'bundleFolders') ?? []).find((f) => f['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'BundleFolder not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Bundle/Folders mutations (P13.4.17) ──────────────────────────────────

  // POST /v2.0/Bundle/Folders
  app.post('/v2.0/Bundle/Folders', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('bundleFolders', profile.getFixture('bundleFolders') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // PATCH /v2.0/Bundle/Folders/:id
  app.patch('/v2.0/Bundle/Folders/:id', validateGenericUpdate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore('bundleFolders', profile.getFixture('bundleFolders') as { id: string }[]).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'Bundle folder not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/Bundle/Folders/:id
  app.delete('/v2.0/Bundle/Folders/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('bundleFolders', profile.getFixture('bundleFolders') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Bundle folder not found' }); return;
    }
    res.status(204).send();
  });

  // ─── Bundle mutations (P13.4.16) ──────────────────────────────────────────

  // POST /v2.0/Bundles
  app.post('/v2.0/Bundles', validateWriteBody(['name']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    res.status(201).json(sm.addStore('bundles', profile.getFixture('bundles') as { id: string }[]).create(req.body as Record<string, unknown>));
  });

  // DELETE /v2.0/Bundles/:id
  app.delete('/v2.0/Bundles/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('bundles', profile.getFixture('bundles') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'Bundle not found' }); return;
    }
    res.status(204).send();
  });

  // POST /v2.0/Bundles/:id/BundleApplications
  app.post('/v2.0/Bundles/:bundleId/BundleApplications', validateWriteBody(['applicationId']), (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const bundleId = req.params.bundleId as string;
    if (!bundleId || !GUID_REGEX.test(bundleId)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const bundleStore = sm.addStore('bundles', profile.getFixture('bundles') as { id: string }[]);
    if (!bundleStore.getById(bundleId)) { res.status(404).json({ error: 'Bundle not found' }); return; }
    const body = { ...req.body as Record<string, unknown>, bundleId };
    res.status(201).json(sm.addStore('bundleApplications', profile.getFixture('bundleApplications') as { id: string }[]).create(body));
  });

  // PATCH /v2.0/Bundles/:id/BundleApplications/:appId
  app.patch('/v2.0/Bundles/:bundleId/BundleApplications/:appId', validateGenericUpdate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const appId = req.params.appId as string;
    if (!appId || !GUID_REGEX.test(appId)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = sm.addStore('bundleApplications', profile.getFixture('bundleApplications') as { id: string }[]).patch(appId, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: 'BundleApplication not found' }); return; }
    res.status(200).json(updated);
  });

  // DELETE /v2.0/BundleApplications/:id
  app.delete('/v2.0/BundleApplications/:id', (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!sm.addStore('bundleApplications', profile.getFixture('bundleApplications') as { id: string }[]).delete(id)) {
      res.status(404).json({ error: 'BundleApplication not found' }); return;
    }
    res.status(204).send();
  });
}
