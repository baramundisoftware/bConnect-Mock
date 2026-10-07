/**
 * ActiveDirectory routes — ADGroups, ADObjects, ADUsers.
 * Extracted from app.ts (P13.0.8). ADUsers added P13.4.3.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { resolveEntityData, applyMultiKeywordSearch, applyMultiFieldSort, parsePage, GUID_REGEX, parsePageSize } from './utils';
import { registerReadonlyList } from './factories/readonlyList';
import { registerGetById } from './factories/getById';
import { registerSubResourceList } from './factories/subResourceList';

export function registerActiveDirectoryRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/ADGroups
  app.get('/v2.0/ADGroups', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'adGroups', { searchQuery, orderBy, page, pageSize, searchFields: ['name', 'distinguishedName', 'groupType'] });
      const data = resolved?.data ?? [];
      const totalItems = resolved?.totalItems ?? 0;
      const eff = pageSize;
      res.status(200).json({ data, pageSize: eff, page, totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/ADGroups/:id
  app.get('/v2.0/ADGroups/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('adGroups') as Record<string, unknown>[];
      const item = data.find((g) => g['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'AD group not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/ADObjects
  app.get('/v2.0/ADObjects', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('adObjects') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['name', 'samAccountName', 'userPrincipalName']); }
      const orderBy = req.query.OrderBy as string | undefined;
      if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
      const pageSize = parsePageSize(req.query.PageSize);
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/ADObjects/:id
  app.get('/v2.0/ADObjects/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid GUID format' }); return; }
      const data = profile.getFixture('adObjects') as Record<string, unknown>[];
      const item = data.find((o) => o['id'] === id || o['guid'] === id);
      if (!item) { res.status(404).json({ error: 'AD object not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // ADUsers routes (P13.4.3)
  registerReadonlyList(app, profile, {
    path: '/v2.0/ADUsers',
    entityType: 'adUsers',
    searchFields: ['displayName', 'samAccountName', 'userPrincipalName', 'department', 'title'],
    entityName: 'ADUsers',
  });
  registerGetById(app, profile, {
    basePath: '/v2.0/ADUsers',
    entityType: 'adUsers',
    entityName: 'AD user',
  });

  // ADUsers sub-resource routes (P13.2.9)
  const adUserEndpointSubs: Array<{ childPath: string; childFixture: string; searchFields: string[] }> = [
    { childPath: 'WindowsEndpoints', childFixture: 'windowsEndpoints', searchFields: ['displayName', 'hostName', 'primaryIP', 'operatingSystem'] },
    { childPath: 'AndroidEndpoints', childFixture: 'androidEndpoints', searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'IosEndpoints',     childFixture: 'iosEndpoints',     searchFields: ['displayName', 'primaryIP'] },
    { childPath: 'LinuxEndpoints',   childFixture: 'linuxEndpoints',   searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'MacEndpoints',     childFixture: 'macEndpoints',     searchFields: ['displayName', 'hostName', 'primaryIP'] },
    { childPath: 'Endpoints',        childFixture: 'windowsEndpoints', searchFields: ['displayName', 'hostName', 'primaryIP'] },
  ];
  for (const sub of adUserEndpointSubs) {
    registerSubResourceList(app, profile, {
      parentPath: '/v2.0/ADUsers',
      childPath: sub.childPath,
      parentFixture: 'adUsers',
      childFixture: sub.childFixture,
      foreignKey: 'adUserId',
      searchFields: sub.searchFields,
      parentEntityName: 'AD user',
      childEntityName: sub.childPath.replace(/Endpoints$/, ' endpoint'),
    });
  }

  // OrgUnits routes (P13.4.4)
  registerReadonlyList(app, profile, {
    path: '/v2.0/OrgUnits',
    entityType: 'orgUnits',
    searchFields: ['name', 'distinguishedName'],
    entityName: 'OrgUnits',
  });
  registerGetById(app, profile, {
    basePath: '/v2.0/OrgUnits',
    entityType: 'orgUnits',
    entityName: 'Org unit',
  });
}
