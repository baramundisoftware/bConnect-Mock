/**
 * Operating Systems routes — /operatingsystems/v2.0/Folders and /operatingsystems/v2.0/WindowsEndpoints
 *
 * Same paths as in the jobs and endpoints modules, but the operatingsystems spec defines its
 * own data: OS folders, and an "OS projection" of Windows endpoints (7 OS-installation fields)
 * instead of the full endpoint object (#53). Like updateManagement.ts, the routes are
 * registered with their module prefix; app.ts does not strip it for these paths.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { GUID_REGEX, applyMultiKeywordSearch, applyMultiFieldSort, parsePage } from './utils';
import { validateGenericUpdate } from '../middleware/validateBody';
import { registerFolderRoutes } from './misc';

const BASE = '/operatingsystems/v2.0';

/** The OS settings a PATCH may change; the other fields are reported by the endpoint. */
const WRITABLE_FIELDS = ['bootEnvironmentId', 'hardwareProfileId', 'isOSInstallAllowed', 'inheritsAutoInstallation'] as const;

/** State-store key for PATCHed OS settings, keyed by endpoint id (reset by /api/reset) */
const SETTINGS_STORE = 'osWindowsEndpointSettings';

/** Windows build per feature update (Windows 11 / Windows 10 / Server) */
const BUILDS: Record<string, number> = {
  '11:24H2': 26100, '11:23H2': 22631, '11:22H2': 22621, '11:21H2': 22000,
  '10:22H2': 19045, '10:21H2': 19044, '10:21H1': 19043,
  'Server 2025': 26100, 'Server 2022': 20348, 'Server 2019': 17763,
};

/** Deterministic hash from endpoint ID string → small integer for field generation */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** A stable GUID derived from the endpoint id, so the same endpoint keeps the same profile ids */
function derivedGuid(prefix: string, h: number): string {
  return `${prefix}${String(h % 10000).padStart(4, '0')}-0000-0000-0000-000000000001`;
}

/** Parse the fixture's OS string ("Microsoft Windows 11 Enterprise 23H2") into the spec's WindowsOperatingSystem */
function toOperatingSystem(osName: unknown, h: number): Record<string, unknown> | null {
  if (typeof osName !== 'string' || !osName.trim()) { return null; }
  const displayVersion = /\b(\d{2}H\d)\b/.exec(osName)?.[1] ?? null;
  const windows = /Windows (11|10)\b/.exec(osName)?.[1];
  const server = /Windows (Server \d{4})/.exec(osName)?.[1];
  const build = (server ? BUILDS[server] : windows && displayVersion ? BUILDS[`${windows}:${displayVersion}`] : undefined) ?? 0;
  const patchLevel = build ? 1000 + (h % 4000) : 0;
  return {
    name: osName,
    version: { full: `10.0.${build}.${patchLevel}`, major: 10, minor: 0, build, patchLevel },
    displayVersion,
    releaseId: displayVersion,
    localeId: h % 3 === 0 ? 1031 : 1033, // de-DE / en-US
  };
}

/** Project a full Windows endpoint record into the operatingsystems WindowsEndpoint schema */
function toOsProjection(ep: Record<string, unknown>): Record<string, unknown> {
  const id = String(ep['id'] ?? ep['guid'] ?? '');
  const h = hashId(id);
  return {
    endpointId: id,
    endpointName: ep['displayName'] ?? ep['hostName'] ?? null,
    bootEnvironmentId: h % 4 === 0 ? null : derivedGuid('be00', h),
    hardwareProfileId: h % 5 === 0 ? null : derivedGuid('ab00', h >> 3),
    isOSInstallAllowed: h % 3 !== 0,
    inheritsAutoInstallation: h % 2 === 0,
    operatingSystem: toOperatingSystem(ep['operatingSystem'], h),
  };
}

export function registerOperatingSystemsRoutes(app: Express, profile: IProfile): void {

  // Folders: the spec's folder routes over the OS folders
  registerFolderRoutes(app, profile, { basePath: `${BASE}/Folders`, fixtureKey: 'osFolders' });

  const endpoints = (): Record<string, unknown>[] => {
    const sm = app.locals.stateManager as StateManager | undefined;
    if (sm) { return sm.windowsEndpoints.getAll() as Record<string, unknown>[]; }
    const fixture = profile.getFixture('windowsEndpoints');
    const data = typeof fixture === 'function' ? fixture() : fixture;
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  };

  /** The projection with any PATCHed settings applied */
  const projection = (ep: Record<string, unknown>): Record<string, unknown> => {
    const base = toOsProjection(ep);
    const sm = app.locals.stateManager as StateManager | undefined;
    const saved = sm?.addStore(SETTINGS_STORE).getById(String(base['endpointId']));
    if (!saved) { return base; }
    const overrides = Object.fromEntries(WRITABLE_FIELDS.filter((f) => f in saved).map((f) => [f, saved[f]]));
    return { ...base, ...overrides };
  };

  const findEndpoint = (id: string): Record<string, unknown> | undefined =>
    endpoints().find((e) => e['id'] === id || e['guid'] === id);

  // GET /operatingsystems/v2.0/WindowsEndpoints
  app.get(`${BASE}/WindowsEndpoints`, (req: Request, res: Response) => {
    try {
      let data = endpoints().map(projection);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['endpointName']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
      const page = parsePage(req.query.Page);
      res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /operatingsystems/v2.0/WindowsEndpoints/:id
  app.get(`${BASE}/WindowsEndpoints/:id`, (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid endpoint ID format' }); return; }
      const ep = findEndpoint(id);
      if (!ep) { res.status(404).json({ error: 'Windows endpoint not found' }); return; }
      res.status(200).json(projection(ep));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH /operatingsystems/v2.0/WindowsEndpoints/:id — change the endpoint's OS settings
  app.patch(`${BASE}/WindowsEndpoints/:id`, validateGenericUpdate, (req: Request, res: Response) => {
    try {
      const sm = app.locals.stateManager as StateManager | undefined;
      if (!sm) { res.status(403).json({ error: 'Write operations not supported in read-only profile mode' }); return; }
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid endpoint ID format' }); return; }
      const ep = findEndpoint(id);
      if (!ep) { res.status(404).json({ error: 'Windows endpoint not found' }); return; }
      const body = req.body as Record<string, unknown>;
      const readOnly = Object.keys(body).filter((k) => !(WRITABLE_FIELDS as readonly string[]).includes(k));
      if (readOnly.length > 0) {
        res.status(400).json({ error: `Field(s) can't be changed: ${readOnly.join(', ')}. Writable: ${WRITABLE_FIELDS.join(', ')}` });
        return;
      }
      const store = sm.addStore(SETTINGS_STORE);
      if (store.getById(id)) { store.patch(id, body); } else { store.create({ ...body, id, guid: id }); }
      res.status(200).json(projection(ep));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
