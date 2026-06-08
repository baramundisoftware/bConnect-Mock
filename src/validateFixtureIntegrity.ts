/**
 * P10.15 — Startup fixture integrity validation
 *
 * Checks cross-references between fixture collections and returns a list
 * of diagnostic issues.  Called once at createApp() startup; issues are
 * logged as warnings — they never crash the server (mock server must always start).
 */

/** Severity of an integrity issue */
export type IssueSeverity = 'warn' | 'error';

/** Issue type identifiers */
export type IssueType = 'broken-parent-ref' | 'broken-job-ref';

/** A single fixture integrity issue */
export interface IntegrityIssue {
  type: IssueType;
  severity: IssueSeverity;
  message: string;
}

type FixtureRecord = Record<string, unknown>;

interface FixtureCollections {
  logicalGroups?: FixtureRecord[];
  jobs?: FixtureRecord[];
  jobInstances?: FixtureRecord[];
}

/**
 * Validate cross-references across fixture collections.
 *
 * Checks performed:
 *  1. logicalGroups[*].parentId → logicalGroups[*].id (must resolve or be null)
 *  2. jobInstances[*].jobDefinitionId → jobs[*].id (must resolve)
 *
 * @returns Array of IntegrityIssue (empty = all good)
 */
export function validateFixtureIntegrity(fixtures: FixtureCollections): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  // ── Check 1: logicalGroup parentId references ──────────────────────────────
  const groups = fixtures.logicalGroups ?? [];
  if (groups.length > 0) {
    const groupIds = new Set(groups.map((g) => g['id'] as string).filter(Boolean));
    for (const group of groups) {
      const parentId = group['parentId'];
      if (parentId !== null && parentId !== undefined && typeof parentId === 'string') {
        if (!groupIds.has(parentId)) {
          issues.push({
            type: 'broken-parent-ref',
            severity: 'warn',
            message: `LogicalGroup "${String(group['displayName'] ?? group['id'])}" has parentId "${parentId}" which does not resolve to any group`,
          });
        }
      }
    }
  }

  // ── Check 2: jobInstance jobDefinitionId references ───────────────────────
  const jobs = fixtures.jobs ?? [];
  const jobInstances = fixtures.jobInstances ?? [];
  if (jobInstances.length > 0) {
    const jobIds = new Set(jobs.map((j) => j['id'] as string).filter(Boolean));
    for (const instance of jobInstances) {
      const jobDefId = instance['jobDefinitionId'];
      if (typeof jobDefId === 'string' && jobDefId && !jobIds.has(jobDefId)) {
        issues.push({
          type: 'broken-job-ref',
          severity: 'warn',
          message: `JobInstance "${String(instance['id'])}" references jobDefinitionId "${jobDefId}" which does not resolve to any job`,
        });
      }
    }
  }

  return issues;
}

/**
 * Run fixture integrity validation and log all issues to console.
 * Called once at app startup.
 */
export function runAndLogFixtureIntegrity(fixtures: FixtureCollections): void {
  const issues = validateFixtureIntegrity(fixtures);
  if (issues.length === 0) { return; }
  for (const issue of issues) {
    console.warn(`[FIXTURE INTEGRITY] ${issue.type}: ${issue.message}`);
  }
}
