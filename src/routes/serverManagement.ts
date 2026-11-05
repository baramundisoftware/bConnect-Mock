/**
 * ServerManagement routes — Microservices, ApiKeys (management since 26R2), DownloadJobs, Dips,
 * Gateway, ManagementServer, VpnAppliance, CloudConnectors, PxeRelays, Objects.
 * Extracted from app.ts (P13.0.8). Extended P13.7.2–P13.7.4.
 */

import { randomBytes } from 'crypto';
import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { GUID_REGEX, resolveEntityData, parsePage, parsePageSize } from './utils';
import { registerSingleton } from './factories/singleton';
import { sendNotFoundDetail } from '../middleware/bmsErrors';

/**
 * The version GET /v2.0/ManagementServer reports per simulated release. Clients detect the
 * bMS release from its first two parts (26.2 → 26R2, 26.1 → 26R1, 25.2 → 25R2; bConnect-MCP#159).
 * 26R1 is the value a live 26R1 returns. 26R2 is the build of the 26R2 release (MA); a live
 * pre-release 26R2 (26.2.110.0, probed 2026-11-05) answered the same format. The 25R2 value is
 * not confirmed on a live system.
 */
export const MANAGEMENT_SERVER_VERSIONS: Record<BmsVersion, string> = {
  [BmsVersion.BMS_25R2]: '25.2.0.0',
  [BmsVersion.BMS_26R1]: '26.1.161.0',
  [BmsVersion.BMS_26R2]: '26.2.137.0',
};

/** Used when a profile has no managementServer fixture: a bMS always has a management server. */
const DEFAULT_MANAGEMENT_SERVER = { name: 'BMS Management Server', state: 'Running', plannedServerRestartTimes: null };

/**
 * The version to report: BCONNECT_MANAGEMENT_SERVER_VERSION if set (to test how clients handle
 * an unknown or malformed version), otherwise the simulated release's version.
 */
export function managementServerVersion(bmsVersion: BmsVersion): string {
  const override = process.env.BCONNECT_MANAGEMENT_SERVER_VERSION?.trim();
  return override ? override : MANAGEMENT_SERVER_VERSIONS[bmsVersion];
}

/**
 * A list the spec answers as a plain array (CloudConnectors, Dips, Microservices, PxeRelays,
 * ApiKeys): the whole list, without the paged envelope, paging or search.
 */
function registerPlainList(app: Express, profile: IProfile, path: string, entityType: string): void {
  app.get(path, (_req: Request, res: Response) => {
    try {
      const resolved = resolveEntityData(profile, entityType, { page: 0, pageSize: 0 }, app.locals.stateManager);
      res.status(200).json(resolved ? resolved.data : []);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}

/** Entity types whose items have access rights (Objects/{id}/Rights) */
const RIGHTS_OBJECT_TYPES = [
  'windowsEndpoints', 'macEndpoints', 'linuxEndpoints', 'androidEndpoints', 'iosEndpoints', 'networkEndpoints', 'industrialEndpoints',
  'logicalGroups', 'staticGroups', 'dynamicGroups', 'universalDynamicGroups', 'jobs', 'jobFolders',
];

export function registerServerManagementRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/Microservices — a plain array in the spec (no paging, no search)
  registerPlainList(app, profile, '/v2.0/Microservices', 'microservices');

  // GET /v2.0/Microservices/:id
  app.get('/v2.0/Microservices/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microservices') as Record<string, unknown>[];
      const item = data.find((ms) => ms['id'] === req.params.id);
      // The live bMS's own wording for an unknown microservice (probe version 6, 2026-10-07)
      if (!item) { sendNotFoundDetail(res, 'Microservice not found', `Microservice with id [${String(req.params.id)}] not found.`); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Microservices/:id/Start
  app.post('/v2.0/Microservices/:id/Start', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microservices') as Record<string, unknown>[];
      const item = data.find((ms) => ms['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Microservice not found' }); return; }
      res.status(200).json({ message: `Microservice ${item['name']} started` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Microservices/:id/Stop
  app.post('/v2.0/Microservices/:id/Stop', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microservices') as Record<string, unknown>[];
      const item = data.find((ms) => ms['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Microservice not found' }); return; }
      res.status(200).json({ message: `Microservice ${item['name']} stopped` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Microservices/:id/Restart
  app.post('/v2.0/Microservices/:id/Restart', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microservices') as Record<string, unknown>[];
      const item = data.find((ms) => ms['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Microservice not found' }); return; }
      res.status(200).json({ message: `Microservice ${item['name']} restarting` });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // P13.7.2 — Singleton routes: Gateway, ManagementServer, VpnAppliance
  registerSingleton(app, profile, { path: '/v2.0/Gateway',          fixtureKey: 'gateway',          entityName: 'Gateway' });

  // ManagementServer: the spec's four fields; version follows the simulated release.
  const reportedVersion = managementServerVersion(profile.bmsVersion);
  app.get('/v2.0/ManagementServer', (_req: Request, res: Response) => {
    try {
      const fixture = profile.getFixture('managementServer') as Record<string, unknown>[];
      const base = (Array.isArray(fixture) && fixture[0]) || DEFAULT_MANAGEMENT_SERVER;
      res.status(200).json({
        name: base['name'] ?? DEFAULT_MANAGEMENT_SERVER.name,
        version: reportedVersion,
        state: base['state'] ?? DEFAULT_MANAGEMENT_SERVER.state,
        plannedServerRestartTimes: base['plannedServerRestartTimes'] ?? null,
      });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
  registerSingleton(app, profile, { path: '/v2.0/VpnAppliance',     fixtureKey: 'vpnAppliance',     entityName: 'VpnAppliance' });

  // P13.7.3 — CloudConnectors, PxeRelays, Dips: plain arrays in the spec (no paging, no search)
  registerPlainList(app, profile, '/v2.0/CloudConnectors', 'cloudConnectors');
  registerPlainList(app, profile, '/v2.0/Dips', 'dips');
  registerPlainList(app, profile, '/v2.0/PxeRelays', 'pxeRelays');


  // P13.7.4 — Objects/{id} PATCH + Objects/{id}/Rights GET
  app.patch('/v2.0/Objects/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      // Return patched object with merged body
      res.status(200).json({ id, ...(req.body as object) });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Objects/{id}/Rights — the spec's ObjectPermissions: each security profile's
  // permissions on a known object (endpoint, group, job, folder); an unknown object is a 404
  app.get('/v2.0/Objects/:id/Rights', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id).toLowerCase();
      let object: Record<string, unknown> | undefined;
      for (const entityType of RIGHTS_OBJECT_TYPES) {
        const data = profile.getFixture(entityType) as Record<string, unknown>[];
        object = data.find((o) => String(o['id']).toLowerCase() === id || String(o['guid']).toLowerCase() === id);
        if (object) { break; }
      }
      if (!object) { res.status(404).json({ error: 'Object not found' }); return; }
      const profiles = profile.getFixture('securityProfiles') as Record<string, unknown>[];
      res.status(200).json({
        objectId: object['id'] ?? object['guid'],
        objectName: object['name'] ?? object['displayName'],
        inheritRights: true,
        // The first profile has full control, the others read access
        securityProfilePermissions: profiles.map((p, i) => ({
          securityProfileId: p['id'], securityProfileName: p['name'], permissions: i === 0 ? ['Full'] : ['Read'],
        })),
      });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}

export function registerServerManagement26R1Routes(app: Express, profile: IProfile): void {

  // GET /v2.0/ApiKeys — a plain array in the spec (no paging, no search)
  registerPlainList(app, profile, '/v2.0/ApiKeys', 'apiKeys');

  // GET /v2.0/DownloadJobs
  app.get('/v2.0/DownloadJobs', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'downloadJobs', { searchQuery, page, pageSize, searchFields: ['name', 'stateValue', 'stateMessage'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'DownloadJobs not available' }); return; }
      const eff = pageSize;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/DownloadJobs/:id
  app.get('/v2.0/DownloadJobs/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('downloadJobs') as Record<string, unknown>[];
      const item = data.find((j) => j['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'DownloadJob not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /v2.0/Dips/SimulateMSWCleanup
  app.post('/v2.0/Dips/SimulateMSWCleanup', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'MSW cleanup simulation triggered' });
  });

  // POST /v2.0/Dips/MSWCleanup
  app.post('/v2.0/Dips/MSWCleanup', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'MSW cleanup triggered' });
  });
}

const API_KEY_FIELDS = ['name', 'expirationDate', 'comment', 'isActive', 'isAvailableViaGateway', 'securityProfiles'];

/** The reason an API key's values are not valid (ApiKeyForCreation's limits), if any */
function invalidApiKey(body: Record<string, unknown>): string | undefined {
  const { name, expirationDate, comment, securityProfiles } = body;
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 256)) { return 'The name must have 1 to 256 characters.'; }
  if (expirationDate !== undefined && expirationDate !== null && !(typeof expirationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expirationDate))) { return 'The expiration date must have the format yyyy-MM-dd.'; }
  if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > 4000)) { return 'The comment must have at most 4000 characters.'; }
  for (const flag of ['isActive', 'isAvailableViaGateway']) {
    if (body[flag] !== undefined && typeof body[flag] !== 'boolean') { return `${flag} must be true or false.`; }
  }
  if (securityProfiles !== undefined && !(Array.isArray(securityProfiles) && securityProfiles.length > 0 && securityProfiles.every((id) => typeof id === 'string' && GUID_REGEX.test(id)))) {
    return 'At least one security profile id is required.';
  }
  return undefined;
}

/**
 * API key management (since 26R2): get, create, update (JSON Patch), delete. A created key's
 * secret is answered once, by the POST, and never stored. Writes need a read-write profile.
 */
export function registerServerManagement26R2Routes(app: Express, profile: IProfile): void {
  const READ_ONLY = 'Write operations not supported in read-only profile mode';
  const keys = (): Record<string, unknown>[] =>
    (resolveEntityData(profile, 'apiKeys', { page: 0, pageSize: 0 }, app.locals.stateManager as StateManager | undefined)?.data ?? []) as Record<string, unknown>[];
  const store = (): ReturnType<StateManager['addStore']> | undefined => (app.locals.stateManager as StateManager | undefined)?.addStore('apiKeys', keys() as { id: string }[]);
  const find = (id: string): Record<string, unknown> | undefined => keys().find((k) => String(k['id']).toLowerCase() === id.toLowerCase());
  const nameTaken = (name: unknown, except?: unknown): boolean =>
    typeof name === 'string' && keys().some((k) => k['id'] !== except && String(k['name']).toLowerCase() === name.toLowerCase());

  app.get('/v2.0/ApiKeys/:id', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid API key ID format' }); return; }
      const key = find(id);
      if (!key) { res.status(404).json({ error: 'API key not found' }); return; }
      res.status(200).json(key);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/v2.0/ApiKeys', (req: Request, res: Response) => {
    try {
      const writable = store();
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body['name']) { res.status(400).json({ error: 'Missing required field: name' }); return; }
      const reason = invalidApiKey(body);
      if (reason) { res.status(400).json({ error: reason }); return; }
      if (nameTaken(body['name'])) { res.status(409).json({ error: `An API key with the name '${String(body['name'])}' already exists` }); return; }
      const created = writable.create({
        name: body['name'],
        expirationDate: body['expirationDate'] ?? null,
        comment: body['comment'] ?? '',
        isActive: body['isActive'] ?? true,
        isAvailableViaGateway: body['isAvailableViaGateway'] ?? false,
        securityProfiles: body['securityProfiles'] ?? [],
      });
      const { guid: _guid, ...key } = created;
      res.status(201).json({ ...key, apiKeySecret: randomBytes(32).toString('base64url') });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH — JSON Patch (converted to a plain object by app.ts) of the key's settings
  app.patch('/v2.0/ApiKeys/:id', (req: Request, res: Response) => {
    try {
      const writable = store();
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid API key ID format' }); return; }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const fixed = Object.keys(body).find((k) => !API_KEY_FIELDS.includes(k));
      if (fixed) { res.status(400).json({ error: `The field '${fixed}' of an API key cannot be modified.` }); return; }
      const reason = invalidApiKey(body);
      if (reason) { res.status(400).json({ error: reason }); return; }
      const key = find(id);
      if (!key) { res.status(404).json({ error: 'API key not found' }); return; }
      if (nameTaken(body['name'], key['id'])) { res.status(409).json({ error: `An API key with the name '${String(body['name'])}' already exists` }); return; }
      res.status(200).json(writable.patch(String(key['id']), body));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/v2.0/ApiKeys/:id', (req: Request, res: Response) => {
    try {
      const writable = store();
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid API key ID format' }); return; }
      const key = find(id);
      if (!key || !writable.delete(String(key['id']))) { res.status(404).json({ error: 'API key not found' }); return; }
      res.status(204).send();
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
