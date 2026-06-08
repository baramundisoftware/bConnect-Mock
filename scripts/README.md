# Scripts Directory

Automation scripts for build, deployment, and maintenance tasks.

## Available Scripts

### Development
- **generate-types.sh** - Generate TypeScript types from OpenAPI specs
- **setup-dev.sh** - Set up local development environment

### Build & Deploy
- **build.sh** - Production build (TypeScript compilation)
- **docker-build.sh** - Build Docker image
- **docker-push.sh** - Push Docker image to registry

### Testing
- **run-integration-tests.sh** - Run integration tests against consumer projects
- **run-performance-tests.sh** - Run performance benchmarks
- **generate-coverage-report.sh** - Generate and open HTML coverage report

### Maintenance
- **clean.sh** - Remove build artifacts and node_modules
- **update-fixtures.sh** - Regenerate fixture data
- **check-dependencies.sh** - Check for outdated dependencies (npm audit)

## Usage

All scripts are executable from project root:

```bash
./scripts/generate-types.sh
./scripts/build.sh
```
