/**
 * Thresholds (since 26R2) — limits on the endpoint count of a universal dynamic group
 *
 * A threshold belongs to a universal dynamic group and a security profile: when the group's
 * endpoint count passes `value` (an upper or a lower limit, `type`), the profile's users get a
 * notification of `severity`. Routes: list (paged), per group, get, create, update (JSON Patch
 * of the modifiable values), delete. Writes need a read-write profile.
 *
 * The profile's thresholds are derived from its first universal dynamic groups and security
 * profiles (no fixture): two on the first group (a warning before the error), one each on a
 * few more. Values are fixed per group; formats from the 26R2 spec (no live 26R2 probed yet).
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import type { StateManager } from '../state/StateManager';
import { seedOf, guidOf } from '../profiles/seeded';
import { GUID_REGEX, resolveEntityData, parsePage, parsePageSize, applyMultiKeywordSearch, applyMultiFieldSort } from './utils';

type Item = Record<string, unknown>;

const SEVERITIES = ['Info', 'Warning', 'Error'];
const TYPES = ['UpperLimit', 'LowerLimit']; // Unknown is the spec's default, not a choice
const MODIFIABLE = ['value', 'type', 'severity', 'isActive', 'comment'];
/** The bMC user who set up the derived thresholds */
const MODIFIED_BY = 'CORP\\bmsadmin';

/** The derived thresholds: [group index, security profile index, severity, type, value, active, comment] */
const PLAN: ReadonlyArray<[number, number, string, string, number, boolean, string]> = [
  [0, 0, 'Warning', 'UpperLimit', 80, true, 'Warn before the license limit is reached'],
  [0, 1, 'Error', 'UpperLimit', 100, true, ''],
  [1, 0, 'Warning', 'UpperLimit', 25, true, 'More than 25 unpatched critical endpoints'],
  [2, 1, 'Info', 'LowerLimit', 5, false, ''],
  [3, 0, 'Error', 'UpperLimit', 250, true, ''],
];

const nameOf = (item: Item | undefined): string => String(item?.['name'] ?? item?.['displayName'] ?? '');

function all(app: Express, profile: IProfile, entityType: string): Item[] {
  return (resolveEntityData(profile, entityType, { page: 0, pageSize: 0 }, app.locals.stateManager as StateManager | undefined)?.data ?? []) as Item[];
}

const derived = new WeakMap<IProfile, Item[]>();

function deriveThresholds(app: Express, profile: IProfile): Item[] {
  const cached = derived.get(profile);
  if (cached) { return cached; }
  const groups = all(app, profile, 'universalDynamicGroups').slice(0, 4);
  const profiles = all(app, profile, 'securityProfiles');
  const thresholds = profiles.length === 0 ? [] : PLAN.filter(([g]) => groups[g]).map(([g, p, severity, type, value, isActive, comment], i) => {
    const group = groups[g] as Item;
    const securityProfile = profiles[p % profiles.length] as Item;
    return {
      id: guidOf(seedOf(group['id']), 40 + i),
      dynamicGroupId: group['id'],
      dynamicGroupName: nameOf(group),
      securityProfileId: securityProfile['id'],
      securityProfileName: nameOf(securityProfile),
      severity, type, value, isActive, comment,
      modifiedBy: MODIFIED_BY,
    };
  });
  derived.set(profile, thresholds);
  return thresholds;
}

/** The current thresholds: the store once written, the derived ones before */
function thresholds(app: Express, profile: IProfile): Item[] {
  const store = (app.locals.stateManager as StateManager | undefined)?.getStore('thresholds');
  return store ? (store.getAll() as Item[]) : deriveThresholds(app, profile);
}

/** The store of a read-write profile, seeded with the derived thresholds */
function store(app: Express, profile: IProfile): ReturnType<StateManager['addStore']> | undefined {
  const sm = app.locals.stateManager as StateManager | undefined;
  return sm?.addStore('thresholds', deriveThresholds(app, profile) as { id: string }[]);
}

/** The reason a threshold's modifiable values are not valid, if any */
function invalid(body: Item): string | undefined {
  const value = body['value'];
  if (value !== undefined && (!Number.isInteger(value) || (value as number) < 0)) { return 'The value must be an integer greater than or equal to zero.'; }
  if (body['type'] !== undefined && !TYPES.includes(body['type'] as string)) { return `The value '${String(body['type'])}' is not valid for type.`; }
  if (body['severity'] !== undefined && !SEVERITIES.includes(body['severity'] as string)) { return `The value '${String(body['severity'])}' is not valid for severity.`; }
  if (body['isActive'] !== undefined && typeof body['isActive'] !== 'boolean') { return 'isActive must be true or false.'; }
  if (body['comment'] !== undefined && body['comment'] !== null && typeof body['comment'] !== 'string') { return 'The comment must be a string.'; }
  return undefined;
}

const findById = (items: Item[], id: string): Item | undefined => items.find((i) => String(i['id']).toLowerCase() === id.toLowerCase());

function sendList(req: Request, res: Response, items: Item[]): void {
  let data = items;
  const searchQuery = req.query.SearchQuery as string | undefined;
  if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['dynamicGroupName', 'securityProfileName', 'comment']); }
  const orderBy = req.query.OrderBy as string | undefined;
  if (orderBy?.trim()) { data = applyMultiFieldSort(data, orderBy); }
  const pageSize = parsePageSize(req.query.PageSize);
  const page = parsePage(req.query.Page);
  res.status(200).json({ data: data.slice(page * pageSize, page * pageSize + pageSize), pageSize, page, totalItems: data.length });
}

const READ_ONLY = 'Write operations not supported in read-only profile mode';

export function registerThresholdRoutes(app: Express, profile: IProfile): void {

  app.get('/v2.0/Thresholds', (req: Request, res: Response) => {
    try { sendList(req, res, thresholds(app, profile)); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/v2.0/UniversalDynamicGroups/:dynamicGroupId/Thresholds', (req: Request, res: Response) => {
    try {
      const groupId = req.params['dynamicGroupId'] as string;
      if (!GUID_REGEX.test(groupId)) { res.status(400).json({ error: 'Invalid dynamic group ID format' }); return; }
      if (!findById(all(app, profile, 'universalDynamicGroups'), groupId)) { res.status(404).json({ error: 'Universal dynamic group not found' }); return; }
      sendList(req, res, thresholds(app, profile).filter((t) => String(t['dynamicGroupId']).toLowerCase() === groupId.toLowerCase()));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/v2.0/Thresholds/:id', (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid threshold ID format' }); return; }
      const item = findById(thresholds(app, profile), id);
      if (!item) { res.status(404).json({ error: 'Threshold not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/v2.0/Thresholds', (req: Request, res: Response) => {
    try {
      const writable = store(app, profile);
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const body = (req.body ?? {}) as Item;
      for (const field of ['dynamicGroupId', 'securityProfileId']) {
        if (!body[field]) { res.status(400).json({ error: `Missing required field: ${field}` }); return; }
        if (!GUID_REGEX.test(String(body[field]))) { res.status(400).json({ error: `Invalid ${field} format` }); return; }
      }
      const reason = invalid(body);
      if (reason) { res.status(400).json({ error: reason }); return; }
      const group = findById(all(app, profile, 'universalDynamicGroups'), String(body['dynamicGroupId']));
      if (!group) { res.status(404).json({ error: 'Universal dynamic group not found' }); return; }
      const securityProfile = findById(all(app, profile, 'securityProfiles'), String(body['securityProfileId']));
      if (!securityProfile) { res.status(404).json({ error: 'Security profile not found' }); return; }
      const taken = writable.getAll().some((t) => t['dynamicGroupId'] === group['id'] && t['securityProfileId'] === securityProfile['id']);
      if (taken) { res.status(409).json({ error: 'A threshold for this universal dynamic group and security profile already exists' }); return; }
      res.status(201).json(writable.create({
        dynamicGroupId: group['id'],
        dynamicGroupName: nameOf(group),
        securityProfileId: securityProfile['id'],
        securityProfileName: nameOf(securityProfile),
        severity: body['severity'] ?? 'Warning',
        value: body['value'] ?? 0,
        type: body['type'] ?? 'UpperLimit',
        isActive: body['isActive'] ?? true,
        comment: body['comment'] ?? '',
        modifiedBy: MODIFIED_BY,
      }));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // PATCH — JSON Patch (converted to a plain object by app.ts) of the modifiable values only
  app.patch('/v2.0/Thresholds/:id', (req: Request, res: Response) => {
    try {
      const writable = store(app, profile);
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid threshold ID format' }); return; }
      const body = (req.body ?? {}) as Item;
      const fixed = Object.keys(body).find((k) => !MODIFIABLE.includes(k));
      if (fixed) { res.status(400).json({ error: `The field '${fixed}' of a threshold cannot be modified.` }); return; }
      const reason = invalid(body);
      if (reason) { res.status(400).json({ error: reason }); return; }
      const existing = findById(writable.getAll() as Item[], id);
      if (!existing) { res.status(404).json({ error: 'Threshold not found' }); return; }
      res.status(200).json(writable.patch(String(existing['id']), { ...body, modifiedBy: MODIFIED_BY }));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/v2.0/Thresholds/:id', (req: Request, res: Response) => {
    try {
      const writable = store(app, profile);
      if (!writable) { res.status(403).json({ error: READ_ONLY }); return; }
      const id = req.params['id'] as string;
      if (!GUID_REGEX.test(id)) { res.status(400).json({ error: 'Invalid threshold ID format' }); return; }
      const existing = findById(writable.getAll() as Item[], id);
      if (!existing || !writable.delete(String(existing['id']))) { res.status(404).json({ error: 'Threshold not found' }); return; }
      res.status(204).send();
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
