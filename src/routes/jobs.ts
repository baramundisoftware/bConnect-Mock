/**
 * Jobs routes — JobDefinitions, JobInstances.
 * Extracted from app.ts (P13.0.8).
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import {
  validateJobCreate,
  validateJobPatch,
  validateJobInstanceCreate,
} from '../middleware/validateBody';
import { resolveEntityData, applyMultiKeywordSearch, applyMultiFieldSort, parsePage, parsePageSize } from './utils';

export function registerJobRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/JobDefinitions
  app.get('/v2.0/JobDefinitions', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      if (sm) {
        let data = sm.jobs.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'type']); }
        const eff = pageSize;
        res.status(200).json({ data: data.slice(page * eff, page * eff + eff), pageSize: eff, page, totalItems: data.length });
      } else {
        const resolved = resolveEntityData(profile, 'jobs', { searchQuery, orderBy, page, pageSize, searchFields: ['name', 'type'] }, app.locals.stateManager);
        const data = resolved?.data ?? [];
        const totalItems = resolved?.totalItems ?? 0;
        const eff = pageSize;
        res.status(200).json({ data, pageSize: eff, page, totalItems });
      }
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/JobDefinitions
  app.post('/v2.0/JobDefinitions', validateJobCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Missing required field: name' }); return; }
    res.status(201).json(sm.jobs.create(req.body));
  });

  // PUT /v2.0/JobDefinitions/:id
  app.put('/v2.0/JobDefinitions/:id', validateJobCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { id } = req.params;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.jobs.update(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Job not found' }); return; }
    res.status(200).json(updated);
  });

  // PATCH /v2.0/JobDefinitions/:id
  app.patch('/v2.0/JobDefinitions/:id', validateJobPatch, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { id } = req.params;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = sm.jobs.patch(id, req.body);
    if (!updated) { res.status(404).json({ error: 'Job not found' }); return; }
    res.status(200).json(updated);
  });

  // GET /v2.0/JobDefinitions/:id
  app.get('/v2.0/JobDefinitions/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.jobs.getById(id);
        if (!item) { res.status(404).json({ error: 'Job definition not found' }); return; }
        res.status(200).json(item); return;
      }
      const data = profile.getFixture('jobs') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === id || j['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Job definition not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // DELETE /v2.0/JobDefinitions/:id
  app.delete('/v2.0/JobDefinitions/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { id } = req.params;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.jobs.delete(id)) { res.status(404).json({ error: 'Job not found' }); return; }
    res.status(204).send();
  });

  // GET /v2.0/JobInstances
  app.get('/v2.0/JobInstances', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const page = parsePage(req.query.Page);
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        let data = sm.jobInstances.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['jobDefinitionName', 'endpointName', 'state']); }
        if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
        const pageSize = parsePageSize(req.query.PageSize);
        res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
        return;
      }
      const pageSize = parsePageSize(req.query.PageSize);
      const resolved = resolveEntityData(profile, 'jobInstances', { searchQuery, orderBy, page, pageSize, searchFields: ['jobDefinitionName', 'endpointName', 'state'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'No job instances available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/JobInstances/:id
  app.get('/v2.0/JobInstances/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.jobInstances.getById(id);
        if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
        res.status(200).json(item); return;
      }
      const data = profile.getFixture('jobInstances') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === id || j['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/JobInstances
  app.post('/v2.0/JobInstances', validateJobInstanceCreate, (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { jobDefinitionId, endpointId } = req.body;
    if (!jobDefinitionId || !endpointId) { res.status(400).json({ error: 'Missing required fields: jobDefinitionId, endpointId' }); return; }
    res.status(201).json(sm.jobInstances.create({ ...req.body, state: 'Pending', type: 'JobInstance' }));
  });

  // DELETE /v2.0/JobInstances/:id
  app.delete('/v2.0/JobInstances/:id', (req: Request, res: Response) => {
    const sm: StateManager | undefined = app.locals.stateManager;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const { id } = req.params;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!sm.jobInstances.delete(id)) { res.status(404).json({ error: 'Job instance not found' }); return; }
    res.status(204).send();
  });

  // POST /v2.0/JobInstances/:id/Start
  app.post('/v2.0/JobInstances/:id/Start', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.jobInstances.getById(id);
        if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
        sm.jobInstances.patch(id, { state: 'Running' });
        res.status(200).json({ message: `Job instance ${id} started` }); return;
      }
      const data = profile.getFixture('jobInstances') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === id);
      if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
      res.status(200).json({ message: `Job instance ${id} started` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/JobInstances/:id/Stop
  app.post('/v2.0/JobInstances/:id/Stop', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.jobInstances.getById(id);
        if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
        sm.jobInstances.patch(id, { state: 'Cancelled' });
        res.status(200).json({ message: `Job instance ${id} stopped` }); return;
      }
      const data = profile.getFixture('jobInstances') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === id);
      if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
      res.status(200).json({ message: `Job instance ${id} stopped` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/JobInstances/:id/Resume
  app.post('/v2.0/JobInstances/:id/Resume', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.jobInstances.getById(id);
        if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
        sm.jobInstances.patch(id, { state: 'Running' });
        res.status(200).json({ message: `Job instance ${id} resumed` }); return;
      }
      const data = profile.getFixture('jobInstances') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === id);
      if (!item) { res.status(404).json({ error: 'Job instance not found' }); return; }
      res.status(200).json({ message: `Job instance ${id} resumed` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
