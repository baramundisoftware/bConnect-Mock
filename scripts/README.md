# Scripts Directory

Automation scripts for build, deployment, and maintenance tasks.

## Available Scripts

### Types & Route Auditing
- **generate-types.sh** - Generate TypeScript types from versioned OpenAPI specs
- **audit-routes.js** - Compare registered Express routes against the OpenAPI specs (25R2 / 26R1) and regenerate the implementation-status docs

### Task Management
- **compress-tasks.sh** - Archive completed tasks from `Tasks.md` to `Tasks-Archive.md`
- **show-completed-tasks.sh** - Show completed tasks from the git log

### Status & Monitoring
- **show-running-mocks.sh** - List all running bConnectMock instances with their status
- **visualize-status.js** - Parse `Requirements.md` and `Tasks.md` to visualize project status with colors

## Usage

All scripts are executable from project root:

```bash
./scripts/generate-types.sh
node scripts/audit-routes.js
```
