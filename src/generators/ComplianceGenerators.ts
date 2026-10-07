/**
 * ComplianceGenerators — Lazy deterministic generators for 26R1 Compliance API
 *
 * Three generators:
 *   - VulnerabilitiesGenerator: 1,000 CVE vulnerability records
 *   - RulesGenerator:           50 compliance rule definitions
 *   - RuleViolationsGenerator:  5,000 endpoint-rule violation records
 *
 * All are 26R1-ONLY. LargeScaleReadonlyProfile.getGenerator() returns null
 * for these entity types when bmsVersion = BmsVersion.BMS_25R2.
 *
 * Schema matches fixtures/standard-26r1/:
 *   vulnerabilities.json  — id, cveId, cvssScore, severity, description, affectedProducts, affectedOperatingSystems
 *   rules.json            — id, ruleName, type, severity, description
 *   ruleViolations.json   — endpointId, endpointName, ruleId, ruleName, detected, ignored
 */

import { BaseGenerator } from './BaseGenerator';
import { IosEndpointGenerator } from './IosEndpointGenerator';
import { AndroidEndpointGenerator } from './AndroidEndpointGenerator';
import { MacEndpointGenerator } from './MacEndpointGenerator';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function indexToGuid(prefix: number, index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex((prefix << 24) + (index & 0x00ffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 19 + 31) & 0xffff, 4);
  const lo = (index * 61 + 8009) & 0xffffff;
  const hi = (index * 131 + 2017) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function isoDate(index: number): string {
  // Spread over 2024-01-01 to 2026-03-30
  const BASE = new Date('2024-01-01T00:00:00Z').getTime();
  const RANGE_MS = new Date('2026-03-30T00:00:00Z').getTime() - BASE;
  const t = BASE + (index / 5000) * RANGE_MS;
  return new Date(t).toISOString();
}

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

// ---------------------------------------------------------------------------
// VulnerabilitiesGenerator (1,000 items)
// ---------------------------------------------------------------------------

const VULN_DESCRIPTIONS = [
  'Remote code execution vulnerability in network stack',
  'Privilege escalation in Windows kernel',
  'Information disclosure in SMB service',
  'Buffer overflow in print spooler service',
  'Denial of service via crafted RDP packet',
  'SQL injection in web management interface',
  'Cross-site scripting in admin portal',
  'Authentication bypass in remote access service',
  'Use-after-free memory corruption in browser engine',
  'Heap overflow in file parsing library',
  'Integer overflow in cryptographic library',
  'Path traversal in file sharing service',
  'Command injection in network diagnostic tool',
  'XML external entity injection in configuration service',
  'Type confusion vulnerability in scripting engine',
];

const AFFECTED_PRODUCTS = [
  'Windows Server 2022',
  'Windows 10, Windows 11, Windows Server 2019, Windows Server 2022',
  'Windows Server 2016, Windows Server 2019',
  'Windows 10, Windows 11',
  'All supported Windows versions',
  'Windows Server 2019, Windows Server 2022',
  'Office 2019, Office 2021, Microsoft 365',
  'Exchange Server 2019, Exchange Online',
];

const AFFECTED_OS = ['Windows', 'Linux', 'macOS', 'Windows, Linux', 'All'] as const;

const CVE_YEARS_V = [2022, 2023, 2024, 2025] as const;

export interface VulnerabilityRecord {
  id: string;
  cveId: string;
  cvssScore: number;
  severity: string;
  description: string;
  affectedProducts: string;
  affectedOperatingSystems: string;
}

export class VulnerabilitiesGenerator extends BaseGenerator<VulnerabilityRecord> {
  readonly totalItems = 1_000;
  readonly entityType = 'vulnerabilities';

  generateItem(index: number): VulnerabilityRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const severity = pick(SEVERITIES, index);
    const year = pick(CVE_YEARS_V, index);
    const cveNum = 10000 + index;
    let cvssScore: number;
    switch (severity) {
      case 'Critical': cvssScore = Math.round((9.0 + ((index * 7) % 10) / 10) * 10) / 10; break;
      case 'High':     cvssScore = Math.round((7.0 + ((index * 11) % 20) / 10) * 10) / 10; break;
      case 'Medium':   cvssScore = Math.round((4.0 + ((index * 13) % 30) / 10) * 10) / 10; break;
      default:         cvssScore = Math.round((1.0 + ((index * 17) % 30) / 10) * 10) / 10;
    }

    return {
      id: indexToGuid(0xc2, index),
      cveId: `CVE-${year}-${zeroPad(cveNum, 5)}`,
      cvssScore,
      severity,
      description: pick(VULN_DESCRIPTIONS, index),
      affectedProducts: pick(AFFECTED_PRODUCTS, index),
      affectedOperatingSystems: pick(AFFECTED_OS, index),
    };
  }
}

// ---------------------------------------------------------------------------
// RulesGenerator (50 items)
// ---------------------------------------------------------------------------

const RULE_TEMPLATES: Array<{ ruleName: string; type: string; severity: string; description: string }> = [
  { ruleName: 'Password Policy Compliance', type: 'PasswordPolicy', severity: 'High', description: 'Enforces minimum password length and complexity requirements' },
  { ruleName: 'Disk Encryption Required', type: 'Encryption', severity: 'Critical', description: 'All system drives must be encrypted with BitLocker' },
  { ruleName: 'Firewall Enabled', type: 'NetworkSecurity', severity: 'Medium', description: 'Windows Firewall must be enabled on all network profiles' },
  { ruleName: 'Antivirus Up-to-Date', type: 'Antivirus', severity: 'High', description: 'Antivirus definitions must be updated within the last 24 hours' },
  { ruleName: 'Automatic Updates Enabled', type: 'UpdatePolicy', severity: 'Medium', description: 'Windows Update must be configured for automatic installation' },
  { ruleName: 'Screen Lock Timeout', type: 'ScreenLock', severity: 'Low', description: 'Screen must auto-lock after 15 minutes of inactivity' },
  { ruleName: 'USB Storage Disabled', type: 'DeviceControl', severity: 'High', description: 'Removable USB storage devices must be disabled' },
  { ruleName: 'Remote Desktop Secured', type: 'RemoteAccess', severity: 'Critical', description: 'RDP must use NLA and TLS 1.2 or higher' },
  { ruleName: 'Audit Log Enabled', type: 'Audit', severity: 'Medium', description: 'Security audit logging must be enabled and retained for 90 days' },
  { ruleName: 'Guest Account Disabled', type: 'AccountPolicy', severity: 'High', description: 'Local guest account must be disabled' },
  { ruleName: 'SMBv1 Disabled', type: 'NetworkProtocol', severity: 'Critical', description: 'Legacy SMBv1 protocol must be disabled' },
  { ruleName: 'PowerShell Execution Policy', type: 'ScriptPolicy', severity: 'Medium', description: 'PowerShell execution policy must be set to RemoteSigned or Restricted' },
  { ruleName: 'Secure Boot Enabled', type: 'FirmwareSecurity', severity: 'High', description: 'UEFI Secure Boot must be enabled' },
  { ruleName: 'TPM 2.0 Required', type: 'HardwareSecurity', severity: 'High', description: 'TPM 2.0 module must be present and enabled' },
  { ruleName: 'IPv6 Tunneling Disabled', type: 'NetworkProtocol', severity: 'Low', description: 'IPv6 tunneling protocols must be disabled' },
  { ruleName: 'AppLocker Policy Active', type: 'ApplicationControl', severity: 'High', description: 'AppLocker must enforce application whitelisting' },
  { ruleName: 'LAPS Deployed', type: 'LocalAdmin', severity: 'Critical', description: 'Local Administrator Password Solution must be deployed' },
  { ruleName: 'Credential Guard Enabled', type: 'CredentialProtection', severity: 'High', description: 'Windows Defender Credential Guard must be enabled' },
  { ruleName: 'Event Log Size', type: 'Audit', severity: 'Low', description: 'Security event log must be at least 1 GB' },
  { ruleName: 'Automatic Run Disabled', type: 'DeviceControl', severity: 'Medium', description: 'AutoRun and AutoPlay must be disabled for all drives' },
  { ruleName: 'LLMNR Disabled', type: 'NetworkProtocol', severity: 'Medium', description: 'LLMNR protocol must be disabled to prevent MITM attacks' },
  { ruleName: 'NetBIOS over TCP Disabled', type: 'NetworkProtocol', severity: 'Medium', description: 'NetBIOS over TCP/IP must be disabled' },
  { ruleName: 'WDigest Authentication Disabled', type: 'Authentication', severity: 'High', description: 'WDigest authentication must be disabled to protect credentials' },
  { ruleName: 'Telnet Client Absent', type: 'NetworkService', severity: 'Low', description: 'Telnet client must not be installed' },
  { ruleName: 'SNMP v1/v2 Disabled', type: 'NetworkProtocol', severity: 'Medium', description: 'SNMPv1 and SNMPv2 must be disabled; use SNMPv3' },
];

export interface RuleRecord {
  id: string;
  ruleName: string;
  type: string;
  severity: string;
  description: string;
}

export class RulesGenerator extends BaseGenerator<RuleRecord> {
  readonly totalItems = 50;
  readonly entityType = 'rules';

  generateItem(index: number): RuleRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    // Cycle through templates (25 templates → wrap on second cycle)
    const template = pick(RULE_TEMPLATES, index);
    const cycle = Math.floor(index / RULE_TEMPLATES.length);
    const ruleName = cycle > 0 ? `${template.ruleName} (Extended ${cycle + 1})` : template.ruleName;

    return {
      id: indexToGuid(0xc1, index),
      ruleName,
      type: template.type,
      severity: template.severity,
      description: template.description,
    };
  }
}

// ---------------------------------------------------------------------------
// RuleViolationsGenerator (5,000 items)
// ---------------------------------------------------------------------------

/**
 * Rule violations exist only for iOS, Android and Mac endpoints (a live bMS answers 404 for the
 * violations of any other endpoint), so each violation points to a generated endpoint of one of
 * those types, in turn.
 */
const VIOLATION_ENDPOINTS: Array<{ generateItem(i: number): { id: string; displayName: string }; totalItems: number }> = [
  new IosEndpointGenerator(), new AndroidEndpointGenerator(), new MacEndpointGenerator(),
];

export interface RuleViolationRecord {
  endpointId: string;
  endpointName: string;
  ruleId: string;
  ruleName: string;
  detected: string;
  ignored: boolean;
}

export class RuleViolationsGenerator extends BaseGenerator<RuleViolationRecord> {
  readonly totalItems = 5_000;
  readonly entityType = 'ruleViolations';

  // Cached rule generator to look up rule IDs and names deterministically
  private readonly _rulesGen = new RulesGenerator();

  generateItem(index: number): RuleViolationRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    // Deterministic endpoint reference: iOS, Android, Mac in turn
    const endpoints = VIOLATION_ENDPOINTS[index % VIOLATION_ENDPOINTS.length] as (typeof VIOLATION_ENDPOINTS)[number];
    const endpoint = endpoints.generateItem((index * 13) % endpoints.totalItems);
    const endpointId = endpoint.id;
    const endpointName = endpoint.displayName;

    // Deterministic rule reference
    const ruleIdx = index % this._rulesGen.totalItems;
    const rule = this._rulesGen.generateItem(ruleIdx);

    return {
      endpointId,
      endpointName,
      ruleId: rule.id,
      ruleName: rule.ruleName,
      detected: isoDate(index),
      ignored: (index % 7) === 0, // ~14% ignored
    };
  }
}
