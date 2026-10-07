/**
 * P13.0.5 — Full CRUD route factory.
 *
 * Extends and replaces `registerEntityWriteRoutes` from app.ts to include
 * GET list + GET by ID in addition to POST/PUT/PATCH/DELETE.
 *
 * Wraps the existing `registerEntityWriteRoutes` pattern for write operations
 * and adds read operations via the profile fixture path.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import type { StateManager } from '../../state/StateManager';
import { GUID_REGEX, resolveEntityData, parsePage, parsePageSize } from '../utils';

/** Minimal write interface required by the factory */
interface WritableEntityStore {
  getAll(): Record<string, unknown>[];
  getById(id: string): Record<string, unknown> | undefined;
  create(data: Record<string, unknown>): Record<string, unknown>;
  update(id: string, data: Record<string, unknown>): Record<string, unknown> | undefined;
  patch(id: string, data: Record<string, unknown>): Record<string, unknown> | undefined;
  delete(id: string): boolean;
}

export interface CrudRoutesConfig {
  /** Base path, e.g. '/v2.0/Variables' */
  basePath: string;
  /** Profile fixture/generator key, e.g. 'variables' */
  entityType: string;
  /** Human-readable name for error messages */
  entityName: string;
  /** Required field for create validation */
  requiredField: string;
  /** Fields to search against when SearchQuery is provided */
  searchFields: string[];
  /** Get the entity store from StateManager (for readwrite profiles) */
  getStore: (sm: StateManager) => WritableEntityStore;
  /** Validation middleware for create/PUT */
  validateCreate: RequestHandler;
  /** Validation middleware for PATCH */
  validatePatch: RequestHandler;
  /** Register PUT /:id in addition to PATCH /:id */
  hasPut?: boolean;
}

/**
 * Register full CRUD routes (GET list, GET /:id, POST, PUT?, PATCH, DELETE)
 * for a given entity collection.
 */
export function registerCrudRoutes(
  app: Express,
  profile: IProfile,
  config: CrudRoutesConfig
): void {
  const {
    basePath,
    entityType,
    entityName,
    requiredField,
    searchFields,
    getStore,
    validateCreate,
    validatePatch,
    hasPut = false,
  } = config;

  // GET list
  app.get(basePath, (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);

      const sm = app.locals.stateManager as StateManager | undefined;
      if (sm) {
        let data = getStore(sm).getAll();
        if (searchQuery?.trim()) {
          data = data.filter((item) =>
            searchFields.some((field) => {
              const val = item[field];
              return typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase());
            })
          );
        }
        const eff = pageSize;
        res.status(200).json({ data: data.slice(page * eff, page * eff + eff), pageSize: eff, page, totalItems: data.length });
        return;
      }

      const resolved = resolveEntityData(profile, entityType, {
        searchQuery,
        orderBy,
        page,
        pageSize,
        searchFields,
      });
      if (!resolved) {
        res.status(404).json({ error: `${entityName} not available` });
        return;
      }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /:id
  app.get(`${basePath}/:id`, (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!id || !GUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid GUID format' });
        return;
      }

      const sm = app.locals.stateManager as StateManager | undefined;
      if (sm) {
        const item = getStore(sm).getById(id as string);
        if (!item) { res.status(404).json({ error: `${entityName} not found` }); return; }
        res.status(200).json(item);
        return;
      }

      const data = profile.getFixture(entityType);
      if (!Array.isArray(data)) {
        res.status(404).json({ error: `${entityName} not found` });
        return;
      }
      const item = (data as Record<string, unknown>[]).find(
        (r) => r['id'] === id || r['guid'] === id
      );
      if (!item) { res.status(404).json({ error: `${entityName} not found` }); return; }
      res.status(200).json(item);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST — create
  app.post(basePath, validateCreate, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    if (!req.body[requiredField]) { res.status(400).json({ error: `Missing required field: ${requiredField}` }); return; }
    res.status(201).json(getStore(sm).create(req.body as Record<string, unknown>));
  });

  // PUT — full replace (optional)
  if (hasPut) {
    app.put(`${basePath}/:id`, validateCreate, (req: Request, res: Response) => {
      const sm = app.locals.stateManager as StateManager | undefined;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params['id'] as string;
      if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const updated = getStore(sm).update(id, req.body as Record<string, unknown>);
      if (!updated) { res.status(404).json({ error: `${entityName} not found` }); return; }
      res.status(200).json(updated);
    });
  }

  // PATCH — partial update
  app.patch(`${basePath}/:id`, validatePatch, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params['id'] as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    const updated = getStore(sm).patch(id, req.body as Record<string, unknown>);
    if (!updated) { res.status(404).json({ error: `${entityName} not found` }); return; }
    res.status(200).json(updated);
  });

  // DELETE
  app.delete(`${basePath}/:id`, (req: Request, res: Response) => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
    const id = req.params['id'] as string;
    if (!id || !GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
    if (!getStore(sm).delete(id)) { res.status(404).json({ error: `${entityName} not found` }); return; }
    res.status(204).send();
  });
}
