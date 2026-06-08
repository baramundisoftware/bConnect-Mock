/**
 * P15.3 — JobInstance fixture integrity regression tests (REQ-21.2.1)
 *
 * Verifies that all JobInstance fixtures in every profile reference
 * JobDefinition IDs that actually exist in the same profile's jobs.json.
 *
 * Previously, standard-readonly had 4 jobInstances referencing
 * bb000001-...-0001 through ...-0004, which were fixed in P8.6.
 * These tests prevent regression.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { validateFixtureIntegrity } from '../../../src/validateFixtureIntegrity';

const FIXTURES_ROOT = resolve(__dirname, '../../../fixtures');

type FixtureRecord = Record<string, unknown>;

function loadJson(filePath: string): FixtureRecord[] {
  return JSON.parse(readFileSync(filePath, 'utf8')) as FixtureRecord[];
}

/** Profiles that have jobInstances.json (directly or via fallback to standard-readonly) */
const PROFILES_WITH_JOB_INSTANCES = [
  { dir: 'minimal-readonly',  label: 'minimal-readonly' },
  { dir: 'standard-readonly', label: 'standard-readonly' },
];

for (const { dir, label } of PROFILES_WITH_JOB_INSTANCES) {
  describe(`${label} fixture integrity — REQ-21.2.1`, () => {
    const fixtureDir = join(FIXTURES_ROOT, dir);
    const jobInstancesPath = join(fixtureDir, 'jobInstances.json');
    const jobsPath = join(fixtureDir, 'jobs.json');

    it(`${label}/jobInstances.json exists`, () => {
      expect(existsSync(jobInstancesPath)).toBe(true);
    });

    it(`${label}/jobs.json exists`, () => {
      expect(existsSync(jobsPath)).toBe(true);
    });

    it(`all jobInstances in ${label} reference valid jobDefinitionIds`, () => {
      const jobs = loadJson(jobsPath);
      const jobInstances = loadJson(jobInstancesPath);

      const issues = validateFixtureIntegrity({ jobs, jobInstances });
      const brokenRefs = issues.filter((i) => i.type === 'broken-job-ref');

      expect(
        brokenRefs,
        `Broken job refs in ${label}: ${brokenRefs.map((i) => i.message).join('; ')}`,
      ).toHaveLength(0);
    });

    it(`every jobInstance.jobDefinitionId resolves to a jobs.json entry`, () => {
      const jobs = loadJson(jobsPath);
      const jobInstances = loadJson(jobInstancesPath);
      const jobIds = new Set(jobs.map((j) => j['id'] as string).filter(Boolean));

      for (const instance of jobInstances) {
        const defId = instance['jobDefinitionId'] as string | undefined;
        if (defId) {
          expect(
            jobIds.has(defId),
            `JobInstance ${String(instance['id'])} references missing jobDefinitionId "${defId}"`,
          ).toBe(true);
        }
      }
    });
  });
}

/** standard-readwrite has no jobInstances.json — falls back to standard-readonly (by design) */
describe('standard-readwrite profile — no standalone jobInstances.json (by design)', () => {
  it('standard-readwrite does not have its own jobInstances.json (uses standard-readonly fallback)', () => {
    const rwPath = join(FIXTURES_ROOT, 'standard-readwrite', 'jobInstances.json');
    // This is intentional — the profile falls back to standard-readonly for read-only entities.
    expect(existsSync(rwPath)).toBe(false);
  });
});
