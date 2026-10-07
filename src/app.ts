/**
 * Express Application Factory
 *
 * Creates and configures an Express application with a specific profile.
 * Route registrations are delegated to domain modules in src/routes/.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { BmsVersion, ProfileMode, ProfileManager, type IProfile } from './profiles/ProfileManager';
import { StateManager } from './state/StateManager';
import { openApiSpec } from './openapi';
import { runAndLogFixtureIntegrity } from './validateFixtureIntegrity';
import { apiKeyGuard } from './middleware/apiKeyGuard';
import { registerAllRoutes } from './routes/index';
import { createModuleRoutingGuard } from './middleware/moduleRouting';
import { bmsErrorBodies, bodyErrors, MOCK_REASON_HEADER, ROUTE_LOCAL, sendProblem, sendValidationProblem, type MatchedRoute } from './middleware/bmsErrors';
import { pagedListEnvelope, pageSizeDefaults } from './middleware/pagedList';
import { specProjection } from './middleware/specProjection';
import { hiddenRootAnswers } from './middleware/hiddenRootAnswers';

/**
 * Paths whose module serves its own data under a path other modules share, so the module
 * prefix must stay for routing: updatemanagement (updateManagement.ts) and the
 * operatingsystems Folders and WindowsEndpoints (operatingSystems.ts, #53).
 */
const DEDICATED_MODULE_ROUTE = /^\/(?:bconnect\/)?(?:updatemanagement\/|operatingsystems\/v2\.0\/(?:folders|windowsendpoints)(?:[/?]|$))/i;

function hasDedicatedModuleRoute(url: string): boolean {
  return DEDICATED_MODULE_ROUTE.test(url);
}

/**
 * Create Express application with specified profile
 */
export function createApp(
  profileMode: ProfileMode,
  bmsVersion: BmsVersion = BmsVersion.BMS_25R2
): Express {
  const app = express();
  const profile: IProfile = ProfileManager.loadProfile(profileMode, bmsVersion);

  // Log configuration — read early so all middleware can use these settings
  const logLevel = process.env.LOG_LEVEL ?? 'info';
  const logFormat = (process.env.LOG_FORMAT ?? 'text') as 'text' | 'json';
  const isDebug = logLevel === 'debug';
  const isJsonFormat = logFormat === 'json';

  // Metrics state — collected per app instance (not module-level, so tests are isolated)
  const metricsStart = Date.now();
  let totalRequests = 0;
  const requestsByMethod: Record<string, number> = {};
  const requestsByStatus: Record<string, number> = {};

  // CORS — P10.6: configurable allowed origins via ALLOWED_ORIGINS env var.
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const corsOptions: cors.CorsOptions = allowedOriginsEnv
    ? {
        origin: (origin, callback) => {
          if (!origin) { callback(null, true); return; }
          const allowed = allowedOriginsEnv.split(',').map((o) => o.trim()).filter(Boolean);
          if (allowed.includes(origin)) {
            callback(null, true);
          } else {
            if (isDebug) {
              console.warn(`[CORS] Rejected origin: '${origin}'`);
            }
            callback(new Error(`CORS: origin '${origin}' not allowed`));
          }
        },
      }
    : { origin: '*' };

  // Let browser clients read the mock's explanation of a routing rejection
  app.use(cors({ ...corsOptions, exposedHeaders: [MOCK_REASON_HEADER] }));
  app.disable('x-powered-by'); // P8.8 — do not disclose framework identity

  // HTTP security headers (P10.3)
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // Request logging middleware (P6.8/P6.9)
  // Supports text format (default, human-readable) and JSON format (LOG_FORMAT=json,
  // suitable for log aggregation in Docker/Kubernetes environments).
  // Registered before the module routing guard, rate limit and auth so their responses are
  // logged too, and logs the path as requested (with its module prefix), not the stripped one.
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    const requestPath = req.originalUrl.split('?')[0] ?? req.path;
    res.on('finish', () => {
      const duration = Date.now() - start;
      const reason = res.getHeader(MOCK_REASON_HEADER) as string | undefined;
      if (isJsonFormat) {
        const entry: Record<string, unknown> = {
          time: new Date().toISOString(),
          level: res.statusCode >= 500 ? 'error' : 'info',
          method: req.method,
          path: requestPath,
          status: res.statusCode,
          durationMs: duration,
        };
        if (reason) {entry.reason = reason;}
        if (isDebug) {entry.query = req.query;}
        console.info(JSON.stringify(entry));
      } else {
        const msg = `${req.method} ${requestPath} ${res.statusCode} ${duration}ms${reason ? ` | ${reason}` : ''}`;
        if (isDebug) {
          console.info(`[DEBUG] ${msg} | query=${JSON.stringify(req.query)}`);
        } else {
          console.info(`[LOG] ${msg}`);
        }
      }
    });
    next();
  });

  // Metrics collection middleware — registered before any middleware that can answer
  // a request itself (module routing guard, rate limit, auth), so every response is counted
  app.use((req: Request, res: Response, next) => {
    totalRequests++;
    requestsByMethod[req.method] = (requestsByMethod[req.method] ?? 0) + 1;
    res.on('finish', () => {
      const statusKey = String(res.statusCode);
      requestsByStatus[statusKey] = (requestsByStatus[statusKey] ?? 0) + 1;
    });
    next();
  });

  // Error answers in the live bMS's shape (problem details); the mock's message goes to the
  // X-BConnect-Mock-Reason header. Registered before everything that can answer an error.
  app.use(bmsErrorBodies);

  // Reject paths a real bMS would refuse: no module prefix, or a module that does not
  // own the route in the selected version's spec (#49). Must run before the prefix is
  // stripped below. BCONNECT_MODULE_ROUTING=lenient restores the old behaviour.
  app.use(createModuleRoutingGuard(profile.bmsVersion));

  // Strip bConnect module prefix so connector paths like /endpoints/v2.0/... become /v2.0/...
  // Leaves paths with module-specific routes alone (see hasDedicatedModuleRoute).
  app.use((req: Request, _res: Response, next) => {
    if (!hasDedicatedModuleRoute(req.url)) {
      req.url = req.url.replace(/^\/[a-z]+(?:mgmt)?\/(v2\.0\/)/, '/$1');
    }
    next();
  });

  // Body parsing runs after the routing guard, so a body the bMS can't read is reported
  // with the matched route's body parameter (see the entity.parse.failed handler below).
  app.use(express.json({ type: ['application/json', 'application/json-patch+json'] }));
  // Convert JSON Patch arrays (RFC 6902) to plain merge-patch objects for state store compatibility.
  // Connectors send PATCH as [{op:'replace',path:'/field',value:'x'},...] but the state store
  // expects a plain object {field: 'x'}.
  app.use((req: Request, _res: Response, next) => {
    if (['PATCH', 'PUT'].includes(req.method) && Array.isArray(req.body)) {
      const merged: Record<string, unknown> = {};
      for (const op of req.body as Array<{op?: string; path?: string; value?: unknown}>) {
        if (op.op === 'replace' || op.op === 'add') {
          const key = (op.path ?? '').replace(/^\//, '');
          if (key) {merged[key] = op.value;}
        }
      }
      req.body = merged;
    }
    next();
  });

  // Trust first proxy for accurate IP detection behind reverse proxies/Docker (P10.7)
  app.set('trust proxy', 1);

  // Rate limiting middleware (P10.7 — enabled by default; disable with RATE_LIMIT_ENABLED=false)
  if (process.env.RATE_LIMIT_ENABLED !== 'false') {
    const maxRequestsRaw = process.env.RATE_LIMIT_MAX;
    const windowMsRaw = process.env.RATE_LIMIT_WINDOW_MS;
    const maxRequests = parseInt(maxRequestsRaw ?? '100', 10);
    const windowMs = parseInt(windowMsRaw ?? '60000', 10);

    // Warn on malformed config rather than silently falling back to defaults (L2)
    if (maxRequestsRaw !== undefined && isNaN(parseInt(maxRequestsRaw, 10))) {
      console.warn(
        `[bconnect-mock] RATE_LIMIT_MAX="${maxRequestsRaw}" is not a valid integer — defaulting to 100`
      );
    }
    if (windowMsRaw !== undefined && isNaN(parseInt(windowMsRaw, 10))) {
      console.warn(
        `[bconnect-mock] RATE_LIMIT_WINDOW_MS="${windowMsRaw}" is not a valid integer — defaulting to 60000`
      );
    }

    const hits = new Map<string, { count: number; resetAt: number }>();
    app.use((req: Request, res: Response, next) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      const entry = hits.get(ip);
      if (!entry || now >= entry.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + windowMs });
        next();
        return;
      }
      entry.count += 1;
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
        return;
      }
      next();
    });
  }

  // Authentication guard — optional; simulates bConnect API authentication.
  // When REQUIRE_API_KEY and/or REQUIRE_BASIC_AUTH are set, ALL requests must
  // present valid credentials (X-Api-Key header or Basic Auth), matching real
  // bConnect behavior. When neither is set, no auth is required.
  app.use(apiKeyGuard);

  // Swagger UI
  app.get('/api-docs/swagger.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Store profile in app.locals for access in routes
  app.locals.profile = profile;

  // PageSize as a live bMS uses it: 20 when missing, 0 or invalid, at most 1000, no error
  app.use(pageSizeDefaults);

  // Input validation middleware (P6.11 / P10.10 / P8.8)
  const MAX_SEARCH_QUERY_LENGTH = 500;
  const MAX_SEARCH_KEYWORDS = 10;
  const MAX_ORDER_BY_LENGTH = 200;

  app.use((req: Request, res: Response, next) => {
    const { Page, SearchQuery, OrderBy } = req.query;
    if (Page !== undefined) {
      const pg = parseInt(Page as string, 10);
      if (isNaN(pg) || pg < 0) {
        res.status(400).json({ error: 'Page must be a non-negative integer' });
        return;
      }
    }
    if (SearchQuery !== undefined && typeof SearchQuery === 'string') {
      if (SearchQuery.length > MAX_SEARCH_QUERY_LENGTH) {
        res.status(400).json({ error: `SearchQuery must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters` });
        return;
      }
      const keywordCount = SearchQuery.trim().split(/\s+/).filter(Boolean).length;
      if (keywordCount > MAX_SEARCH_KEYWORDS) {
        res.status(400).json({ error: `SearchQuery must not exceed ${MAX_SEARCH_KEYWORDS} keywords` });
        return;
      }
    }
    if (OrderBy !== undefined && typeof OrderBy === 'string') {
      if (OrderBy.length > MAX_ORDER_BY_LENGTH) {
        res.status(400).json({ error: `OrderBy must not exceed ${MAX_ORDER_BY_LENGTH} characters` });
        return;
      }
    }
    next();
  });

  // Initialize StateManager for readwrite profiles
  if (profileMode === ProfileMode.MINIMAL_READWRITE || profileMode === ProfileMode.STANDARD_READWRITE || profileMode === ProfileMode.LARGESCALE_READWRITE) {
    // Each store starts from the profile's data for its entity type, on first use
    app.locals.stateManager = new StateManager((entityType) => profile.getFixture(entityType));
  }

  // P10.15 — Startup fixture integrity validation
  if (process.env.NODE_ENV !== 'test') {
    runAndLogFixtureIntegrity({
      logicalGroups: profile.getFixture('logicalGroups') as Record<string, unknown>[] | undefined,
      jobs: profile.getFixture('jobs') as Record<string, unknown>[] | undefined,
      jobInstances: profile.getFixture('jobInstances') as Record<string, unknown>[] | undefined,
    });
  }

  // Read-only guard middleware
  const ACTION_PATH_SUFFIXES = [
    '/Start', '/Stop', '/Resume', '/Restart', '/SimulateMSWCleanup', '/MSWCleanup',
    '/StartEnrollment', '/AssignJobDefinition', '/TriggerInstallationViaIntune',
    '/TriggerUpdateOnClient', '/CancelScheduledRestart',
  ];
  const isReadOnly = profileMode === ProfileMode.MINIMAL_READONLY
    || profileMode === ProfileMode.STANDARD_READONLY
    || profileMode === ProfileMode.LARGESCALE_READONLY;
  if (isReadOnly) {
    app.use((req: Request, res: Response, next) => {
      const method = req.method.toUpperCase();
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        const isAction = ACTION_PATH_SUFFIXES.some((suffix) => req.path.endsWith(suffix));
        if (isAction) { next(); return; }
        res.status(403).json({ error: 'Write operations not supported in read-only profile mode' });
        return;
      }
      next();
    });
  }

  // Health check — enhanced with uptime and request count
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      profile: profile.name,
      bmsVersion: profile.bmsVersion,
      uptime: Math.floor((Date.now() - metricsStart) / 1000),
      requestCount: totalRequests,
    });
  });

  // Metrics endpoint — lightweight Prometheus-style counters for observability
  app.get('/metrics', (_req: Request, res: Response) => {
    res.status(200).json({
      uptime: Math.floor((Date.now() - metricsStart) / 1000),
      totalRequests,
      requestsByMethod,
      requestsByStatus,
    });
  });

  // Strip bConnect module prefixes from the URL before routing:
  //   /bconnect/endpoints/v2.0/... → /bconnect/v2.0/...
  //   /bconnect/software/v2.0/...  → /bconnect/v2.0/...
  //   /bconnect/jobs/v2.0/...      → /bconnect/v2.0/...
  // Real bMS uses module-scoped paths; our routes are registered without the module prefix.
  // Handles all modules generically, except paths with module-specific routes.
  app.use((req, _res, next) => {
    const m = hasDedicatedModuleRoute(req.url) ? null : req.url.match(/^\/(bconnect\/)[a-z]+(?:mgmt)?\/(v\d)/);
    if (m) {
      req.url = req.url.replace(/^\/(bconnect\/)[a-z]+(?:mgmt)?\//, `/${m[1]}`);
    }
    next();
  });

  // Successful answers carry exactly the spec's fields (strict routing). Registered before the
  // paged-list envelope, so it runs after it: the envelope is built first, then projected.
  app.use(specProjection);

  // List responses get the spec's PagedList envelope (currentPage, totalPages, hasNextPage, …)
  app.use(pagedListEnvelope);

  // Register all domain routes (at root and under /bconnect prefix)
  // A hidden tree root asked for by ID or for its children: the live bMS's typed 404
  app.use(hiddenRootAnswers);

  registerAllRoutes(app, profile);
  const bconnectRouter = express.Router();
  // Share app.locals with the sub-router so route handlers can access stateManager
  (bconnectRouter as unknown as { locals: typeof app.locals }).locals = app.locals;
  registerAllRoutes(bconnectRouter as unknown as Express, profile);
  app.use('/bconnect', bconnectRouter);

  // POST /api/reset — Reset state to initial fixtures (readwrite profiles only)
  app.post('/api/reset', (_req: Request, res: Response) => {
    try {
      const stateManager: StateManager | undefined = app.locals.stateManager;
      if (!stateManager) {
        res.status(403).json({ error: 'Reset operation not permitted in read-only profile mode' });
        return;
      }
      stateManager.reset();
      res.status(200).json({ message: 'State reset to initial fixtures' });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // A body that isn't valid JSON: 400 in the bMS's validation shape, not 500
  app.use((err: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      const route = res.locals[ROUTE_LOCAL] as MatchedRoute | undefined;
      sendValidationProblem(res, bodyErrors(err.message, route?.body), `invalid JSON body: ${err.message}`);
      return;
    }
    if (err.type === 'entity.too.large') {
      sendProblem(res, 413, `request body too large: ${err.message}`);
      return;
    }
    next(err);
  });

  // Global error handler (P8.8 — A05/A09: prevent stack trace leakage)
  // Must be registered after all routes. 4-argument signature is required by Express.
   
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[bconnect-mock] Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
