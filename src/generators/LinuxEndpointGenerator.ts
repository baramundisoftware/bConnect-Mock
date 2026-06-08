/**
 * LinuxEndpointGenerator — Lazy deterministic generator for Linux endpoints
 *
 * Produces 2,500 Linux server/workstation endpoints on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const LINUX_OS = [
  'Ubuntu 22.04.3 LTS',
  'Ubuntu 20.04.6 LTS',
  'Red Hat Enterprise Linux 9.3',
  'Red Hat Enterprise Linux 8.9',
  'Debian GNU/Linux 12 (bookworm)',
  'CentOS Stream 9',
  'SUSE Linux Enterprise Server 15 SP5',
  'Oracle Linux 8.9',
];

const KERNEL_VERSIONS = [
  '5.15.0-91-generic',
  '5.15.0-88-generic',
  '6.1.0-18-amd64',
  '5.14.0-362.18.1.el9_3.x86_64',
  '4.18.0-513.18.1.el8_9.x86_64',
  '6.4.0-150600.21-default',
];

const MANUFACTURERS = [
  'Dell Technologies', 'HPE', 'Lenovo', 'Supermicro', 'IBM',
];

const MODELS: Record<string, string[]> = {
  'Dell Technologies': ['PowerEdge R750', 'PowerEdge R640', 'PowerEdge T550'],
  HPE: ['ProLiant DL380 Gen10', 'ProLiant ML350 Gen10'],
  Lenovo: ['ThinkSystem SR650', 'ThinkSystem ST550'],
  Supermicro: ['SuperServer 6019U-TRT', 'SuperServer 1029U-TR4T'],
  IBM: ['Power System S922', 'System x3650 M5'],
};

const OU_POOLS = [
  'ou=DataCenter,ou=Americas,ou=Production',
  'ou=DataCenter,ou=EMEA,ou=Production',
  'ou=DataCenter,ou=APAC,ou=Production',
  'ou=Infrastructure,ou=Americas,ou=IT',
  'ou=Infrastructure,ou=EMEA,ou=IT',
  'ou=Servers,ou=Global,ou=Cloud',
];

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}


function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 90) * 24 * 60 * 60 * 1000).toISOString();
}

function indexToMAC(index: number): string {
  const toHex = (n: number): string => zeroPad(n & 0xff, 2).toUpperCase();
  return [0x02, (index >> 16) & 0xff, (index >> 12) & 0xff,
    (index >> 8) & 0xff, (index >> 4) & 0xff, index & 0xff]
    .map(toHex).join(':');
}

export interface LinuxEndpointRecord {
  id: string;
  guid: string;
  type: 'LinuxEndpoint';
  displayName: string;
  hostName: string;
  primaryUser: string;
  operatingSystem: string;
  kernelVersion: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  primaryMAC: string;
  primaryIP: string;
  lastSeen: string;
  orgUnit: string;
  clientAgentVersion: string;
  managementState: string;
  isOnline: boolean;
}

export class LinuxEndpointGenerator extends BaseGenerator<LinuxEndpointRecord> {
  readonly totalItems = 2_500;
  readonly entityType = 'linuxEndpoints';

  generateItem(index: number): LinuxEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const toHex = (n: number, len: number): string =>
      (n >>> 0).toString(16).padStart(len, '0').slice(-len);
    const seg1 = toHex(0xb3000000 + (index & 0x0fffffff), 8);
    const seg2 = toHex((index >> 8) & 0xffff, 4);
    const seg3 = toHex(index & 0xffff, 4);
    const seg4 = toHex((index * 13 + 23) & 0xffff, 4);
    const lo = (index * 53 + 6007) & 0xffffff;
    const hi = (index * 127 + 3001) & 0xffffff;
    const guid = `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;

    const manufacturer = pick(MANUFACTURERS, index);
    const modelPool = MODELS[manufacturer] ?? ['Generic Server'];
    const modelName = pick(modelPool, index >> 1);

    const displayName = `LNX-SRV-${zeroPad(index + 1, 5)}`;

    return {
      id: guid,
      guid,
      type: 'LinuxEndpoint',
      displayName,
      hostName: displayName.toLowerCase(),
      primaryUser: 'sysadmin@company.com',
      operatingSystem: pick(LINUX_OS, index),
      kernelVersion: pick(KERNEL_VERSIONS, index),
      manufacturer,
      modelName,
      serialNumber: `${manufacturer.slice(0, 3).toUpperCase()}${zeroPad(index, 7)}`,
      primaryMAC: indexToMAC(index),
      primaryIP: `172.${(index >> 8) & 0xff}.${index & 0xff}.${(index % 254) + 1}`,
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      clientAgentVersion: '6.5.0.1234',
      managementState: 'Managed',
      isOnline: (index % 10) < 9, // 90% online (servers)
    };
  }
}
