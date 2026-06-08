# Security Policy

## Important

**This is a development and testing tool. It is not designed for production use.**
Do not expose bConnect-Mock to the public internet.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Active support |
| < 0.3.0 | No support |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities by email to:

**bernd.wiedemann@baramundi.com**

Include as much of the following as possible:

- Type of issue (injection, information disclosure, etc.)
- File paths and line numbers where the issue occurs
- Steps to reproduce
- Impact assessment

### What to Expect

- **Acknowledgement** within 5 business days
- **Status update** within 10 business days
- **Resolution** depends on severity — critical issues are prioritized

## Security Measures

Even as a testing tool, bConnect-Mock implements:

- **Rate limiting** — configurable, enabled by default (100 req/min per IP)
- **Input validation** — Zod strict schemas on all write endpoints
- **HTTP security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- **Error sanitization** — no stack traces or internal paths in error responses
- **CORS configuration** — defaults to `*`, configurable via `ALLOWED_ORIGINS`
- **No authentication data** — mock data contains no real credentials or PII
