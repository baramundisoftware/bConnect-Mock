/**
 * JobInstanceGenerator — Lazy deterministic generator for Job Instances
 *
 * Produces 2,000 job instance records on demand.
 * Deterministic: same index → same job instance, always.
 */

import { BaseGenerator } from './BaseGenerator';

const JOB_TYPES = [
  'WindowsJobDefinition',
  'MacOSAndMobileJobDefinition',
  'NetworkAndOTDeviceJobDefinition',
];

const ENDPOINT_TYPES = [
  'WindowsEndpoint', 'AndroidEndpoint', 'IOSEndpoint', 'MacEndpoint',
  'NetworkEndpoint', 'IndustrialEndpoint', 'LinuxEndpoint',
];

const JOB_STATES = [
  'Active', 'Completed', 'Failed', 'Pending', 'Cancelled', 'Running',
];

const JOB_NAME_PREFIXES = [
  'Deploy', 'Update', 'Scan', 'Remediate', 'Patch', 'Configure', 'Audit', 'Install',
];

const JOB_NAME_SUBJECTS = [
  'Windows Updates', 'Antivirus', 'Software Package', 'Security Policy',
  'Driver Bundle', 'OS Configuration', 'Compliance Check', 'Certificate',
];

const INITIATORS = [
  'admin@company.com', 'scheduler@bms.local', 'automation@company.com',
  'sysadmin@company.com', 'system', 'devops@company.com',
];

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function indexToGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex(0xc8000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 29 + 43) & 0xffff, 4);
  const lo = (index * 61 + 3001) & 0xffffff;
  const hi = (index * 89 + 1997) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToJobDefGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const base = 0xe1000000 + ((index * 7) & 0x0fffffff);
  return `${toHex(base, 8)}-0001-0001-0001-${toHex(index % 100, 12)}`;
}

function indexToEndpointGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const base = 0xa1000000 + ((index * 13) & 0x0fffffff);
  return `${toHex(base, 8)}-0001-0001-0001-${toHex(index % 1000, 12)}`;
}

function indexToTimestamp(index: number, offsetDays: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 60 + offsetDays) * 24 * 60 * 60 * 1000).toISOString();
}

export interface JobInstanceRecord {
  id: string;
  guid: string;
  type: 'JobInstance';
  jobDefinitionId: string;
  jobDefinitionName: string;
  jobDefinitionDisplayName: string;
  jobDefinitionType: string;
  endpointId: string;
  endpointName: string;
  endpointType: string;
  initiator: string;
  start: string;
  lastAction: string;
  state: string;
  stateDescription: string;
  successfulExecutions: number;
  erroneousExecutions: number;
  retries: number;
}

export class JobInstanceGenerator extends BaseGenerator<JobInstanceRecord> {
  readonly totalItems = 2_000;
  readonly entityType = 'jobInstances';

  generateItem(index: number): JobInstanceRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const jobType = pick(JOB_TYPES, index);
    const endpointType = pick(ENDPOINT_TYPES, index);
    const state = pick(JOB_STATES, index);

    const prefix = pick(JOB_NAME_PREFIXES, index * 3);
    const subject = pick(JOB_NAME_SUBJECTS, index * 5 + 2);
    const jobName = `${prefix} ${subject}`;

    const isCompleted = state === 'Completed' || state === 'Failed';
    const successCount = state === 'Completed' ? Math.floor(index % 10) + 1 : 0;
    const errorCount = state === 'Failed' ? Math.floor(index % 3) + 1 : 0;

    return {
      id: guid,
      guid,
      type: 'JobInstance',
      jobDefinitionId: indexToJobDefGuid(index),
      jobDefinitionName: jobName,
      jobDefinitionDisplayName: jobName,
      jobDefinitionType: jobType,
      endpointId: indexToEndpointGuid(index),
      endpointName: `ENDPOINT-${zeroPad((index % 1000) + 1, 5)}`,
      endpointType,
      initiator: pick(INITIATORS, index),
      start: indexToTimestamp(index, 0),
      lastAction: indexToTimestamp(index, isCompleted ? 0 : -1),
      state,
      stateDescription: `Job ${state.toLowerCase()} on endpoint`,
      successfulExecutions: successCount,
      erroneousExecutions: errorCount,
      retries: (index % 3),
    };
  }
}
