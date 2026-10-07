/**
 * ADUserGenerator — Lazy deterministic generator for Active Directory Users
 *
 * Produces 5,000 AD user records on demand.
 * Deterministic: same index → same record, always.
 */

import { BaseGenerator } from './BaseGenerator';

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Barbara', 'David', 'Susan', 'Richard', 'Jessica', 'Joseph', 'Sarah',
  'Thomas', 'Karen', 'Charles', 'Lisa', 'Christopher', 'Nancy', 'Daniel', 'Betty',
  'Matthew', 'Sandra', 'Anthony', 'Dorothy', 'Mark', 'Ashley',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

const DEPARTMENTS = [
  'Engineering', 'Finance', 'IT', 'Sales', 'Marketing',
  'HR', 'Legal', 'Operations', 'Security', 'Management',
];

const TITLES = [
  'Senior Engineer', 'Finance Manager', 'IT Administrator', 'Sales Representative',
  'Marketing Specialist', 'HR Business Partner', 'Legal Counsel', 'Operations Manager',
  'Security Analyst', 'Department Manager', 'Junior Developer', 'Team Lead',
];

const OU_IDS = [
  'f1000001-0001-0001-0001-000000000001',
  'f1000001-0002-0002-0002-000000000002',
  'f1000001-0003-0003-0003-000000000003',
  'f1000001-0004-0004-0004-000000000004',
  'f1000001-0005-0005-0005-000000000005',
];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function toHex(n: number, len: number): string {
  return (n >>> 0).toString(16).padStart(len, '0').slice(-len);
}

function indexToGuid(index: number): string {
  const seg1 = toHex(0xa1000002 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 43 + 17) & 0xffff, 4);
  const lo   = (index * 71 + 2011) & 0xffffff;
  const hi   = (index * 101 + 1019) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToAdGroupGuid(index: number): string {
  const groupIndex = index % 500;
  const seg1 = toHex(0xa9000002 + (groupIndex & 0x0fffffff), 8);
  return `${seg1}-0001-0001-0001-${toHex(groupIndex, 12)}`;
}

function indexToTimestamp(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 30) * 24 * 60 * 60 * 1000).toISOString();
}

export interface ADUserRecord {
  id: string;
  guid: string;
  type: 'User'; // spec ADObjectType: User | Group
  displayName: string;
  samAccountName: string;
  userPrincipalName: string;
  email: string;
  department: string;
  title: string;
  isEnabled: boolean;
  lastLogon: string;
  adGroupId: string;
  orgUnitId: string;
}

export class ADUserGenerator extends BaseGenerator<ADUserRecord> {
  readonly totalItems = 5_000;
  readonly entityType = 'adUsers';

  generateItem(index: number): ADUserRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid      = indexToGuid(index);
    const firstName = pick(FIRST_NAMES, index * 3 + 1);
    const lastName  = pick(LAST_NAMES, index * 7 + 2);
    const sam       = `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}${index % 99 > 0 ? (index % 99) : ''}`;
    const domain    = 'corp.test';

    return {
      id: guid,
      guid,
      type: 'User',
      displayName: `${firstName} ${lastName}`,
      samAccountName: sam,
      userPrincipalName: `${sam}@${domain}`,
      email: `${sam}@${domain}`,
      department: pick(DEPARTMENTS, index),
      title: pick(TITLES, index),
      isEnabled: (index % 20) !== 0, // ~95% enabled
      lastLogon: indexToTimestamp(index),
      adGroupId: indexToAdGroupGuid(index),
      orgUnitId: pick(OU_IDS, index),
    };
  }
}
