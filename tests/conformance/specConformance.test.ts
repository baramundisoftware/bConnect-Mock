/**
 * Spec conformance: every GET route of the 25R2 and 26R1 specs is called against the mock
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
const VERSIONS: Array<[BmsVersion, string]> = [[BmsVersion.BMS_25R2, '25R2'], [BmsVersion.BMS_26R1, '26R1']];

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

/** IDs for entities the specs have no list route for (fixtures/standard-readonly) */
const FIXTURE_IDS: Record<string, string> = {
  staticGroupId: 'e1000001-0001-0001-0001-000000000001',
  dynamicGroupId: 'e2000001-0001-0001-0001-000000000001',
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
      let id = await firstId(`/bconnect/${module}${resolved.replace(/\/$/, '')}`, param, routeAt(module, parentSpec));
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
