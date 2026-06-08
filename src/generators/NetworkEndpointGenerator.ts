/**
 * NetworkEndpointGenerator — Lazy deterministic generator for Network endpoints
 *
 * Produces 500 managed network devices (routers, switches, firewalls, APs) on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const DEVICE_TYPES = [
  'Router', 'Switch', 'Firewall', 'AccessPoint', 'LoadBalancer',
];

const VENDORS: Record<string, string[]> = {
  Router:       ['Cisco ISR 4431', 'Cisco ASR 1001-X', 'Juniper MX204', 'HPE FlexNetwork MSR3064'],
  Switch:       ['Cisco Catalyst 9300', 'Cisco Nexus 9300', 'Juniper EX4300', 'Aruba 6300M'],
  Firewall:     ['Palo Alto PA-3440', 'Cisco Firepower 2140', 'Fortinet FortiGate 600F', 'Check Point 6200'],
  AccessPoint:  ['Cisco Catalyst 9120', 'Aruba AP-515', 'Ruckus R750', 'Ubiquiti UniFi U6-Pro'],
  LoadBalancer: ['F5 BIG-IP i5800', 'Citrix ADC MPX 5905', 'A10 Thunder 1040'],
};

const OU_POOLS = [
  'ou=Network,ou=Infrastructure,ou=Americas',
  'ou=Network,ou=Infrastructure,ou=EMEA',
  'ou=Network,ou=Infrastructure,ou=APAC',
  'ou=Network,ou=DataCenter,ou=Global',
  'ou=Wireless,ou=Network,ou=Corporate',
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
  const seg1 = toHex(0xc6000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 19 + 37) & 0xffff, 4);
  const lo = (index * 47 + 5003) & 0xffffff;
  const hi = (index * 103 + 2003) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 30) * 24 * 60 * 60 * 1000).toISOString();
}

function indexToMAC(index: number): string {
  const toHex = (n: number): string => zeroPad(n & 0xff, 2).toUpperCase();
  return [0x00, (index >> 16) & 0xff, (index >> 12) & 0xff,
    (index >> 8) & 0xff, (index >> 4) & 0xff, index & 0xff]
    .map(toHex).join(':');
}

export interface NetworkEndpointRecord {
  id: string;
  guid: string;
  type: 'NetworkEndpoint';
  displayName: string;
  deviceType: string;
  modelName: string;
  serialNumber: string;
  primaryMAC: string;
  primaryIP: string;
  lastSeen: string;
  orgUnit: string;
  managementState: string;
  isOnline: boolean;
  firmwareVersion: string;
}

export class NetworkEndpointGenerator extends BaseGenerator<NetworkEndpointRecord> {
  readonly totalItems = 500;
  readonly entityType = 'networkEndpoints';

  generateItem(index: number): NetworkEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const deviceType = pick(DEVICE_TYPES, index);
    const modelPool = VENDORS[deviceType] ?? ['Generic Network Device'];
    const modelName = pick(modelPool, index >> 1);

    const typePrefix: Record<string, string> = {
      Router: 'RTR', Switch: 'SWT', Firewall: 'FWL',
      AccessPoint: 'WAP', LoadBalancer: 'LBL',
    };
    const prefix = typePrefix[deviceType] ?? 'NET';

    return {
      id: guid,
      guid,
      type: 'NetworkEndpoint',
      displayName: `${prefix}-NET-${zeroPad(index + 1, 5)}`,
      deviceType,
      modelName,
      serialNumber: `NET${zeroPad(index, 9)}`,
      primaryMAC: indexToMAC(index),
      primaryIP: `10.${(index >> 6) & 0xff}.${(index >> 2) & 0xff}.${(index % 254) + 1}`,
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      managementState: 'Managed',
      isOnline: (index % 20) < 19, // 95% online (network devices)
      firmwareVersion: `v${(index % 5) + 15}.${(index % 4) + 1}.${index % 10}`,
    };
  }
}
