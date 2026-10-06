# Security Policy

## Important

**This is a development and testing tool. It is not designed for production use.**
Do not expose bConnect-Mock to the public internet.

**This is not an official baramundi product** and is not covered by baramundi's
commercial support or security SLAs. The policy below is a best-effort process by
the project maintainer, not an official baramundi support commitment.

## Supported Versions

| Version | Security fixes (best-effort) |
|---------|------------------------------|
| 0.3.x   | Yes |
| < 0.3.0 | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities by email to:

**bernd.wiedemann@baramundi.de**

Include as much of the following as possible:

- Type of issue (injection, information disclosure, etc.)
- File paths and line numbers where the issue occurs
- Steps to reproduce
- Impact assessment

### What to Expect

These are best-effort targets from the maintainer, not a guaranteed SLA:

- **Acknowledgement** typically within ~5 business days
- **Status update** typically within ~10 business days
- **Resolution** depends on severity — critical issues are prioritized

## Security Measures

Even as a testing tool, bConnect-Mock implements:

- **Rate limiting** — configurable, enabled by default (100 req/min per IP)
- **Input validation** — Zod body validation on write endpoints (required fields, type checks, prototype-pollution keys)
- **HTTP security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- **Error sanitization** — no stack traces or internal paths in error responses
- **CORS configuration** — defaults to `*`, configurable via `ALLOWED_ORIGINS`
- **No authentication data** — mock data contains no real credentials or PII
