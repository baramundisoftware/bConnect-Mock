/**
 * ADGroupGenerator — Lazy deterministic generator for Active Directory Groups
 *
 * Produces 500 AD group records on demand.
 * Deterministic: same index → same record, always.
 */

import { BaseGenerator } from './BaseGenerator';

const GROUP_SCOPES = ['Global', 'Universal', 'DomainLocal'];
const GROUP_TYPES  = ['Security', 'Distribution'];

const GROUP_PREFIXES = [
  'Domain', 'IT', 'Finance', 'Engineering', 'Sales', 'Marketing',
  'HR', 'Legal', 'Operations', 'Security', 'Management', 'Dev',
  'QA', 'Support', 'Cloud', 'Network', 'Data', 'Mobile', 'Server', 'Desktop',
];

const GROUP_SUFFIXES = [
  'Admins', 'Users', 'Team', 'Staff', 'Group', 'Department',
  'Managers', 'Analysts', 'Engineers', 'Specialists',
];

const OUS = [
  'CN=Users,DC=company,DC=com',
  'OU=Departments,DC=company,DC=com',
  'OU=Engineering,DC=company,DC=com',
  'OU=Finance,DC=company,DC=com',
  'OU=IT,DC=company,DC=com',
];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function toHex(n: number, len: number): string {
  return (n >>> 0).toString(16).padStart(len, '0').slice(-len);
}

function indexToGuid(index: number): string {
  const seg1 = toHex(0xa9000002 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 37 + 11) & 0xffff, 4);
  const lo   = (index * 59 + 2017) & 0xffffff;
  const hi   = (index * 83 + 1021) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

export interface ADGroupRecord {
  id: string;
  name: string;
  distinguishedName: string;
  groupScope: string;
  groupType: string;
  memberCount: number;
}

export class ADGroupGenerator extends BaseGenerator<ADGroupRecord> {
  readonly totalItems = 500;
  readonly entityType = 'adGroups';

  generateItem(index: number): ADGroupRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const prefix = pick(GROUP_PREFIXES, index * 3);
    const suffix = pick(GROUP_SUFFIXES, index * 7 + 1);
    const name   = `${prefix} ${suffix}`;
    const ou     = pick(OUS, index);

    return {
      id: indexToGuid(index),
      name,
      distinguishedName: `CN=${name},${ou}`,
      groupScope: pick(GROUP_SCOPES, index),
      groupType: pick(GROUP_TYPES, index),
      memberCount: (index * 13 + 5) % 200,
    };
  }
}
