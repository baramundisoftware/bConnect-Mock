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
import { StateManager, type StateManagerFixtures } from './state/StateManager';
import { openApiSpec } from './openapi';
import { runAndLogFixtureIntegrity } from './validateFixtureIntegrity';
import { apiKeyGuard } from './middleware/apiKeyGuard';
import { registerAllRoutes } from './routes/index';

/**
 * Windows endpoint interface (used for StateManager initialization)
 */
interface WindowsEndpoint {
  id: string;
  guid: string;
  type: string;
  displayName: string;
  [key: string]: unknown;
}

function loadWindowsEndpointFixture(profile: IProfile): WindowsEndpoint[] {
  const fixtures = profile.getFixture('windowsEndpoints');
  return Array.isArray(fixtures) ? (fixtures as WindowsEndpoint[]) : [];
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

  app.use(cors(corsOptions));
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
  app.disable('x-powered-by'); // P8.8 — do not disclose framework identity

  // HTTP security headers (P10.3)
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // Strip bConnect module prefix so connector paths like /endpoints/v2.0/... become /v2.0/...
  // Excludes /updatemanagement/ which has dedicated projection routes (updateManagement.ts).
  app.use((req: Request, _res: Response, next) => {
    req.url = req.url.replace(/^\/(?!updatemanagement\/)[a-z]+(?:mgmt)?\/(v2\.0\/)/, '/$1');
    next();
  });

  // Trust first proxy for accurate IP detection behind reverse proxies/Docker (P10.7)
  app.set('trust proxy', 1);

  // Metrics collection middleware — placed after trust proxy so req.ip is accurate
  app.use((req: Request, res: Response, next) => {
    totalRequests++;
    requestsByMethod[req.method] = (requestsByMethod[req.method] ?? 0) + 1;
    res.on('finish', () => {
      const statusKey = String(res.statusCode);
      requestsByStatus[statusKey] = (requestsByStatus[statusKey] ?? 0) + 1;
    });
    next();
  });

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

  // Input validation middleware (P6.11 / P10.10 / P8.8)
  const MAX_PAGE_SIZE = 10_000;
  const MAX_SEARCH_QUERY_LENGTH = 500;
  const MAX_SEARCH_KEYWORDS = 10;
  const MAX_ORDER_BY_LENGTH = 200;

  app.use((req: Request, res: Response, next) => {
    const { PageSize, Page, SearchQuery, OrderBy } = req.query;
    if (PageSize !== undefined) {
      const ps = parseInt(PageSize as string, 10);
      if (isNaN(ps) || ps < 0 || ps > MAX_PAGE_SIZE) {
        res.status(400).json({ error: `PageSize must be between 0 and ${MAX_PAGE_SIZE}` });
        return;
      }
    }
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

  // Request logging middleware (P6.8/P6.9)
  // Supports text format (default, human-readable) and JSON format (LOG_FORMAT=json,
  // suitable for log aggregation in Docker/Kubernetes environments).
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (isJsonFormat) {
        const entry: Record<string, unknown> = {
          time: new Date().toISOString(),
          level: res.statusCode >= 500 ? 'error' : 'info',
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duration,
        };
        if (isDebug) {entry.query = req.query;}
        console.info(JSON.stringify(entry));
      } else {
        const msg = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
        if (isDebug) {
          console.info(`[DEBUG] ${msg} | query=${JSON.stringify(req.query)}`);
        } else {
          console.info(`[LOG] ${msg}`);
        }
      }
    });
    next();
  });

  // Initialize StateManager for readwrite profiles
  if (profileMode === ProfileMode.MINIMAL_READWRITE || profileMode === ProfileMode.STANDARD_READWRITE || profileMode === ProfileMode.LARGESCALE_READWRITE) {
    if (profileMode === ProfileMode.STANDARD_READWRITE) {
      const fixtures: StateManagerFixtures = {
        windowsEndpoints: profile.getFixture('windowsEndpoints') as WindowsEndpoint[],
        androidEndpoints: profile.getFixture('androidEndpoints') as Record<string, unknown>[],
        linuxEndpoints: profile.getFixture('linuxEndpoints') as Record<string, unknown>[],
        macEndpoints: profile.getFixture('macEndpoints') as Record<string, unknown>[],
        iosEndpoints: profile.getFixture('iosEndpoints') as Record<string, unknown>[],
        networkEndpoints: profile.getFixture('networkEndpoints') as Record<string, unknown>[],
        industrialEndpoints: profile.getFixture('industrialEndpoints') as Record<string, unknown>[],
        jobs: profile.getFixture('jobs') as Record<string, unknown>[],
        jobInstances: profile.getFixture('jobInstances') as Record<string, unknown>[],
        assets: profile.getFixture('assets') as Record<string, unknown>[],
        variables: profile.getFixture('variables') as Record<string, unknown>[],
        logicalGroups: profile.getFixture('logicalGroups') as Record<string, unknown>[],
      };
      app.locals.stateManager = new StateManager(fixtures);
    } else {
      const initialEndpoints = loadWindowsEndpointFixture(profile);
      app.locals.stateManager = new StateManager(initialEndpoints);
    }
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
  // Handles all modules generically (excludes updatemanagement which has dedicated routes).
  app.use((req, _res, next) => {
    const m = req.url.match(/^\/(bconnect\/)(?!updatemanagement\/)[a-z]+(?:mgmt)?\/(v\d)/);
    if (m) {
      req.url = req.url.replace(/^\/(bconnect\/)(?!updatemanagement\/)[a-z]+(?:mgmt)?\//, `/${m[1]}`);
    }
    next();
  });

  // Register all domain routes (at root and under /bconnect prefix)
  registerAllRoutes(app, profile);
  const bconnectRouter = express.Router();
  // Share app.locals with the sub-router so route handlers can access stateManager
  (bconnectRouter as any).locals = app.locals;
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

  // Global error handler (P8.8 — A05/A09: prevent stack trace leakage)
  // Must be registered after all routes. 4-argument signature is required by Express.
   
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[bconnect-mock] Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
