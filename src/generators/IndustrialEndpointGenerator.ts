/**
 * IndustrialEndpointGenerator — Lazy deterministic generator for Industrial/OT endpoints
 *
 * Produces 300 OT/ICS/industrial managed devices on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const DEVICE_TYPES = [
  'PLC', 'HMI', 'SCADA', 'RTU', 'IED', 'ControlPanel',
];

const VENDORS: Record<string, string[]> = {
  PLC:          ['Siemens S7-1500', 'Allen-Bradley ControlLogix 5580', 'Schneider Modicon M580'],
  HMI:          ['Siemens SIMATIC HMI TP1500', 'Rockwell PanelView Plus 7', 'Weintek cMT3151'],
  SCADA:        ['Honeywell Experion PKS', 'ABB Ability System 800xA', 'Yokogawa CENTUM VP'],
  RTU:          ['ABB RTU560', 'Schneider SCADAPack 470', 'GE Reason RT430'],
  IED:          ['Siemens SIPROTEC 5', 'ABB REF630', 'Schneider MiCOM P543'],
  ControlPanel: ['Phoenix Contact AXC F 2152', 'Beckhoff CX5130', 'B&R X20CP1583'],
};

const OU_POOLS = [
  'ou=OT,ou=Production,ou=Plant-A',
  'ou=OT,ou=Production,ou=Plant-B',
  'ou=OT,ou=Infrastructure,ou=Utilities',
  'ou=ICS,ou=Manufacturing,ou=Corporate',
  'ou=OT,ou=Facilities,ou=Global',
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
  const seg1 = toHex(0xc7000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 23 + 41) & 0xffff, 4);
  const lo = (index * 59 + 4007) & 0xffffff;
  const hi = (index * 97 + 1999) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 14) * 24 * 60 * 60 * 1000).toISOString();
}

export interface IndustrialEndpointRecord {
  id: string;
  guid: string;
  type: 'IndustrialEndpoint';
  displayName: string;
  deviceType: string;
  modelName: string;
  serialNumber: string;
  primaryIP: string;
  lastSeen: string;
  orgUnit: string;
  managementState: string;
  isOnline: boolean;
  firmwareVersion: string;
  zone: string;
}

export class IndustrialEndpointGenerator extends BaseGenerator<IndustrialEndpointRecord> {
  readonly totalItems = 300;
  readonly entityType = 'industrialEndpoints';

  generateItem(index: number): IndustrialEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const deviceType = pick(DEVICE_TYPES, index);
    const modelPool = VENDORS[deviceType] ?? ['Generic OT Device'];
    const modelName = pick(modelPool, index >> 1);

    const zones = ['Level0-FieldDevices', 'Level1-Control', 'Level2-Supervisory', 'DMZ'];
    const typePrefix: Record<string, string> = {
      PLC: 'PLC', HMI: 'HMI', SCADA: 'SCA', RTU: 'RTU', IED: 'IED', ControlPanel: 'CTL',
    };
    const prefix = typePrefix[deviceType] ?? 'OT';

    return {
      id: guid,
      guid,
      type: 'IndustrialEndpoint',
      displayName: `${prefix}-OT-${zeroPad(index + 1, 5)}`,
      deviceType,
      modelName,
      serialNumber: `OT${zeroPad(index, 9)}`,
      primaryIP: `192.168.${(index >> 4) & 0xff}.${(index % 254) + 1}`,
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      managementState: 'Managed',
      isOnline: (index % 50) < 48, // 96% online
      firmwareVersion: `${(index % 3) + 1}.${(index % 5)}.${(index % 10) + 1}`,
      zone: pick(zones, index),
    };
  }
}
