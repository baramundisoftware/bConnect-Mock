/**
 * Update Management routes — /updatemanagement/v2.0/WindowsEndpoints
 *
 * Returns a "update projection" of Windows endpoints (update-specific fields only),
 * not the full endpoint object. The MCP client uses basePath '/updatemanagement/v2.0'.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { GUID_REGEX, resolveEntityData, parsePage, parsePageSize } from './utils';

/**
 * Deterministic hash from endpoint ID string → small integer for field generation.
 * Ensures the same endpoint always gets the same update status.
 */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Values from the spec's enums (UpdateState, UpdateDownloadMode, UpdateDownloadSource)
const UPDATE_STATES = ['NonCompliant', 'InventoryOutdated', 'NonCompliant', 'Unknown'] as const;
const UPDATE_PROFILES = ['Standard Security', 'Critical Only', 'Full Auto', null] as const;

/**
 * Cumulative updates an endpoint can be patched to (26R2): KB article and release day, newest
 * first. Synthetic numbers; the days are the Patch Tuesdays before the mock's date.
 */
const CUMULATIVE_UPDATES = [
  ['KB5071541', '2026-10-13T00:00:00Z'],
  ['KB5069825', '2026-09-08T00:00:00Z'],
  ['KB5068492', '2026-08-11T00:00:00Z'],
  ['KB5067113', '2026-07-14T00:00:00Z'],
] as const;

function cumulativeUpdate(state: string, isPatched: boolean, h: number): Record<string, unknown> {
  if (state === 'Unknown') { return { osUpdateVersion: null, osUpdateReleaseDate: null, requiredOSUpdateInstalled: 'Unknown' }; }
  const [kb, released] = CUMULATIVE_UPDATES[isPatched ? 0 : 1 + ((h >> 7) % (CUMULATIVE_UPDATES.length - 1))] ?? CUMULATIVE_UPDATES[0];
  return { osUpdateVersion: kb, osUpdateReleaseDate: released, requiredOSUpdateInstalled: isPatched ? 'Yes' : 'No' };
}

/** Project a full Windows endpoint record into the update management schema */
function toUpdateProjection(ep: Record<string, unknown>): Record<string, unknown> {
  const id = String(ep['id'] ?? ep['guid'] ?? '');
  const h = hashId(id);

  // ~40% fully patched, ~60% have missing updates
  const isPatched = h % 10 < 4;
  const missingCritical = isPatched ? 0 : (h % 5);
  const missingSecurity = isPatched ? 0 : ((h >> 3) % 8);
  const missingOther = isPatched ? 0 : ((h >> 6) % 12);
  const state = isPatched
    ? 'Compliant'
    : (UPDATE_STATES[(h >> 4) % UPDATE_STATES.length] as (typeof UPDATE_STATES)[number]);
  const profile = UPDATE_PROFILES[h % UPDATE_PROFILES.length] ?? null;

  // Deterministic dates: last inventory 0–30 days ago, last update 0–60 days ago
  const now = Date.now();
  const lastInvDays = h % 31;
  const lastUpdDays = isPatched ? (h % 14) : (h % 60 + 7);
  const lastInventory = new Date(now - lastInvDays * 86400000).toISOString();
  const lastSuccessfulUpdate = isPatched ? new Date(now - lastUpdDays * 86400000).toISOString() : null;

  return {
    endpointId: id,
    endpointName: ep['displayName'] ?? ep['hostName'],
    updateProfileId: profile ? `f5000000-0000-0000-0000-${String(UPDATE_PROFILES.indexOf(profile) + 1).padStart(12, '0')}` : null,
    updateProfileName: profile,
    missingCriticalUpdates: missingCritical,
    missingSecurityUpdates: missingSecurity,
    missingOtherUpdates: missingOther,
    updateDownloadMode: h % 3 === 0 ? 'HttpOnly' : h % 3 === 1 ? 'HttpBlendedWithPeeringBehindSameNat' : 'Unknown',
    lastInventory,
    lastInventorySource: h % 2 === 0 ? 'WSUS' : 'MicrosoftOnline',
    lastSuccessfulUpdate,
    lastSuccessfulUpdateSource: lastSuccessfulUpdate ? (h % 2 === 0 ? 'WSUS' : 'MicrosoftOnline') : 'Unknown',
    deferredUpdates: isPatched ? 0 : ((h >> 2) % 4),
    blockedUpdates: isPatched ? 0 : ((h >> 5) % 3),
    featureUpdatesAvailable: !isPatched && (h % 7 === 0),
    updateState: state,
    targetReleaseVersion: h % 4 === 0 ? '24H2' : h % 4 === 1 ? '23H2' : null,
    // 26R2: the cumulative update it is patched to (none known before an inventory), and
    // whether that is the one it should have: the newest for a patched endpoint
    ...cumulativeUpdate(state, isPatched, h),
  };
}

export function registerUpdateManagementRoutes(app: Express, profile: IProfile): void {

  // GET /updatemanagement/v2.0/WindowsEndpoints
  app.get('/updatemanagement/v2.0/WindowsEndpoints', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'windowsEndpoints', { searchQuery, orderBy, page, pageSize, searchFields: ['displayName', 'hostName'] }, app.locals.stateManager);
      if (!resolved) { res.status(404).json({ error: 'Windows endpoints not available' }); return; }
      const projections = (resolved.data as Record<string, unknown>[]).map(toUpdateProjection);
      const eff = pageSize;
      res.status(200).json({ data: projections, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /updatemanagement/v2.0/WindowsEndpoints/:id
  app.get('/updatemanagement/v2.0/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid endpoint ID format' }); return; }
      const resolved = resolveEntityData(profile, 'windowsEndpoints', { page: 0, pageSize: 0 }, app.locals.stateManager);
      const data = resolved ? (resolved.data as Record<string, unknown>[]) : [];
      const ep = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!ep) { res.status(404).json({ error: 'Windows endpoint not found' }); return; }
      res.status(200).json(toUpdateProjection(ep));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH /updatemanagement/v2.0/WindowsEndpoints/:id — assign/reset update profile
  app.patch('/updatemanagement/v2.0/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid endpoint ID format' }); return; }
      const resolved = resolveEntityData(profile, 'windowsEndpoints', { page: 0, pageSize: 0 }, app.locals.stateManager);
      const data = resolved ? (resolved.data as Record<string, unknown>[]) : [];
      const ep = data.find((e) => e['id'] === id || e['guid'] === id);
      if (!ep) { res.status(404).json({ error: 'Windows endpoint not found' }); return; }
      const merged = { ...ep, ...(req.body as Record<string, unknown>) };
      res.status(200).json(toUpdateProjection(merged));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
