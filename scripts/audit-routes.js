#!/usr/bin/env node
/**
 * Route Audit Script
 *
 * Compares routes registered in the mock Express app against the OpenAPI
 * specifications for both 26R1 and 25R2, then regenerates:
 *   - docs/archive/bConnectMockImplementationStatus.md   (26R1)
 *   - docs/archive/bConnectMockImplementationStatus_25R2.md (25R2)
 *
 * Usage:
 *   node scripts/audit-routes.js           # full audit + regenerate docs
 *   node scripts/audit-routes.js --check   # audit only, exit 1 if regressions
 *   node scripts/audit-routes.js --json    # print raw JSON summary to stdout
 *
 * Requirements:
 *   - npm run build must have been run first (reads from ./build/)
 *   - OpenAPI specs in $OPENAPI_BASE/{25R2,26R1}/ (set env var, or place in ./openapi-specs/)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const OPENAPI_BASE  = process.env.OPENAPI_BASE || path.join(PROJECT_ROOT, 'openapi-specs');
const BUILD_DIR     = path.join(PROJECT_ROOT, 'build');

/** Map: spec file basename (no .json) → category label used in the status doc */
const SPEC_CATEGORY_26R1 = {
  activedirectory:       'activedirectory',
  assets:                'assets',
  compliance:            'compliance',
  defensecontrol:        'defensecontrol',
  endpoints:             'endpoints',
  jobs:                  'jobs',
  operatingsystems:      'operatingsystems',
  servermanagement:      'servermanagement',
  software:              'software',
  universaldynamicgroups:'universaldynamicgroups',
  updatemanagement:      'updatemanagement',
  variables:             'variables',
};

const SPEC_CATEGORY_25R2 = {
  bConnect_ActiveDirectory: 'activedirectory',
  bConnect_Assets:          'assets',
  bConnect_DefenseControl:  'defensecontrol',
  bConnect_Endpoints:       'endpoints',
  bConnect_Jobs:            'jobs',
  bConnect_OperatingSystems:'operatingsystems',
  bConnect_ServerManagement:'servermanagement',
  bConnect_Software:        'software',
  bConnect_UpdateManagement:'updatemanagement',
  bConnect_Variables:       'variables',
};

// ─────────────────────────────────────────────────────────────────────────────
// Phantom route annotations
//
// Maps normalised "METHOD /path" keys to a human-readable reason string.
// Routes not listed here receive the fallback label "Unknown — needs review".
// Key format: uppercase method + space + normalised path ({_} for any param).
// ─────────────────────────────────────────────────────────────────────────────

const PHANTOM_REASONS = {
  // ── Internal / test-helper routes ────────────────────────────────────────
  'POST /api/reset':
    'Internal: resets readwrite profile state to initial fixtures',
  'GET /metrics':
    'Internal: lightweight request counters for observability (uptime, totalRequests, by method/status)',

  // ── Legacy aliases (backwards compatibility) ──────────────────────────────
  'GET /v2.0/DynamicGroups':
    'Alias: legacy name for UniversalDynamicGroups collection',
  'GET /v2.0/DynamicGroups/{_}':
    'Alias: legacy name for UniversalDynamicGroups by ID',
  'GET /v2.0/StaticGroups':
    'Alias: legacy name for ActiveDirectory static groups collection',
  'GET /v2.0/StaticGroups/{_}':
    'Alias: legacy name for ActiveDirectory static group by ID',
  'POST /v2.0/StaticGroups':
    'Readwrite extension: write operations on StaticGroups (not defined in spec)',
  'DELETE /v2.0/StaticGroups/{_}':
    'Readwrite extension: write operations on StaticGroups (not defined in spec)',
  'PATCH /v2.0/StaticGroups/{_}':
    'Readwrite extension: write operations on StaticGroups (not defined in spec)',

  // ── MaintenanceWindow verb aliases (PUT↔PATCH across BMS versions) ──────────
  // 25R2 spec uses PUT; 26R1 spec uses PATCH. Both verbs registered unconditionally
  // (REQ-20.4.2) so the non-native verb appears as phantom in each version's audit.
  'PUT /v2.0/Endpoints/{_}/MaintenanceWindow':
    '25R2 native verb: PUT is the 25R2 spec verb; appears as phantom in 26R1 audit (REQ-20.1.1)',
  'PUT /v2.0/LogicalGroups/{_}/MaintenanceWindow':
    '25R2 native verb: PUT is the 25R2 spec verb; appears as phantom in 26R1 audit (REQ-20.1.2)',
  'PATCH /v2.0/Endpoints/{_}/MaintenanceWindow':
    '26R1 native verb: PATCH is the 26R1 spec verb; appears as phantom in 25R2 audit (REQ-20.1.1)',
  'PATCH /v2.0/LogicalGroups/{_}/MaintenanceWindow':
    '26R1 native verb: PATCH is the 26R1 spec verb; appears as phantom in 25R2 audit (REQ-20.1.2)',

  // ── Full-replace PUT added for readwrite profile (spec only defines PATCH) ─
  'PUT /v2.0/AndroidEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/Assets/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/IndustrialEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/IosEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/LinuxEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/MacEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/NetworkEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',
  'PUT /v2.0/WindowsEndpoints/{_}':
    'Readwrite extension: full-replace PUT; spec only defines PATCH',

  // ── Write operations for entities the spec treats as read-only ────────────
  'POST /v2.0/JobDefinitions':
    'Readwrite extension: spec treats JobDefinitions as read-only',
  'DELETE /v2.0/JobDefinitions/{_}':
    'Readwrite extension: spec treats JobDefinitions as read-only',
  'PATCH /v2.0/JobDefinitions/{_}':
    'Readwrite extension: spec treats JobDefinitions as read-only',
  'PUT /v2.0/JobDefinitions/{_}':
    'Readwrite extension: spec treats JobDefinitions as read-only',

  // ── Variables: top-level collection (spec scopes variables under endpoints) ─
  'GET /v2.0/Variables':
    'Extension: top-level list; spec scopes variables under endpoint-specific paths',
  'POST /v2.0/Variables':
    'Extension: top-level create; spec scopes variables under endpoint-specific paths',
  'DELETE /v2.0/Variables/{_}':
    'Extension: top-level delete; spec scopes variables under endpoint-specific paths',
  'PATCH /v2.0/Variables/{_}':
    'Extension: top-level patch; spec scopes variables under endpoint-specific paths',
  'PUT /v2.0/Variables/{_}':
    'Extension: top-level replace; spec scopes variables under endpoint-specific paths',

  // ── Misc extensions not covered by any spec category mapping ─────────────
  'GET /v2.0/BundleApplications/{_}':
    'Extension: BundleApplications by ID; not present in UDG spec by-ID path',
  'GET /v2.0/EntraIdData':
    'Extension: Entra ID / Azure AD sync data; no dedicated spec file',
  'GET /v2.0/OSFolders':
    'Extension: OS folder structure collection; not mapped to a spec category',
  'GET /v2.0/OSFolders/{_}':
    'Extension: OS folder by ID; not mapped to a spec category',
  'GET /v2.0/Software':
    'Extension: top-level software list; spec uses /v2.0/Software/{type} sub-paths',
  'GET /v2.0/WindowsUpdates':
    'Extension: Windows Update data; not in the UpdateManagement spec category',
};

const PHANTOM_REASON_FALLBACK = 'Unknown — needs review';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively extract { method, path } from Express router stack.
 * Handles nested routers.
 */
function extractExpressRoutes(stack) {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method: method.toUpperCase(),
          path:   layer.route.path,
        });
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      routes.push(...extractExpressRoutes(layer.handle.stack));
    }
  }
  return routes;
}

/**
 * Convert Express route path (:param) to OpenAPI-style ({param}).
 * E.g. /v2.0/ADGroups/:id  →  /v2.0/ADGroups/{id}
 */
function expressPathToOpenApi(p) {
  return p.replace(/:([^/]+)/g, '{$1}');
}

/**
 * Normalise all path-parameter names to a canonical placeholder {_}.
 * This allows {id}, {adGroupId}, {parentId} etc. to all compare equal.
 * E.g. /v2.0/ADGroups/{adGroupId}  →  /v2.0/ADGroups/{_}
 */
function normalisePath(p) {
  return p.replace(/\{[^}]+\}/g, '{_}');
}

/**
 * Build a Set of normalised "METHOD /path" strings from Express app routes.
 * Normalises Express :param  →  {param}  →  {_} for comparison with OpenAPI paths.
 */
function buildMockRouteSet(app) {
  const raw = extractExpressRoutes(app.router.stack);
  const set = new Set();
  for (const { method, path: p } of raw) {
    const normalised = normalisePath(expressPathToOpenApi(p));
    set.add(`${method} ${normalised}`);
  }
  return set;
}

/**
 * Parse all OpenAPI JSON files in a directory.
 * Returns array of { category, method, path } objects, sorted by path then method.
 */
function parseOpenApiSpec(specDir, categoryMap) {
  const routes = [];
  for (const file of fs.readdirSync(specDir).filter(f => f.endsWith('.json')).sort()) {
    const base     = path.basename(file, '.json');
    const category = categoryMap[base];
    if (!category) {
      console.warn(`  ⚠️  No category mapping for "${file}" — skipping`);
      continue;
    }
    const spec  = JSON.parse(fs.readFileSync(path.join(specDir, file), 'utf8'));
    const paths = spec.paths || {};
    for (const [apiPath, pathItem] of Object.entries(paths)) {
      const HTTP_METHODS = ['get','post','put','patch','delete','head','options'];
      for (const method of HTTP_METHODS) {
        if (pathItem[method]) {
          routes.push({ category, method: method.toUpperCase(), path: apiPath });
        }
      }
    }
  }
  // Stable sort: category → path → method
  routes.sort((a, b) =>
    a.category.localeCompare(b.category) ||
    a.path.localeCompare(b.path) ||
    a.method.localeCompare(b.method)
  );
  return routes;
}

/**
 * Compute audit result: annotate each OpenAPI route as OK or MISSING.
 * Also detect extra routes in mock not in spec (phantom routes).
 */
function auditRoutes(specRoutes, mockSet) {
  const annotated = specRoutes.map(r => ({
    ...r,
    status: mockSet.has(`${r.method} ${normalisePath(r.path)}`) ? 'OK' : 'MISSING',
  }));

  // Phantom = in mock but not in any spec (after normalisation)
  const specSet = new Set(specRoutes.map(r => `${r.method} ${normalisePath(r.path)}`));
  const phantoms = [];
  for (const key of mockSet) {
    if (!specSet.has(key) && !key.startsWith('GET /health') && !key.includes('/api-docs')) {
      const [method, ...pathParts] = key.split(' ');
      const normPath = pathParts.join(' ');
      const reason = PHANTOM_REASONS[`${method} ${normPath}`] ?? PHANTOM_REASON_FALLBACK;
      phantoms.push({ method, path: normPath, reason });
    }
  }
  phantoms.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  return { annotated, phantoms };
}

/**
 * Build coverage summary by category.
 */
function buildSummary(annotated) {
  const byCategory = {};
  for (const r of annotated) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, ok: 0, missing: 0 };
    byCategory[r.category].total++;
    if (r.status === 'OK') byCategory[r.category].ok++;
    else byCategory[r.category].missing++;
  }

  const total     = annotated.length;
  const ok        = annotated.filter(r => r.status === 'OK').length;
  const missing   = total - ok;
  const coverage  = total > 0 ? Math.round((ok / total) * 100) : 0;

  return { total, ok, missing, coverage, byCategory };
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown generator
// ─────────────────────────────────────────────────────────────────────────────

function generateMarkdown(version, summary, annotated, phantoms) {
  const today = new Date().toISOString().slice(0, 10);
  const lines  = [];

  lines.push(`# bConnect Mock V2.0 - Implementation Status (${version})`);
  lines.push('');
  lines.push(`Generated: ${today}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total API endpoints (${version}) | ${summary.total} |`);
  lines.push(`| Implemented in mock | ${summary.ok} |`);
  lines.push(`| Missing from mock | ${summary.missing} |`);
  lines.push(`| Coverage | ${summary.coverage}% |`);
  lines.push('');
  lines.push('### Coverage by API Category');
  lines.push('');
  lines.push('| Category | Total | Implemented | Missing | Coverage |');
  lines.push('|----------|-------|-------------|---------|----------|');
  for (const [cat, s] of Object.entries(summary.byCategory).sort()) {
    const pct = s.total > 0 ? Math.round((s.ok / s.total) * 100) : 0;
    lines.push(`| ${cat} | ${s.total} | ${s.ok} | ${s.missing} | ${pct}% |`);
  }

  lines.push('');
  lines.push('## Detailed Endpoint Status');
  lines.push('');

  // Group by category
  const categories = [...new Set(annotated.map(r => r.category))].sort();
  for (const cat of categories) {
    lines.push(`### ${cat}`);
    lines.push('');
    lines.push('| Status | Method | Path |');
    lines.push('|--------|--------|------|');
    for (const r of annotated.filter(x => x.category === cat)) {
      const icon = r.status === 'OK' ? '+ OK' : '- MISSING';
      lines.push(`| ${icon} | ${r.method} | \`${r.path}\` |`);
    }
    lines.push('');
  }

  if (phantoms.length > 0) {
    lines.push('## Phantom Routes (in mock but NOT in OpenAPI spec)');
    lines.push('');
    lines.push('These routes are implemented but have no matching spec entry.');
    lines.push('The **Reason** column explains why each route exists.');
    lines.push('');
    lines.push('| Method | Path | Reason |');
    lines.push('|--------|------|--------|');
    for (const r of phantoms) {
      lines.push(`| ${r.method} | \`${r.path}\` | ${r.reason} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Auto-generated by \`scripts/audit-routes.js\` — do not edit manually.*`);
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const jsonMode  = args.includes('--json');

  // ── 1. Verify build exists ───────────────────────────────────────────────
  if (!fs.existsSync(path.join(BUILD_DIR, 'app.js'))) {
    console.error('❌ build/app.js not found — run "npm run build" first');
    process.exit(1);
  }

  // ── 2. Load built app to extract registered routes ──────────────────────
  // In JSON mode, redirect progress output to stderr so stdout is pure JSON.
  const log = jsonMode ? (...a) => process.stderr.write(a.join('')) : process.stdout.write.bind(process.stdout);
  const logln = jsonMode ? (...a) => console.error(...a) : console.log.bind(console);

  log('Loading mock app (26R1)... ');
  const { createApp } = require(path.join(BUILD_DIR, 'app.js'));
  const { ProfileMode, BmsVersion } = require(path.join(BUILD_DIR, 'profiles', 'ProfileManager.js'));

  const app26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  // Routes are registered synchronously in createApp; wait one tick to be safe
  await new Promise(r => setTimeout(r, 50));
  const mockSet26 = buildMockRouteSet(app26);
  logln(`${mockSet26.size} routes`);

  log('Loading mock app (25R2)... ');
  const app25 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  await new Promise(r => setTimeout(r, 50));
  const mockSet25 = buildMockRouteSet(app25);
  logln(`${mockSet25.size} routes`);

  // ── 3. Parse OpenAPI specs ───────────────────────────────────────────────
  const spec26Dir = path.join(OPENAPI_BASE, '26R1');
  const spec25Dir = path.join(OPENAPI_BASE, '25R2');

  if (!fs.existsSync(spec26Dir)) {
    console.error(`❌ 26R1 spec dir not found: ${spec26Dir}`);
    process.exit(1);
  }
  if (!fs.existsSync(spec25Dir)) {
    console.error(`❌ 25R2 spec dir not found: ${spec25Dir}`);
    process.exit(1);
  }

  log('Parsing 26R1 OpenAPI specs... ');
  const specRoutes26 = parseOpenApiSpec(spec26Dir, SPEC_CATEGORY_26R1);
  logln(`${specRoutes26.length} routes`);

  log('Parsing 25R2 OpenAPI specs... ');
  const specRoutes25 = parseOpenApiSpec(spec25Dir, SPEC_CATEGORY_25R2);
  logln(`${specRoutes25.length} routes`);

  // ── 4. Audit ─────────────────────────────────────────────────────────────
  const { annotated: annotated26, phantoms: phantoms26 } = auditRoutes(specRoutes26, mockSet26);
  const { annotated: annotated25, phantoms: phantoms25 } = auditRoutes(specRoutes25, mockSet25);

  const summary26 = buildSummary(annotated26);
  const summary25 = buildSummary(annotated25);

  // ── 5. Print report ──────────────────────────────────────────────────────
  if (jsonMode) {
    console.log(JSON.stringify({ '26R1': summary26, '25R2': summary25 }, null, 2));
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Route Audit Results');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [ver, summary, annotated, phantoms] of [
    ['26R1', summary26, annotated26, phantoms26],
    ['25R2', summary25, annotated25, phantoms25],
  ]) {
    const pct = summary.coverage;
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    console.log('');
    console.log(`  ${ver}: ${bar} ${pct}%  (${summary.ok}/${summary.total} implemented, ${summary.missing} missing)`);
    const unknownPhantoms = phantoms.filter(p => p.reason === PHANTOM_REASON_FALLBACK).length;
    console.log(`  Phantom routes (not in spec): ${phantoms.length}${unknownPhantoms > 0 ? `  ⚠️  ${unknownPhantoms} need review` : '  ✅ all annotated'}`);
    console.log('');
    console.log('  Coverage by category:');
    for (const [cat, s] of Object.entries(summary.byCategory).sort()) {
      const catPct   = s.total > 0 ? Math.round((s.ok / s.total) * 100) : 0;
      const catBar   = '█'.repeat(Math.round(catPct / 10)) + '░'.repeat(10 - Math.round(catPct / 10));
      const missing  = s.missing > 0 ? `  ← ${s.missing} missing` : '';
      console.log(`    ${cat.padEnd(24)} ${catBar} ${String(catPct).padStart(3)}%  (${s.ok}/${s.total})${missing}`);
    }
  }

  // Check mode: fail if regressions vs last generated doc
  if (checkOnly) {
    const prevPath26 = path.join(PROJECT_ROOT, 'docs/archive/bConnectMockImplementationStatus.md');
    const prevPath25 = path.join(PROJECT_ROOT, 'docs/archive/bConnectMockImplementationStatus_25R2.md');

    let regressions = 0;

    function checkRegressions(label, prevPath, summary) {
      if (!fs.existsSync(prevPath)) return;
      const prevContent = fs.readFileSync(prevPath, 'utf8');
      const match = prevContent.match(/\| Implemented in mock \| (\d+) \|/);
      if (!match) return;
      const prevOk = parseInt(match[1], 10);
      if (summary.ok < prevOk) {
        console.error(`\n❌ REGRESSION in ${label}: was ${prevOk}, now ${summary.ok} implemented routes`);
        regressions++;
      }
    }

    checkRegressions('26R1', prevPath26, summary26);
    checkRegressions('25R2', prevPath25, summary25);

    if (regressions > 0) {
      process.exit(1);
    }
    console.log('\n✅ No regressions detected.');
    return;
  }

  // ── 6. Regenerate docs ───────────────────────────────────────────────────
  console.log('');
  console.log('Regenerating implementation status docs...');

  const md26 = generateMarkdown('26R1', summary26, annotated26, phantoms26);
  const md25 = generateMarkdown('25R2', summary25, annotated25, phantoms25);

  const archiveDir = path.join(PROJECT_ROOT, 'docs/archive');
  if (!fs.existsSync(archiveDir)) { fs.mkdirSync(archiveDir, { recursive: true }); }

  const out26 = path.join(archiveDir, 'bConnectMockImplementationStatus.md');
  const out25 = path.join(archiveDir, 'bConnectMockImplementationStatus_25R2.md');

  fs.writeFileSync(out26, md26, 'utf8');
  console.log(`  ✅ Written: docs/archive/bConnectMockImplementationStatus.md`);

  fs.writeFileSync(out25, md25, 'utf8');
  console.log(`  ✅ Written: docs/archive/bConnectMockImplementationStatus_25R2.md`);

  console.log('');
  console.log('Done.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
