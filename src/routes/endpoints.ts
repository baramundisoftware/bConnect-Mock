/**
 * Endpoint routes — Windows, Android, Linux, Mac, iOS, Network, Industrial.
 * Extracted from app.ts (P13.0.8).
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { BmsVersion } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import {
  validateEndpointCreate,
  validateEndpointPatch,
} from '../middleware/validateBody';
import {
  GUID_REGEX,
  resolveEntityData,
  applyMultiKeywordSearch,
  applyMultiFieldSort,
  parsePage,
  parsePageSize,
} from './utils';
import { registerGetById } from './factories/getById';
import { registerReadonlyList } from './factories/readonlyList';

interface LinuxEndpoint { id: string; displayName: string; endpointType: string; [key: string]: unknown; }
interface MacEndpoint   { id: string; displayName: string; endpointType: string; [key: string]: unknown; }
interface WindowsEndpoint { id: string; guid: string; type: string; displayName: string; [key: string]: unknown; }

function loadLinuxEndpointFixture(profile: IProfile): LinuxEndpoint[] {
  const f = profile.getFixture('linuxEndpoints');
  return Array.isArray(f) ? (f as LinuxEndpoint[]) : [];
}

function loadMacEndpointFixture(profile: IProfile): MacEndpoint[] {
  const f = profile.getFixture('macEndpoints');
  return Array.isArray(f) ? (f as MacEndpoint[]) : [];
}

function loadWindowsEndpointFixture(profile: IProfile): WindowsEndpoint[] {
  const f = profile.getFixture('windowsEndpoints');
  return Array.isArray(f) ? (f as WindowsEndpoint[]) : [];
}

function registerEntityWriteRoutes(
  app: Express,
  config: {
    basePath: string;
    entityName: string;
    requiredField: string;
    getStore: (sm: StateManager) => { create: (d: Record<string, unknown>) => Record<string, unknown>; update: (id: string, d: Record<string, unknown>) => Record<string, unknown> | undefined; patch: (id: string, d: Record<string, unknown>) => Record<string, unknown> | undefined; delete: (id: string) => boolean; };
    validateCreate: import('express').RequestHandler;
    validatePatch: import('express').RequestHandler;
    hasPut?: boolean;
  }
): void {
  const { basePath, entityName, requiredField, getStore, validateCreate: valCreate, validatePatch: valPatch, hasPut = false } = config;

  app.post(basePath, valCreate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    if (!req.body[requiredField]) { res.status(400).json({ error: `Missing required field: ${requiredField}` }); return; }
    res.status(201).json(getStore(sm).create(req.body as Record<string, unknown>));
  });

  if (hasPut) {
    app.put(`${basePath}/:id`, valCreate, (req: Request, res: Response) => {
      const sm = app.locals.stateManager as StateManager | undefined;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const updated = getStore(sm).update(id, req.body as Record<string, unknown>);
      if (!updated) { res.status(404).json({ error: `${entityName} not found` }); return; }
      res.status(200).json(updated);
    });
  }

  app.patch(`${basePath}/:id`, valPatch, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const updated = getStore(sm).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: `${entityName} not found` }); return; }
    res.status(200).json(updated);
  });

  app.delete(`${basePath}/:id`, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params.id as string;
    if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    if (!getStore(sm).delete(id)) { res.status(404).json({ error: `${entityName} not found` }); return; }
    res.status(204).send();
  });
}

export function registerEndpointRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/WindowsEndpoints
  app.get('/v2.0/WindowsEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const page = parsePage(req.query.Page);
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        let data = sm.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['displayName', 'operatingSystem']); }
        if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
        const pageSize = parsePageSize(req.query.PageSize);
        res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
        return;
      }
      const pageSize = parsePageSize(req.query.PageSize);
      const resolved = resolveEntityData(profile, 'windowsEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'operatingSystem'] });
      if (!resolved) { res.status(404).json({ error: 'No Windows endpoints available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/WindowsEndpoints/:id
  app.get('/v2.0/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const endpoint = sm.getById(id);
        if (!endpoint) { res.status(404).json({ error: 'Endpoint not found' }); return; }
        res.status(200).json(endpoint); return;
      }
      const fixtureData = loadWindowsEndpointFixture(profile);
      const endpoint = fixtureData.find((e) => e.id === id || e.guid === id);
      if (!endpoint) { res.status(404).json({ error: 'Endpoint not found' }); return; }
      res.status(200).json(endpoint);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/WindowsEndpoints
  app.post('/v2.0/WindowsEndpoints', validateEndpointCreate, (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const { displayName } = req.body;
      if (!displayName) { res.status(400).json({ error: 'Missing required field: displayName' }); return; }
      res.status(201).json(sm.create(req.body));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PUT /v2.0/WindowsEndpoints/:id
  app.put('/v2.0/WindowsEndpoints/:id', validateEndpointCreate, (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const updated = sm.update(id, req.body);
      if (!updated) { res.status(404).json({ error: 'Endpoint not found' }); return; }
      res.status(200).json(updated);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH /v2.0/WindowsEndpoints/:id
  app.patch('/v2.0/WindowsEndpoints/:id', validateEndpointPatch, (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const updated = sm.patch(id, req.body);
      if (!updated) { res.status(404).json({ error: 'Endpoint not found' }); return; }
      res.status(200).json(updated);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // DELETE /v2.0/WindowsEndpoints/:id
  app.delete('/v2.0/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      if (!sm.delete(id)) { res.status(404).json({ error: 'Endpoint not found' }); return; }
      res.status(204).send();
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Endpoints (aggregate)
  app.get('/v2.0/Endpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const page = parsePage(req.query.Page);
      const pageSize = parsePageSize(req.query.PageSize);
      const sm: StateManager | undefined = app.locals.stateManager;
      let combined: Record<string, unknown>[];
      if (sm) {
        combined = [
          ...(sm.getAll() as Record<string, unknown>[]),
          ...(sm.androidEndpoints.getAll() as Record<string, unknown>[]),
          ...(sm.linuxEndpoints.getAll() as Record<string, unknown>[]),
          ...(sm.macEndpoints.getAll() as Record<string, unknown>[]),
          ...(sm.iosEndpoints.getAll() as Record<string, unknown>[]),
          ...(sm.networkEndpoints.getAll() as Record<string, unknown>[]),
          ...(sm.industrialEndpoints.getAll() as Record<string, unknown>[]),
        ];
      } else {
        const entityTypes = ['windowsEndpoints', 'androidEndpoints', 'linuxEndpoints', 'macEndpoints', 'iosEndpoints', 'networkEndpoints', 'industrialEndpoints'] as const;
        combined = entityTypes.flatMap((type) => {
          const resolved = resolveEntityData(profile, type, { page: 0, pageSize: 0 });
          return resolved ? (resolved.data as Record<string, unknown>[]) : [];
        });
      }
      if (searchQuery?.trim()) { combined = applyMultiKeywordSearch(combined, searchQuery, ['displayName', 'operatingSystem', 'deviceType']); }
      if (orderBy?.trim()) { combined = applyMultiFieldSort(combined, orderBy); }
      const totalItems = combined.length;
      const eff = pageSize;
      const data = eff > 0 ? combined.slice(page * eff, page * eff + eff) : combined;
      res.status(200).json({ data, pageSize: eff, page, totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AndroidEndpoints
  app.get('/v2.0/AndroidEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const page = parsePage(req.query.Page);
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        let data = sm.androidEndpoints.getAll() as Record<string, unknown>[];
        if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['displayName', 'operatingSystem']); }
        if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
        const pageSize = parsePageSize(req.query.PageSize);
        res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
        return;
      }
      const pageSize = parsePageSize(req.query.PageSize);
      const resolved = resolveEntityData(profile, 'androidEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'operatingSystem'] });
      if (!resolved) { res.status(404).json({ error: 'No Android endpoints available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/AndroidEndpoints/:id
  app.get('/v2.0/AndroidEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.androidEndpoints.getById(id);
        if (!item) { res.status(404).json({ error: 'Android endpoint not found' }); return; }
        res.status(200).json(item); return;
      }
      const resolved = resolveEntityData(profile, 'androidEndpoints', { page: 0, pageSize: 0 });
      const data = resolved ? resolved.data as Record<string, unknown>[] : [];
      const item = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Android endpoint not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // Android CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/AndroidEndpoints',
    entityName: 'Android endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.androidEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // GET /v2.0/LinuxEndpoints
  app.get('/v2.0/LinuxEndpoints', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      let data = sm
        ? (sm.linuxEndpoints.getAll() as LinuxEndpoint[])
        : loadLinuxEndpointFixture(profile);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['displayName', 'operatingSystem']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/LinuxEndpoints/:id (P13.1.2)
  registerGetById(app, profile, {
    basePath: '/v2.0/LinuxEndpoints',
    entityType: 'linuxEndpoints',
    entityName: 'Linux endpoint',
  });

  // Linux CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/LinuxEndpoints',
    entityName: 'Linux endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.linuxEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // GET /v2.0/MacEndpoints
  app.get('/v2.0/MacEndpoints', (req: Request, res: Response) => {
    try {
      const sm: StateManager | undefined = app.locals.stateManager;
      let data = sm
        ? (sm.macEndpoints.getAll() as MacEndpoint[])
        : loadMacEndpointFixture(profile);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['displayName', 'operatingSystem']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MacEndpoints/:id (P13.1.4)
  registerGetById(app, profile, {
    basePath: '/v2.0/MacEndpoints',
    entityType: 'macEndpoints',
    entityName: 'Mac endpoint',
  });

  // Mac CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/MacEndpoints',
    entityName: 'Mac endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.macEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // GET /v2.0/IosEndpoints
  app.get('/v2.0/IosEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'iosEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'operatingSystem', 'primaryUser'] });
      if (!resolved) { res.status(404).json({ error: 'No iOS endpoints available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/IosEndpoints/:id
  app.get('/v2.0/IosEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const item = sm.iosEndpoints.getById(id);
        if (!item) { res.status(404).json({ error: 'iOS endpoint not found' }); return; }
        res.status(200).json(item); return;
      }
      const resolved = resolveEntityData(profile, 'iosEndpoints', { page: 0, pageSize: 0 });
      const data = resolved ? resolved.data as Record<string, unknown>[] : [];
      const item = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!item) { res.status(404).json({ error: 'iOS endpoint not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // iOS CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/IosEndpoints',
    entityName: 'iOS endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.iosEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // GET /v2.0/NetworkEndpoints
  app.get('/v2.0/NetworkEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'networkEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'deviceType', 'primaryIP'] });
      if (!resolved) { res.status(404).json({ error: 'No Network endpoints available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/NetworkEndpoints/:id
  app.get('/v2.0/NetworkEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const resolved = resolveEntityData(profile, 'networkEndpoints', { page: 0, pageSize: 0 });
      const data = resolved ? resolved.data as Record<string, unknown>[] : [];
      const item = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Network endpoint not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // Network CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/NetworkEndpoints',
    entityName: 'Network endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.networkEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // IndustrialEndpoints (all versions — was 25R2 only; extended to 26R1 so MCP tools work across both)
  // GET /v2.0/IndustrialEndpoints
  app.get('/v2.0/IndustrialEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'industrialEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'deviceType', 'zone'] });
      if (!resolved) { res.status(404).json({ error: 'No Industrial endpoints available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/IndustrialEndpoints/:id
  app.get('/v2.0/IndustrialEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const resolved = resolveEntityData(profile, 'industrialEndpoints', { page: 0, pageSize: 0 });
      const data = resolved ? resolved.data as Record<string, unknown>[] : [];
      const item = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!item) { res.status(404).json({ error: 'Industrial endpoint not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // Industrial CRUD (write)
  registerEntityWriteRoutes(app, {
    basePath: '/v2.0/IndustrialEndpoints',
    entityName: 'Industrial endpoint',
    requiredField: 'displayName',
    getStore: (sm) => sm.industrialEndpoints,
    validateCreate: validateEndpointCreate,
    validatePatch: validateEndpointPatch,
    hasPut: true,
  });

  // GET /v2.0/Endpoints/:id — generic endpoint lookup across all endpoint types (P13.4.12)
  app.get('/v2.0/Endpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (sm) {
        const stores = [sm.windowsEndpoints, sm.androidEndpoints, sm.linuxEndpoints, sm.macEndpoints, sm.iosEndpoints, sm.networkEndpoints, sm.industrialEndpoints];
        for (const store of stores) {
          const item = store.getById(id);
          if (item) { res.status(200).json(item); return; }
        }
        res.status(404).json({ error: 'Endpoint not found' }); return;
      }
      const entityTypes = ['windowsEndpoints', 'androidEndpoints', 'linuxEndpoints', 'macEndpoints', 'iosEndpoints', 'networkEndpoints', 'industrialEndpoints'] as const;
      for (const et of entityTypes) {
        const data = profile.getFixture(et) as Record<string, unknown>[];
        const item = data.find((e) => e['id'] === id || e['guid'] === id);
        if (item) { res.status(200).json(item); return; }
      }
      res.status(404).json({ error: 'Endpoint not found' });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // DELETE /v2.0/Endpoints/:id — delete endpoint by ID across all types (P13.4.12)
  app.delete('/v2.0/Endpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const stores = [sm.windowsEndpoints, sm.androidEndpoints, sm.linuxEndpoints, sm.macEndpoints, sm.iosEndpoints, sm.networkEndpoints, sm.industrialEndpoints];
      for (const store of stores) {
        if (store.delete(id)) { res.status(204).send(); return; }
      }
      res.status(404).json({ error: 'Endpoint not found' });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/InstalledWindowsSoftware (P13.4.15)
  registerReadonlyList(app, profile, {
    path: '/v2.0/InstalledWindowsSoftware',
    entityType: 'installedWindowsSoftware',
    searchFields: ['displayName', 'publisher', 'version'],
    entityName: 'InstalledWindowsSoftware',
  });

  // P13.3.4 — Endpoints/{id}/MaintenanceWindow (GET/POST/PATCH/DELETE + PUT for 25R2)
  // Uses module-level Map for in-memory storage (mock singleton sub-resource)
  const endpointMaintenanceWindows: Map<string, Record<string, unknown>> = new Map();

  const defaultMW = (endpointId: string): Record<string, unknown> => ({
    id: `mw-endpoint-${endpointId}`,
    endpointId,
    maintenanceWindowDefinitionType: 'Everyday',
    startTime: '22:00:00',
    durationInMinutes: 120,
  });

  app.get('/v2.0/Endpoints/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const mw = endpointMaintenanceWindows.get(id) ?? defaultMW(id);
      res.status(200).json(mw);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/v2.0/Endpoints/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const mw = { ...defaultMW(id), ...(req.body as object) };
      endpointMaintenanceWindows.set(id, mw);
      res.status(201).json(mw);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH (26R1) and PUT (25R2) use same handler — P13.9.1
  const endpointMWUpdateHandler = (req: Request, res: Response): void => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const existing = endpointMaintenanceWindows.get(id) ?? defaultMW(id);
      const updated = { ...existing, ...(req.body as object) };
      endpointMaintenanceWindows.set(id, updated);
      res.status(200).json(updated);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  };
  // REQ-20.4.2: both PATCH (26R1 preferred) and PUT (25R2 alias) must be registered in all versions
  app.patch('/v2.0/Endpoints/:id/MaintenanceWindow', endpointMWUpdateHandler);
  app.put('/v2.0/Endpoints/:id/MaintenanceWindow', endpointMWUpdateHandler);

  app.delete('/v2.0/Endpoints/:id/MaintenanceWindow', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      const sm: StateManager | undefined = app.locals.stateManager;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      endpointMaintenanceWindows.delete(id);
      res.status(204).send();
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // P13.4.13 — Endpoints/{id}/EntraIdData GET/POST/DELETE (26R1 only)
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    const endpointEntraIdData: Map<string, Record<string, unknown>> = new Map();

    // GET /v2.0/Endpoints/:id/EntraIdData — returns EntraID data linked to the endpoint
    app.get('/v2.0/Endpoints/:id/EntraIdData', (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        if (!id) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
        // Check in-memory store first (written via POST), then fall back to fixture
        const inMemory = endpointEntraIdData.get(id);
        if (inMemory) { res.status(200).json(inMemory); return; }
        const fixtureData = profile.getFixture('entraIdData') as Record<string, unknown>[];
        const item = Array.isArray(fixtureData)
          ? fixtureData.find((e) => e['endpointId'] === id || e['id'] === id)
          : undefined;
        if (!item) { res.status(404).json({ error: 'EntraID data not found for endpoint' }); return; }
        res.status(200).json(item);
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });

    app.post('/v2.0/Endpoints/:id/EntraIdData', (req: Request, res: Response) => {
      try {
        const sm: StateManager | undefined = app.locals.stateManager;
        if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
        const id = req.params.id as string;
        if (!id) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
        const entry = { endpointId: id, ...(req.body as object) };
        endpointEntraIdData.set(id, entry);
        res.status(201).json(entry);
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });

    app.delete('/v2.0/Endpoints/:id/EntraIdData', (req: Request, res: Response) => {
      try {
        const sm: StateManager | undefined = app.locals.stateManager;
        if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
        const id = req.params.id as string;
        if (!id) { res.status(400).json({ error: 'Invalid endpoint ID' }); return; }
        endpointEntraIdData.delete(id);
        res.status(204).send();
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });
  }
}
