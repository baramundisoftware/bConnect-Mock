/**
 * P10.15 — Startup fixture integrity validation tests
 *
 * Verifies that validateFixtureIntegrity() correctly detects broken
 * cross-references in fixture data and returns diagnostic messages.
 */

import { describe, it, expect } from 'vitest';
import { validateFixtureIntegrity, type IntegrityIssue } from '../../src/validateFixtureIntegrity';

describe('validateFixtureIntegrity', () => {
  it('returns empty array when all cross-references resolve', () => {
    const groups = [
      { id: 'aaa-1', displayName: 'Root', parentId: null },
      { id: 'aaa-2', displayName: 'Child', parentId: 'aaa-1' },
    ];
    const jobs = [
      { id: 'job-1', name: 'Job A' },
    ];
    const jobInstances = [
      { id: 'ji-1', jobDefinitionId: 'job-1', endpointId: 'ep-1' },
    ];

    const issues = validateFixtureIntegrity({ logicalGroups: groups, jobs, jobInstances });
    expect(issues).toHaveLength(0);
  });

  it('detects broken logicalGroup parentId reference', () => {
    const groups = [
      { id: 'aaa-1', displayName: 'Root', parentId: null },
      { id: 'aaa-2', displayName: 'Orphan', parentId: 'nonexistent-id' },
    ];

    const issues = validateFixtureIntegrity({ logicalGroups: groups, jobs: [], jobInstances: [] });
    const parentIssues = issues.filter((i) => i.type === 'broken-parent-ref');
    expect(parentIssues.length).toBeGreaterThan(0);
    expect(parentIssues[0]?.message).toContain('nonexistent-id');
  });

  it('detects broken jobInstance jobDefinitionId reference', () => {
    const jobs = [{ id: 'job-1', name: 'Job A' }];
    const jobInstances = [
      { id: 'ji-1', jobDefinitionId: 'missing-job-id', endpointId: 'ep-1' },
    ];

    const issues = validateFixtureIntegrity({ logicalGroups: [], jobs, jobInstances });
    const jobRefIssues = issues.filter((i) => i.type === 'broken-job-ref');
    expect(jobRefIssues.length).toBeGreaterThan(0);
    expect(jobRefIssues[0]?.message).toContain('missing-job-id');
  });

  it('handles missing fixture collections gracefully', () => {
    // No jobs/jobInstances/logicalGroups provided — should not throw
    const issues = validateFixtureIntegrity({});
    expect(issues).toHaveLength(0);
  });

  it('returns issue with severity and entity type', () => {
    const groups = [
      { id: 'g1', parentId: 'bad-ref', displayName: 'Broken' },
    ];
    const issues = validateFixtureIntegrity({ logicalGroups: groups });
    expect(issues[0]).toMatchObject({
      type: 'broken-parent-ref',
      severity: 'warn',
      message: expect.stringContaining('bad-ref'),
    } satisfies Partial<IntegrityIssue>);
  });

  it('detects multiple issues in a single call', () => {
    const groups = [
      { id: 'g1', parentId: 'missing-1', displayName: 'Broken 1' },
      { id: 'g2', parentId: 'missing-2', displayName: 'Broken 2' },
    ];
    const jobInstances = [
      { id: 'ji-1', jobDefinitionId: 'missing-job', endpointId: 'ep-1' },
    ];
    const issues = validateFixtureIntegrity({ logicalGroups: groups, jobs: [], jobInstances });
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});
