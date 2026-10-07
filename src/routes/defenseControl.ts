/**
 * DefenseControl routes — BitLocker, LocalAdministrativeAccounts, MicrosoftDefender.
 * Extracted from app.ts (P13.0.8). Extended P13.6.2–P13.6.4.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { BmsVersion } from '../profiles/ProfileManager';
import { applyMultiKeywordSearch, applyMultiFieldSort, parsePage, parsePageSize } from './utils';

export function registerDefenseControlRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/BitLocker/WindowsEndpoints
  app.get('/v2.0/BitLocker/WindowsEndpoints', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('bitLockerStates') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['endpointName', 'conversionStatus', 'protectionStatus']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/BitLocker/WindowsEndpoints/:id
  app.get('/v2.0/BitLocker/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('bitLockerStates') as Record<string, unknown>[];
      const item = data.find((s) => s['id'] === req.params.id || s['endpointId'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'BitLocker state not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/BitLocker/WindowsEndpoints/:id/Secrets (P13.6.2, 26R1 only)
  if (profile.bmsVersion === BmsVersion.BMS_26R1) {
    app.get('/v2.0/BitLocker/WindowsEndpoints/:id/Secrets', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const data = profile.getFixture('bitLockerSecrets') as Record<string, unknown>[];
        const item = data.find((s) => s['id'] === id || s['endpointId'] === id);
        if (!item) { res.status(404).json({ error: 'BitLocker secrets not found' }); return; }
        res.status(200).json(item);
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });

    // PATCH /v2.0/BitLocker/WindowsEndpoints/:id/Secrets (P13.6.2, 26R1 only)
    app.patch('/v2.0/BitLocker/WindowsEndpoints/:id/Secrets', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const data = profile.getFixture('bitLockerSecrets') as Record<string, unknown>[];
        const item = data.find((s) => s['id'] === id || s['endpointId'] === id);
        if (!item) { res.status(404).json({ error: 'BitLocker secrets not found' }); return; }
        res.status(200).json({ ...item, ...(req.body as object), updatedAt: new Date().toISOString() });
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
    });
  }

  // GET /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id (P13.6.3)
  app.get('/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = profile.getFixture('localAdminAccounts') as Record<string, unknown>[];
      const item = data.find((s) => s['id'] === id || s['endpointId'] === id);
      if (!item) { res.status(404).json({ error: 'Local administrative account not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id (P13.6.3)
  app.patch('/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = profile.getFixture('localAdminAccounts') as Record<string, unknown>[];
      const item = data.find((s) => s['id'] === id || s['endpointId'] === id);
      if (!item) { res.status(404).json({ error: 'Local administrative account not found' }); return; }
      res.status(200).json({ ...item, ...(req.body as object) });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/LocalAdminPasswords/Endpoint/:endpointId (B4)
  app.get('/v2.0/LocalAdminPasswords/Endpoint/:endpointId', (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;
      const data = profile.getFixture('localAdminAccounts') as Record<string, unknown>[];
      const item = data.find((s) => s['endpointId'] === endpointId);
      if (!item) { res.status(404).json({ error: 'Local admin passwords not found for endpoint' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MicrosoftDefender/Threats (P13.6.4)
  app.get('/v2.0/MicrosoftDefender/Threats', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('microsoftDefenderThreats') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'severity', 'category', 'status']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MicrosoftDefender/Threats/:id (P13.6.4)
  app.get('/v2.0/MicrosoftDefender/Threats/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microsoftDefenderThreats') as Record<string, unknown>[];
      const item = data.find((t) => t['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Threat not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MicrosoftDefender/WindowsEndpoints (P13.6.4)
  app.get('/v2.0/MicrosoftDefender/WindowsEndpoints', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('microsoftDefenderStates') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['endpointName', 'defenderStatus']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MicrosoftDefender/WindowsEndpoints/:id (P13.6.4)
  app.get('/v2.0/MicrosoftDefender/WindowsEndpoints/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('microsoftDefenderStates') as Record<string, unknown>[];
      const item = data.find((s) => s['id'] === req.params.id || s['endpointId'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Defender state not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
