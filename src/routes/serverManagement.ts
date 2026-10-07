/**
 * ServerManagement routes — Microservices, ApiKeys, DownloadJobs, Dips,
 * Gateway, ManagementServer, VpnAppliance, CloudConnectors, PxeRelays, Objects.
 * Extracted from app.ts (P13.0.8). Extended P13.7.2–P13.7.4.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { resolveEntityData, parsePage, parsePageSize } from './utils';
import { registerSingleton } from './factories/singleton';

/**
 * The version GET /v2.0/ManagementServer reports per simulated release. Clients detect the
 * bMS release from its first two parts (26.1 → 26R1, 25.2 → 25R2; bConnect-MCP#159).
 * 26R1 is the value a live 26R1 returns; the 25R2 format is not yet confirmed on a live system.
 */
export const MANAGEMENT_SERVER_VERSIONS: Record<BmsVersion, string> = {
  [BmsVersion.BMS_25R2]: '25.2.0.0',
  [BmsVersion.BMS_26R1]: '26.1.161.0',
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
      const resolved = resolveEntityData(profile, entityType, { page: 0, pageSize: 0 });
      res.status(200).json(resolved ? resolved.data : []);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}

export function registerServerManagementRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/Microservices — a plain array in the spec (no paging, no search)
  registerPlainList(app, profile, '/v2.0/Microservices', 'microservices');

  // GET /v2.0/Microservices/:id
  app.get('/v2.0/Microservices/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microservices') as Record<string, unknown>[];
      const item = data.find((ms) => ms['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Microservice not found' }); return; }
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

  app.get('/v2.0/Objects/:id/Rights', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }
      res.status(200).json({
        objectId: id,
        rights: [
          { principal: 'Domain Admins', permission: 'FullControl', inherited: false },
          { principal: 'Domain Users', permission: 'Read', inherited: true },
        ],
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
      const resolved = resolveEntityData(profile, 'downloadJobs', { searchQuery, page, pageSize, searchFields: ['name', 'stateValue', 'stateMessage'] });
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
