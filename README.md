# bConnect-Mock

[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/README.md)

A mock server for the **baramundi bConnect REST API**. Use it to develop and test integrations with baramundi Management Suite (bMS) without needing a real bMS server.

> **This is a development and testing tool — not for production use.**
>
> **Not an official baramundi product** and not covered by baramundi Support — see [Support](#support).

---

## What You Need

- **Node.js 20 or later** ([download](https://nodejs.org/)) — or use Docker
- No baramundi server required — that's the point of a mock

---

## Getting Started

### Step 1: Install

```bash
git clone https://github.com/baramundisoftware/bConnect-Mock.git
cd bConnect-Mock
npm ci
npm run build
```

> **Future**: once published to npm, you'll be able to install via `npm install -g bconnect-mock`.

> **Releases & images**: tagged versions and notes are on the [Releases page](https://github.com/baramundisoftware/bConnect-Mock/releases); prebuilt multi-arch Docker images are in [Packages](https://github.com/orgs/baramundisoftware/packages?repo_name=bConnect-Mock) (see [Docker](#docker) below).

### Step 2: Start the Mock Server

```bash
# Start with realistic test data (10-20 endpoints per type)
BCONNECT_PROFILE=standard-readonly npm start
```

You should see: `bConnect Mock running on port 3433`

### Step 3: Verify It Works

```bash
curl http://localhost:3433/health
# {"status":"ok", ...}

curl http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints
# Returns a JSON array of mock Windows endpoints
```

### Step 4: Explore the API

Open the interactive API explorer in your browser:

**http://localhost:3433/api-docs**

This shows all available endpoints with try-it-out functionality.

---

## When to Use Which Profile

| Profile | What's in it | Use case |
|---------|-------------|----------|
| `minimal-readonly` | 2 endpoints, read-only | Fast unit tests, CI pipelines |
| `minimal-readwrite` | 2 endpoints, full CRUD | Testing create/update/delete operations |
| `standard-readonly` | 10-20 endpoints per type, read-only | Integration tests, demos |
| `standard-readwrite` | 10-20 endpoints per type, full CRUD | Full integration testing with writes |
| `largescale-readonly` | 70,000+ endpoints, read-only | Performance and load testing |
| `largescale-readwrite` | 70,000+ endpoints, full CRUD | Performance and load testing with writes |

Set the profile via environment variable:

```bash
BCONNECT_PROFILE=standard-readwrite npm start
```

---

## Docker

Prebuilt multi-arch (`linux/amd64` + `linux/arm64`) images are published to the
GitHub Container Registry — browse them on the
[Packages page](https://github.com/orgs/baramundisoftware/packages?repo_name=bConnect-Mock).
Image tags mirror the [Releases](https://github.com/baramundisoftware/bConnect-Mock/releases)
(`0.5.1`, `0.5`, `0`, `latest`).

The image is **public**. `docker pull` works without logging in to `ghcr.io`.

```bash
# Run the published image
docker run -p 3433:3433 -e BCONNECT_PROFILE=standard-readonly \
  ghcr.io/baramundisoftware/bconnect-mock:latest

# Quick start from a clone (docker compose)
docker compose up

# Custom profile and bMS version
PROFILE=standard-readwrite BMS_VERSION=26r1 docker compose up

# Or build locally
docker build -t bconnect-mock .
docker run -p 3433:3433 -e BCONNECT_PROFILE=standard-readonly bconnect-mock
```

Verify: `curl http://localhost:3433/health`

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BCONNECT_PROFILE` | `standard-readonly` | Data profile (see table above) |
| `PORT` | `3433` | HTTP port |
| `BCONNECT_BMS_VERSION` | `25r2` | bMS version to simulate: `25r2` or `26r1` |
| `LOG_LEVEL` | `info` | Logging: `debug` or `info` |
| `RATE_LIMIT_ENABLED` | `true` | Rate limiting (100 req/min per IP) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |
| `REQUIRE_API_KEY` | — | If set, write operations require `X-Api-Key` header |
| `BCONNECT_MODULE_ROUTING` | `strict` | `strict`: like a real bMS, each route answers only under its module prefix; `lenient`: any prefix or none (pre-0.4 behaviour). See [Module prefixes](#module-prefixes) |
| `BCONNECT_MANAGEMENT_SERVER_VERSION` | — | Overrides the `version` of `GET …/ManagementServer` (default: `25.2.0.0` for 25R2, `26.1.161.0` for 26R1), to test clients with an unknown version |

### bMS Version Support

- **25R2 mode** (default): 172 routes covering all standard bConnect V2.0 endpoints
- **26R1 mode**: 264 routes — adds Compliance, Universal Dynamic Groups, Bundles, and more

```bash
# 25R2 (default)
npm start

# 26R1
BCONNECT_BMS_VERSION=26r1 npm start
```

---

## API Usage Examples

### List Endpoints

```bash
curl http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints
curl http://localhost:3433/bconnect/endpoints/v2.0/LinuxEndpoints
curl http://localhost:3433/bconnect/endpoints/v2.0/AndroidEndpoints
```

### Search and Filter

```bash
# Search by name
curl "http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints?SearchQuery=NYC"

# Sort
curl "http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints?OrderBy=DisplayName%20asc"

# Paginate
curl "http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=5&Page=0"

# Combine
curl "http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints?SearchQuery=NYC&OrderBy=DisplayName%20asc&PageSize=5&Page=0"
```

### Create, Update, Delete (readwrite profiles only)

```bash
# Create
curl -X POST http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints \
  -H "Content-Type: application/json" \
  -d '{"displayName": "NEW-ENDPOINT", "primaryUser": "jdoe"}'

# Update
curl -X PATCH http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints/<guid> \
  -H "Content-Type: application/json" \
  -d '{"displayName": "UPDATED-NAME"}'

# Delete
curl -X DELETE http://localhost:3433/bconnect/endpoints/v2.0/WindowsEndpoints/<guid>

# Reset all data back to initial state
curl -X POST http://localhost:3433/api/reset
```

### Module prefixes

Like a real bMS, the mock answers each route only under the module that owns it in the
bConnect spec of the selected version: `/bconnect/<module>/v2.0/...`, for example
`/bconnect/endpoints/v2.0/WindowsEndpoints` or `/bconnect/compliance/v2.0/Rules`
(`/bconnect` itself is optional).

Rejected requests get the same status, content type and body as from a live bMS (26R1,
checked 2026-10-07):

| Request | Result |
|---|---|
| `/bconnect/endpoints/v2.0/WindowsEndpoints` | 200 |
| `/v2.0/WindowsEndpoints` or `/bconnect/v2.0/WindowsEndpoints` (no module) | 404 `application/json`: `{"Message":"No HTTP resource was found that matches the request URI '…'."}` |
| `/bconnect/nonsense/v2.0/Endpoints` (unknown module) | 400 `text/plain`: "The request URI is invalid. Route data could not be determined. …" |
| `/bconnect/jobs/v2.0/WindowsEndpoints` (module doesn't own the route), or a route the spec doesn't declare | 404 `application/problem+json`: `{"type":"https://httpstatuses.io/404","title":"Not Found","status":404,"traceId":"…"}` |
| A method the spec doesn't declare | 405 `application/problem+json`, with `Allow` |

A live bMS explains none of these. The mock puts its explanation in the
`X-BConnect-Mock-Reason` response header and in its request log, e.g.
`unknown module "nonsense" for bMS 26r1`.

Set `BCONNECT_MODULE_ROUTING=lenient` to accept any module prefix, or none, as in 0.3.x.

### Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `SearchQuery` | Filter by name (substring match) | `?SearchQuery=NYC` |
| `OrderBy` | Sort results | `?OrderBy=DisplayName asc` |
| `PageSize` | Items per page | `?PageSize=50` |
| `Page` | Page number (zero-based) | `?Page=2` |

---

## Using with Other Projects

bConnect-Mock is designed as a test backend for:

| Consumer | Recommended Profile | Default Port |
|----------|-------------------|--------------|
| [bConnect-MCP](https://github.com/baramundisoftware/bConnect-MCP) | `standard-readwrite` | 3433 |
| [n8n-bConnect-connector](https://github.com/baramundisoftware/n8n-bConnect-connector) | `standard-readwrite` | 8765 |

Point your consumer's `BCONNECT_BASE_URL` at the mock instead of a real bMS:

```env
BCONNECT_BASE_URL=http://localhost:3433/bconnect
```

See [docs/INTEGRATION-GUIDE.md](docs/INTEGRATION-GUIDE.md) for detailed setup per consumer.

---

## Programmatic Usage

```typescript
import { createApp } from 'bconnect-mock';
import { ProfileMode, BmsVersion } from 'bconnect-mock';

const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
const server = app.listen(3433);
```

---

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start in watch mode
npm run build    # Compile TypeScript
npm test         # Run tests (2018 tests)
npm run lint     # Lint
npm run format   # Format code
```

---

## Security & Limitations

> **This is a testing tool. Do not expose it to the public internet.**

| What it does NOT provide | Why |
|--------------------------|-----|
| Authentication | The real bConnect uses Windows Auth (Kerberos/NTLM) — cannot be meaningfully mocked |
| HTTPS / TLS | Test data only — no real credentials in transit |
| Persistent storage | All data is in-memory, resets on restart |

What it DOES provide:
- Rate limiting (configurable, on by default)
- CORS configuration
- HTTP security headers
- Input validation (Zod schemas)
- Error sanitization (no stack traces or internal paths in responses)

---

## Documentation

- [Integration Guide](docs/INTEGRATION-GUIDE.md) — setup for bConnect-MCP, n8n connector
- [Troubleshooting](docs/TROUBLESHOOTING.md) — common issues and solutions
- [Changelog](CHANGELOG.md) — version history
- **API Reference** — start the server and open http://localhost:3433/api-docs (Swagger UI)

---

## License

MIT — see [LICENSE](LICENSE).

## Support

> **Not an official baramundi product.** This is a testing/mock tool provided
> **as-is** under the MIT license (see [LICENSE](LICENSE)). It is **not covered by
> baramundi support, maintenance, or SLAs**. It aims to match the bConnect API but
> is not guaranteed to behave exactly like a real bMS. Please do **not** contact
> baramundi Support for this tool — use the GitHub issues below.

- **Issues & questions (this tool)**: https://github.com/baramundisoftware/bConnect-Mock/issues
- **bConnect API reference** (official baramundi docs, for the real API): https://docs.baramundi.com/api/bconnect/
