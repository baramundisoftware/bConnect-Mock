#!/usr/bin/env node
/**
 * Generate the module route table from the OpenAPI specifications.
 *
 * A real bMS answers each route only under the module prefix whose spec declares it
 * (e.g. /bconnect/endpoints/v2.0/WindowsEndpoints). The mock's strict module routing
 * (src/middleware/moduleRouting.ts) uses this table to reject paths without a module
 * or under a module that does not own the route (issue #49).
 *
 * Usage:
 *   node scripts/generate-module-routes.js           # regenerate src/generated/moduleRoutes.ts
 *   node scripts/generate-module-routes.js --check   # exit 1 if the file is out of date
 *
 * Source:  $OPENAPI_BASE/{25R2,26R1}/bConnect_{Module}.json (default: ./openapi-specs/)
 * Output:  src/generated/moduleRoutes.ts
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OPENAPI_BASE = process.env.OPENAPI_BASE || path.join(PROJECT_ROOT, 'openapi-specs');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'generated', 'moduleRoutes.ts');
const VERSIONS = ['25R2', '26R1'];
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** The schema name a $ref points to, e.g. '#/components/schemas/LogicalGroupForCreation' → 'LogicalGroupForCreation' */
function refName(node) {
  const ref = JSON.stringify(node || {}).match(/"#\/components\/schemas\/([^"]+)"/);
  return ref ? ref[1] : undefined;
}

/**
 * The response shape of a schema, for projecting answers onto the spec's fields:
 *   0                 a leaf: keep the value as it is
 *   { o, z }          an object: o = its properties' shapes, z = the nullable ones
 *   { a }             an array of items of shape a
 * $ref and allOf are resolved; oneOf/anyOf, maps (additionalProperties as a schema) and
 * recursive references become leaves.
 */
function shapeOf(schema, schemas, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return 0;
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (seen.has(name)) return 0;
    return shapeOf(schemas[name], schemas, new Set([...seen, name]));
  }
  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((part) => shapeOf(part, schemas, seen)).filter((x) => x && x.o);
    const ownProps = schema.properties ? shapeOf({ ...schema, allOf: undefined }, schemas, seen) : 0;
    if (ownProps && ownProps.o) parts.push(ownProps);
    if (parts.length === 0) {
      const single = schema.allOf.length === 1 ? shapeOf(schema.allOf[0], schemas, seen) : 0;
      return single;
    }
    return { o: Object.assign({}, ...parts.map((x) => x.o)), z: [...new Set(parts.flatMap((x) => x.z || []))].sort() };
  }
  if (schema.oneOf || schema.anyOf) return 0;
  if (schema.type === 'array') return { a: shapeOf(schema.items, schemas, seen) };
  if (schema.properties) {
    const o = {};
    const z = [];
    for (const [name, prop] of Object.entries(schema.properties)) {
      o[name] = shapeOf(prop, schemas, seen);
      if (prop && prop.nullable === true) z.push(name);
    }
    return { o, z: z.sort() };
  }
  return 0;
}

/** The schema of an operation's first 2xx JSON answer, if any */
function responseSchema(op) {
  for (const [code, response] of Object.entries(op.responses || {}).sort()) {
    if (!code.startsWith('2')) continue;
    const content = response.content && (response.content['application/json'] || Object.values(response.content)[0]);
    if (content && content.schema) return content.schema;
  }
  return undefined;
}

/**
 * Build { version: { module: ['METHOD /v2.0/Path/{}', ...] } } and the details per route:
 * { version: { module: { 'METHOD /v2.0/Path/{}': { params: [names], body: schema } } } }.
 */
function buildTable() {
  const table = {};
  const details = {};
  const shapes = {};
  for (const version of VERSIONS) {
    const dir = path.join(OPENAPI_BASE, version);
    const modules = {};
    const moduleDetails = {};
    const moduleShapes = {};
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      // bConnect_Endpoints.json → endpoints (the URL module prefix is the lower-case name)
      const moduleName = file.replace(/^bConnect_/, '').replace(/\.json$/, '').toLowerCase();
      const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const routes = [];
      const routeDetails = {};
      const routeShapes = {};
      const schemas = (spec.components && spec.components.schemas) || {};
      for (const [specPath, ops] of Object.entries(spec.paths || {})) {
        const normalized = specPath.replace(/\{[^}]+\}/g, '{}');
        const params = [...specPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
        for (const [method, op] of Object.entries(ops)) {
          if (!METHODS.includes(method)) continue;
          const route = `${method.toUpperCase()} ${normalized}`;
          routes.push(route);
          const shape = shapeOf(responseSchema(op), schemas);
          if (shape) routeShapes[route] = shape;
          const body = refName(op.requestBody);
          if (params.length > 0 || body) {
            routeDetails[route] = { ...(params.length > 0 ? { params } : {}), ...(body ? { body } : {}) };
          }
        }
      }
      modules[moduleName] = [...new Set(routes)].sort();
      moduleDetails[moduleName] = Object.fromEntries(Object.entries(routeDetails).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
      moduleShapes[moduleName] = Object.fromEntries(Object.entries(routeShapes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    table[version.toLowerCase()] = modules;
    details[version.toLowerCase()] = moduleDetails;
    shapes[version.toLowerCase()] = moduleShapes;
  }
  return { table, details, shapes };
}

function render({ table, details, shapes }) {
  const lines = [
    '/**',
    ' * This file was auto-generated by scripts/generate-module-routes.js.',
    ' * Do not make direct changes to the file. Regenerate with: npm run generate-module-routes',
    ' *',
    ' * Routes each bConnect module declares in the OpenAPI specs, per bMS version.',
    ' * Path parameters are normalized to {}.',
    ' */',
    '',
    'export const MODULE_ROUTES: Record<string, Record<string, readonly string[]>> = {',
  ];
  for (const [version, modules] of Object.entries(table)) {
    lines.push(`  '${version}': {`);
    for (const [moduleName, routes] of Object.entries(modules)) {
      lines.push(`    ${moduleName}: [`);
      for (const route of routes) lines.push(`      '${route}',`);
      lines.push('    ],');
    }
    lines.push('  },');
  }
  lines.push('};', '');
  lines.push(
    '/** Path parameter names (all GUIDs in the specs) and request body schema of a route */',
    'export interface RouteDetail { readonly params?: readonly string[]; readonly body?: string }',
    '',
    '/** Details per route, keyed like MODULE_ROUTES (only routes with path parameters or a body) */',
    'export const ROUTE_DETAILS: Record<string, Record<string, Record<string, RouteDetail>>> = {',
  );
  for (const [version, modules] of Object.entries(details)) {
    lines.push(`  '${version}': {`);
    for (const [moduleName, routes] of Object.entries(modules)) {
      lines.push(`    ${moduleName}: {`);
      for (const [route, d] of Object.entries(routes)) {
        const parts = [];
        if (d.params) parts.push(`params: [${d.params.map((n) => `'${n}'`).join(', ')}]`);
        if (d.body) parts.push(`body: '${d.body}'`);
        lines.push(`      '${route}': { ${parts.join(', ')} },`);
      }
      lines.push('    },');
    }
    lines.push('  },');
  }
  lines.push('};', '');
  lines.push(
    '/**',
    ' * Response shape per route (first 2xx JSON answer): 0 = leaf, {o, z} = object with its',
    ' * properties and the nullable ones, {a} = array. Used to project answers onto the spec.',
    ' */',
    'export type ResponseShape = 0 | { readonly o: Readonly<Record<string, ResponseShape>>; readonly z: readonly string[] } | { readonly a: ResponseShape };',
    '',
    'export const RESPONSE_SHAPES: Record<string, Record<string, Record<string, ResponseShape>>> = {',
  );
  for (const [version, modules] of Object.entries(shapes)) {
    lines.push(`  '${version}': {`);
    for (const [moduleName, routes] of Object.entries(modules)) {
      lines.push(`    ${moduleName}: {`);
      for (const [route, shape] of Object.entries(routes)) lines.push(`      '${route}': ${JSON.stringify(shape)},`);
      lines.push('    },');
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

const output = render(buildTable());

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : '';
  if (current !== output) {
    console.error('src/generated/moduleRoutes.ts is out of date — run: npm run generate-module-routes');
    process.exit(1);
  }
  console.log('src/generated/moduleRoutes.ts is up to date');
} else {
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Wrote ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
}
