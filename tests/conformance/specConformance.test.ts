/**
 * Spec conformance: every GET route of the 25R2, 26R1 and 26R2 specs is called against the mock
 * (strict routing, standard-readonly profile), and the answer is validated against the 200
 * response schema of the spec.
 *
 * Known differences are recorded in spec-conformance.baseline.json. The test fails on any
 * new difference, and on baseline entries that are fixed, so the baseline only shrinks.
 * After fixing differences, update the baseline: npm run spec-conformance:update
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { SpecValidator, type Schema } from './specValidator';
import type { Express } from 'express';

const SPECS = path.resolve(__dirname, '../../openapi-specs');
const BASELINE = path.resolve(__dirname, 'spec-conformance.baseline.json');
const VERSIONS: Array<[BmsVersion, string]> = [[BmsVersion.BMS_25R2, '25R2'], [BmsVersion.BMS_26R1, '26R1'], [BmsVersion.BMS_26R2, '26R2']];

interface SpecRoute { module: string; path: string; schema: Schema | undefined; validator: SpecValidator }

/** Every GET of a version's specs, with the schema of its 200 answer */
function specRoutes(dirName: string): SpecRoute[] {
  const routes: SpecRoute[] = [];
  for (const file of readdirSync(path.join(SPECS, dirName)).filter((f) => f.endsWith('.json')).sort()) {
    const spec = JSON.parse(readFileSync(path.join(SPECS, dirName, file), 'utf8')) as {
      paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }>>;
      components?: { schemas?: Record<string, Schema> };
    };
    const validator = new SpecValidator(spec.components?.schemas ?? {});
    const module = file.replace(/^bConnect_/, '').replace(/\.json$/, '').toLowerCase();
    for (const [specPath, ops] of Object.entries(spec.paths)) {
      const content = ops['get']?.responses?.['200']?.content;
      if (!ops['get']) { continue; }
      const schema = content ? (content['application/json'] ?? Object.values(content)[0])?.schema : undefined;
      routes.push({ module, path: specPath, schema, validator });
    }
  }
  return routes;
}

/**
 * Where to find an ID for a path parameter whose module has no parent list:
 * the list route of the entity the parameter names (logicalGroupId → LogicalGroups).
 */
const PARAM_LISTS: Record<string, string> = {
  endpointId: '/v2.0/Endpoints', adUserId: '/v2.0/ADUsers', adObjectId: '/v2.0/ADObjects',
  adGroupId: '/v2.0/ADGroups', orgUnitId: '/v2.0/OrgUnits',
};

/**
 * Parameters whose entity is ambiguous across modules (a folder of which kind, an Entra device,
 * a "Windows application"): no guessed ID, the route is reported as not checked instead.
 */
const NO_GUESS = new Set(['folderId', 'deviceId', 'windowsApplicationId', 'windowsJobDefinitionId']);

/**
 * Routes whose parameter must come from a specific list, as `/path` in the route's module or
 * `module /path` in another: rule violations exist only for iOS, Android and Mac endpoints, so the
 * first item of /v2.0/Endpoints (a Windows endpoint) answers 404; a Windows endpoint's local admin
 * account and an object's rights take the ID of an item another module lists.
 */
const ROUTE_ID_LISTS: Record<string, string> = {
  'compliance /v2.0/Endpoints/{endpointId}/DetectedRuleViolations': '/v2.0/DetectedRuleViolations',
  'defensecontrol /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/{id}': 'endpoints /v2.0/WindowsEndpoints',
  'servermanagement /v2.0/Objects/{id}/Rights': 'endpoints /v2.0/WindowsEndpoints',
  'universaldynamicgroups /v2.0/Folders/{folderId}/UniversalDynamicGroups': '/v2.0/UniversalDynamicGroupsFolder',
};

/** IDs for entities the specs have no list route for (fixtures/standard-readonly, standard-26r1) */
const FIXTURE_IDS: Record<string, string> = {
  staticGroupId: 'e1000001-0001-0001-0001-000000000001',
  dynamicGroupId: 'e2000001-0001-0001-0001-000000000001',
  universalDynamicGroupId: 'd0011111-0000-0000-0000-000000000001', // 25R2 lists no UDGs
  windowsApplicationId: 'ca000001-0001-0001-0001-000000000001',
  windowsJobDefinitionId: 'def00001-0001-0001-0001-000000000001',
  deviceId: 'a0000001-0001-0001-0001-000000000001', // an Entra device of standard-26r1
};

/** The list path for a parameter: an explicit one, or its name pluralized (logicalGroupId → /v2.0/LogicalGroups) */
function paramListPath(param: string): string | undefined {
  if (PARAM_LISTS[param]) { return PARAM_LISTS[param]; }
  if (!param.endsWith('Id') || param === 'id' || NO_GUESS.has(param)) { return undefined; }
  const name = param.slice(0, -2);
  return `/v2.0/${name.charAt(0).toUpperCase()}${name.slice(1)}s`;
}

/**
 * The ID to use for a parameter. The ID field comes from the spec's item schema of the list:
 * the field named like the parameter (endpointId), else id, else the entity's own ID field
 * (Assets → assetId), else endpointId or guid. A field the spec
 * doesn't define (a mock-only `id`) is never used, since a real client wouldn't know it.
 */
function itemId(item: unknown, param = 'id', specFields?: Set<string>, entityIdField?: string): string | undefined {
  const o = item as Record<string, unknown> | undefined;
  const all = [param, 'id', ...(entityIdField ? [entityIdField] : []), 'endpointId', 'guid'];
  const candidates = specFields ? all.filter((f) => specFields.has(f)) : all;
  const field = candidates.find((f) => typeof o?.[f] === 'string');
  return field ? (o?.[field] as string) : undefined;
}

/** The property names of a list route's items, from its spec schema (paged or plain array) */
function itemFields(route: SpecRoute | undefined): Set<string> | undefined {
  if (!route?.schema) { return undefined; }
  const list = route.validator.resolve(route.schema);
  const items = (list['properties'] as Record<string, Schema> | undefined)?.['data']?.['items'] ?? list['items'];
  const props = route.validator.resolve(items as Schema | undefined)['properties'] as Schema | undefined;
  return props ? new Set(Object.keys(props)) : undefined;
}

/**
 * Spec fields a live bMS leaves null on every item too, so the mock's null is right: keyed by
 * module and the list's last path segment (`*`: every list of the module). From a read-only probe
 * of a live 26R1 bMS (26.1.161.0, probe version 7, 2026-11-02: 32 endpoints, 20 of them Windows,
 * 5 Linux, 4 network, 2 Android, 1 Mac; 29 logical groups; 13 asset types, 66 job definitions,
 * 156 job instances, 122 installed software entries, 2 org units). Android, Mac and network
 * endpoints have no hardware inventory there.
 */
const LIVE_NULL: Record<string, readonly string[]> = {
  'endpoints *': ['assignedScannerId', 'assignedScannerName', 'registeredUserId'],
  'endpoints WindowsEndpoints': ['customState', 'ipNetworkId', 'ipNetworkName', 'logicalMAC', 'opcuaInformation'],
  'endpoints LinuxEndpoints': ['activity', 'comment', 'osVersionString', 'primarySubnetMask', 'opcuaInformation'],
  'endpoints AndroidEndpoints': ['availableRAM', 'category', 'cpu', 'hostName', 'macList', 'manufacturer', 'osVersionString', 'osVersionText', 'primaryIP', 'primaryMAC', 'primarySubnetMask', 'timeZone', 'totalRAM', 'uniqueDeviceId'],
  'endpoints MacEndpoints': ['category', 'osVersionString', 'patchLevel', 'uniqueDeviceId'],
  'endpoints NetworkEndpoints': ['activity', 'description', 'firstSeen', 'manufacturer', 'opcuaInformation', 'ouiVendor', 'registeredUser', 'snmpConfiguration', 'snmpName', 'snmpProperties', 'upTime', 'vendorId', 'webInterfaceUrl'],
  'endpoints LogicalGroups': ['defaultDomain'],
  'activedirectory OrgUnits': ['comment'],
  'assets *': ['contact'],
  'assets AssetTypes': ['additionalProperties', 'contact', 'costCenter', 'encodedIcon', 'inventoryNumber', 'summary'],
  'jobs JobDefinitions': ['validity'],
  'jobs JobInstances': ['nextExecution'],
  'software InstalledWindowsSoftware': ['autFirstUse', 'autLastData', 'autLastUse'],
  'servermanagement ManagementServer': ['plannedServerRestartTimes'], // no restart planned (26R1 and 26R2)
};

/**
 * Spec fields of a list's items that no item sets (missing or null in all of them). The
 * validator can't see these, since optional and nullable fields may be absent; but when no
 * item has a value, the mock's data usually names the field differently (#86: `name` for
 * `groupName`), and the strict projection drops it.
 */
function neverSet(route: SpecRoute, body: unknown): string[] {
  if (body && typeof body === 'object' && !Array.isArray(body) && !('data' in body) && !route.path.includes('{')) { return unsetFields(route, body as Record<string, unknown>); }
  const items = Array.isArray(body) ? body : (body as { data?: unknown } | undefined)?.data;
  const fields = itemFields(route);
  if (!Array.isArray(items) || items.length === 0 || !fields) { return []; }
  const prefix = Array.isArray(body) ? '[*]' : 'data[*]';
  const liveNull = new Set([...(LIVE_NULL[`${route.module} *`] ?? []), ...(LIVE_NULL[`${route.module} ${route.path.split('/').pop() ?? ''}`] ?? [])]);
  return [...fields].filter((f) => !liveNull.has(f))
    .filter((f) => items.every((i) => { const v = (i as Record<string, unknown> | null)?.[f]; return v === null || v === undefined; }))
    .map((f) => `${prefix}.${f}: never set`);
}

/**
 * Spec fields a single object (the gateway, the VPN appliance, ...) has no value for: a live bMS
 * answers every field of these (probe of a live 26R2, 2026-11-05)
 */
function unsetFields(route: SpecRoute, body: Record<string, unknown>): string[] {
  const props = route.schema ? route.validator.resolve(route.validator.resolve(route.schema))['properties'] as Schema | undefined : undefined;
  const liveNull = new Set(LIVE_NULL[`${route.module} ${route.path.split('/').pop() ?? ''}`] ?? []);
  return Object.keys(props ?? {}).filter((f) => !liveNull.has(f) && (body[f] === null || body[f] === undefined)).map((f) => `${f}: never set`);
}

/** All findings of one version, as baseline lines */
async function findings(app: Express, version: string, dirName: string, profileLabel = ''): Promise<string[]> {
  const routes = specRoutes(dirName);
  /** Modules that serve a parameter-free GET at a path, e.g. /v2.0/LogicalGroups → endpoints */
  const listModules = (listPath: string): string[] =>
    routes.filter((r) => r.path.toLowerCase() === listPath.toLowerCase()).map((r) => r.module);
  const lists = new Map<string, unknown>();
  const get = async (url: string): Promise<request.Response> => request(app).get(url);

  /** Fill each {param} with the first ID of the list at the path before it */
  const routeAt = (module: string, specPath: string): SpecRoute | undefined =>
    routes.find((r) => r.module === module && r.path.toLowerCase() === specPath.toLowerCase());
  const firstId = async (listUrl: string, param?: string, listRoute?: SpecRoute): Promise<string | undefined> => {
    if (!lists.has(listUrl)) { lists.set(listUrl, (await get(listUrl)).body); }
    const body = lists.get(listUrl) as { data?: unknown[] } | unknown[] | undefined;
    const entity = listUrl.split('/').pop() ?? '';
    const entityIdField = `${entity.charAt(0).toLowerCase()}${entity.slice(1).replace(/s$/, '')}Id`;
    return itemId(Array.isArray(body) ? body[0] : body?.data?.[0], param, itemFields(listRoute), entityIdField);
  };

  /** Fill each {param}: from the list before it in the same module, else from the list it names */
  const concretePath = async (module: string, specPath: string): Promise<string | undefined> => {
    let resolved = '';
    let specSoFar = '';
    for (const part of specPath.split(/(\{[^}]+\})/)) {
      if (!part.startsWith('{')) { resolved += part; specSoFar += part; continue; }
      const param = part.slice(1, -1);
      const parentSpec = specSoFar.replace(/\/$/, '');
      const source = ROUTE_ID_LISTS[`${module} ${specPath}`]?.split(' ');
      const [idModule, idList] = source?.length === 2 ? source : [module, source?.[0]];
      let id = idList
        ? await firstId(`/bconnect/${idModule}${idList}`, param, routeAt(idModule ?? module, idList))
        : await firstId(`/bconnect/${module}${resolved.replace(/\/$/, '')}`, param, routeAt(module, parentSpec));
      const named = paramListPath(param);
      for (const owner of id || !named ? [] : listModules(named)) {
        id = await firstId(`/bconnect/${owner}${named ?? ''}`, undefined, routeAt(owner, named ?? ''));
        if (id) { break; }
      }
      id ??= FIXTURE_IDS[param];
      if (!id) { return undefined; }
      resolved += id;
      specSoFar += part;
    }
    return resolved;
  };

  const out: string[] = [];
  for (const route of routes) {
    const label = `${version}${profileLabel} GET /${route.module}${route.path}`;
    const concrete = await concretePath(route.module, route.path);
    if (!concrete) { out.push(`${label} not checked: no ID in the parent list`); continue; }
    const res = await get(`/bconnect/${route.module}${concrete}`);
    if (res.status !== 200) { out.push(`${label} answered ${res.status}`); continue; }
    if (!route.schema) { continue; }
    for (const f of route.validator.validate(route.schema, res.body)) { out.push(`${label} ${f}`); }
    out.push(...neverSet(route, res.body).map((f) => `${label} ${f}`));
  }
  return out;
}

describe('Spec conformance of all GET answers', () => {
  const current: string[] = [];

  beforeAll(async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try {
      for (const [version, dirName] of VERSIONS) {
        const app = createApp(ProfileMode.STANDARD_READONLY, version);
        current.push(...await findings(app, version, dirName));
        // The large-scale profile serves generated data instead of fixtures
        const large = createApp(ProfileMode.LARGESCALE_READONLY, version);
        current.push(...await findings(large, version, dirName, ' largescale'));
      }
    } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
    current.sort();
    if (process.env.UPDATE_SPEC_BASELINE === '1') {
      writeFileSync(BASELINE, `${JSON.stringify([...new Set(current)], null, 2)}\n`);
    }
  }, 120_000);

  it('has no differences beyond the baseline', () => {
    const baseline = new Set(existsSync(BASELINE) ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as string[]) : []);
    const added = [...new Set(current)].filter((f) => !baseline.has(f));
    expect(added, 'new spec differences: fix them, or (if intended) run npm run spec-conformance:update').toEqual([]);
  });

  it('has no fixed differences left in the baseline', () => {
    const baseline = existsSync(BASELINE) ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as string[]) : [];
    const now = new Set(current);
    const fixed = baseline.filter((f) => !now.has(f));
    expect(fixed, 'fixed differences: remove them with npm run spec-conformance:update').toEqual([]);
  });
});
