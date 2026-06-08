/**
 * JobDefinitionGenerator — Lazy deterministic generator for Job Definitions
 *
 * Produces 1,000 job definition records on demand.
 * Deterministic: same index → same record, always.
 */

import { BaseGenerator } from './BaseGenerator';

const JOB_TYPES = [
  'WindowsJobDefinition',
  'MacOSAndMobileJobDefinition',
  'NetworkAndOTDeviceJobDefinition',
];

const JOB_STATUSES = ['Active', 'Inactive', 'Scheduled', 'Disabled'];

const PREFIXES = ['Deploy', 'Update', 'Scan', 'Remediate', 'Patch', 'Configure', 'Audit', 'Install', 'Remove', 'Verify'];
const SUBJECTS = [
  'Windows Updates', 'Antivirus', 'Software Package', 'Security Policy',
  'Driver Bundle', 'OS Configuration', 'Compliance Check', 'Certificate',
  'Firewall Rules', 'Backup Agent', 'VPN Client', 'Endpoint Protection',
];

const TARGET_GROUPS = [
  'All Endpoints', 'Windows Endpoints', 'All Windows Endpoints',
  'Development Workstations', 'Production Servers', 'Mobile Devices',
  'Finance Department', 'Engineering Team', 'Sales Laptops',
];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function toHex(n: number, len: number): string {
  return (n >>> 0).toString(16).padStart(len, '0').slice(-len);
}

function indexToGuid(index: number): string {
  const seg1 = toHex(0xbb000002 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 31 + 71) & 0xffff, 4);
  const lo   = (index * 53 + 2003) & 0xffffff;
  const hi   = (index * 79 + 1009) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToTimestamp(index: number, offsetDays: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 90 + offsetDays) * 24 * 60 * 60 * 1000).toISOString();
}

export interface JobDefinitionRecord {
  id: string;
  guid: string;
  name: string;
  type: string;
  status: string;
  targetGroup: string;
  createdDate: string;
  lastRun: string;
  successCount: number;
  failureCount: number;
}

export class JobDefinitionGenerator extends BaseGenerator<JobDefinitionRecord> {
  readonly totalItems = 1_000;
  readonly entityType = 'jobs';

  generateItem(index: number): JobDefinitionRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid   = indexToGuid(index);
    const prefix = pick(PREFIXES, index * 3);
    const subject = pick(SUBJECTS, index * 7 + 2);
    const name   = `${prefix} ${subject}`;

    return {
      id: guid,
      guid,
      name,
      type: pick(JOB_TYPES, index),
      status: pick(JOB_STATUSES, index),
      targetGroup: pick(TARGET_GROUPS, index),
      createdDate: indexToTimestamp(index, 30),
      lastRun: indexToTimestamp(index, 0),
      successCount: (index * 17 + 5) % 1000,
      failureCount: (index * 3) % 50,
    };
  }
}
