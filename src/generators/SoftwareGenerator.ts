/**
 * SoftwareGenerator — Lazy deterministic generator for enterprise software inventory
 *
 * Produces 500 software items on demand. Deterministic: same index → same item.
 * Works identically for both BmsVersion.BMS_25R2 and BmsVersion.BMS_26R1.
 *
 * Fields match the standard-readonly software fixture schema:
 *   id, name, version, vendor, installCount, category
 */

import { BaseGenerator } from './BaseGenerator';

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

// [vendor, name, baseVersion] pools per category
const SOFTWARE_BY_CATEGORY: Record<string, Array<{ vendor: string; name: string; baseVersion: string }>> = {
  Productivity: [
    { vendor: 'Microsoft Corporation', name: 'Microsoft Office Professional Plus 2021', baseVersion: '16.0.14332' },
    { vendor: 'Microsoft Corporation', name: 'Microsoft 365 Apps for Enterprise', baseVersion: '16.0.17126' },
    { vendor: 'LibreOffice', name: 'LibreOffice', baseVersion: '7.6.4' },
    { vendor: 'Google LLC', name: 'Google Drive for Desktop', baseVersion: '85.0.4' },
    { vendor: 'Notion Labs', name: 'Notion', baseVersion: '3.1.0' },
  ],
  Browser: [
    { vendor: 'Google LLC', name: 'Google Chrome', baseVersion: '122.0.6261' },
    { vendor: 'Mozilla Foundation', name: 'Mozilla Firefox', baseVersion: '124.0.1' },
    { vendor: 'Microsoft Corporation', name: 'Microsoft Edge', baseVersion: '122.0.2365' },
    { vendor: 'Opera Software', name: 'Opera', baseVersion: '108.0.5067' },
    { vendor: 'Brave Software', name: 'Brave Browser', baseVersion: '1.64.109' },
  ],
  'Document Viewer': [
    { vendor: 'Adobe Inc.', name: 'Adobe Acrobat Reader DC', baseVersion: '23.008.20470' },
    { vendor: 'Adobe Inc.', name: 'Adobe Acrobat Pro DC', baseVersion: '23.008.20470' },
    { vendor: 'Foxit Software', name: 'Foxit PDF Reader', baseVersion: '2024.1.0' },
    { vendor: 'Nitro Software', name: 'Nitro PDF Pro', baseVersion: '14.25.1' },
  ],
  Runtime: [
    { vendor: 'Oracle Corporation', name: 'Java Runtime Environment 8', baseVersion: '8.0.401' },
    { vendor: 'Microsoft Corporation', name: '.NET Framework 4.8', baseVersion: '4.8.9181' },
    { vendor: 'Microsoft Corporation', name: 'Visual C++ Redistributable 2022', baseVersion: '14.38.33135' },
    { vendor: 'OpenJDK', name: 'Eclipse Temurin JDK 21', baseVersion: '21.0.2' },
    { vendor: 'Microsoft Corporation', name: 'PowerShell 7', baseVersion: '7.4.1' },
  ],
  Compression: [
    { vendor: 'Igor Pavlov', name: '7-Zip', baseVersion: '23.01' },
    { vendor: 'WinRAR GmbH', name: 'WinRAR', baseVersion: '7.00' },
    { vendor: 'Corel Corporation', name: 'WinZip', baseVersion: '28.0' },
  ],
  Security: [
    { vendor: 'Broadcom Inc.', name: 'Symantec Endpoint Protection', baseVersion: '14.3.10148' },
    { vendor: 'CrowdStrike Inc.', name: 'CrowdStrike Falcon Sensor', baseVersion: '7.14.17706' },
    { vendor: 'SentinelOne', name: 'SentinelOne Agent', baseVersion: '23.4.2' },
    { vendor: 'Microsoft Corporation', name: 'Microsoft Defender Antivirus', baseVersion: '4.18.24020' },
    { vendor: 'Trend Micro', name: 'Trend Micro Apex One', baseVersion: '14.0.12657' },
    { vendor: 'Qualys Inc.', name: 'Qualys Cloud Agent', baseVersion: '4.7.0' },
    { vendor: 'Tenable', name: 'Nessus Agent', baseVersion: '10.5.0' },
  ],
  Development: [
    { vendor: 'Microsoft Corporation', name: 'Visual Studio Code', baseVersion: '1.87.2' },
    { vendor: 'JetBrains', name: 'IntelliJ IDEA', baseVersion: '2024.1' },
    { vendor: 'Microsoft Corporation', name: 'Visual Studio 2022', baseVersion: '17.9.3' },
    { vendor: 'Git SCM', name: 'Git', baseVersion: '2.44.0' },
    { vendor: 'Docker Inc.', name: 'Docker Desktop', baseVersion: '4.28.0' },
    { vendor: 'Postman Inc.', name: 'Postman', baseVersion: '11.0.0' },
    { vendor: 'Python Software Foundation', name: 'Python 3.12', baseVersion: '3.12.2' },
    { vendor: 'Node.js Foundation', name: 'Node.js LTS', baseVersion: '20.11.1' },
  ],
  Communication: [
    { vendor: 'Microsoft Corporation', name: 'Microsoft Teams', baseVersion: '24033.207.2879' },
    { vendor: 'Slack Technologies', name: 'Slack', baseVersion: '4.36.140' },
    { vendor: 'Zoom Video Communications', name: 'Zoom', baseVersion: '6.0.2' },
    { vendor: 'Cisco Systems', name: 'Cisco Webex', baseVersion: '44.3.0' },
    { vendor: 'Discord Inc.', name: 'Discord', baseVersion: '1.0.9030' },
  ],
  Media: [
    { vendor: 'VideoLAN', name: 'VLC Media Player', baseVersion: '3.0.20' },
    { vendor: 'Microsoft Corporation', name: 'Windows Media Player', baseVersion: '12.0.19041' },
    { vendor: 'Audacity Team', name: 'Audacity', baseVersion: '3.5.0' },
    { vendor: 'GIMP Project', name: 'GIMP', baseVersion: '2.10.36' },
  ],
  'Remote Access': [
    { vendor: 'TeamViewer GmbH', name: 'TeamViewer', baseVersion: '15.51.5' },
    { vendor: 'AnyDesk Software', name: 'AnyDesk', baseVersion: '8.0.8' },
    { vendor: 'Citrix Systems', name: 'Citrix Workspace App', baseVersion: '24.2.0' },
    { vendor: 'Microsoft Corporation', name: 'Remote Desktop Connection Manager', baseVersion: '2.83' },
    { vendor: 'PuTTY Development Team', name: 'PuTTY', baseVersion: '0.80' },
  ],
  Virtualization: [
    { vendor: 'VMware Inc.', name: 'VMware Workstation Pro', baseVersion: '17.5.0' },
    { vendor: 'Oracle Corporation', name: 'VirtualBox', baseVersion: '7.0.14' },
    { vendor: 'Microsoft Corporation', name: 'Hyper-V Manager', baseVersion: '10.0.19041' },
  ],
  Database: [
    { vendor: 'Microsoft Corporation', name: 'SQL Server Management Studio', baseVersion: '19.3.4.0' },
    { vendor: 'Oracle Corporation', name: 'Oracle SQL Developer', baseVersion: '23.1.1' },
    { vendor: 'DBeaver Corp', name: 'DBeaver Community', baseVersion: '24.0.0' },
    { vendor: 'MySQL AB', name: 'MySQL Workbench', baseVersion: '8.0.36' },
  ],
  Network: [
    { vendor: 'Wireshark Foundation', name: 'Wireshark', baseVersion: '4.2.3' },
    { vendor: 'Nmap Project', name: 'Nmap', baseVersion: '7.94' },
    { vendor: 'Cisco Systems', name: 'Cisco AnyConnect', baseVersion: '4.10.08029' },
    { vendor: 'Palo Alto Networks', name: 'GlobalProtect', baseVersion: '6.2.3' },
    { vendor: 'OpenVPN Technologies', name: 'OpenVPN Connect', baseVersion: '3.4.9' },
  ],
  Backup: [
    { vendor: 'Veeam Software', name: 'Veeam Agent for Windows', baseVersion: '6.0.2.1617' },
    { vendor: 'Acronis', name: 'Acronis Cyber Protect', baseVersion: '15.0.34770' },
    { vendor: 'Symantec', name: 'Backup Exec Agent', baseVersion: '22.4' },
    { vendor: 'Commvault', name: 'Commvault File System Core', baseVersion: '11.32.114' },
  ],
  Monitoring: [
    { vendor: 'SolarWinds', name: 'SolarWinds Agent', baseVersion: '12.4.0' },
    { vendor: 'Datadog Inc.', name: 'Datadog Agent', baseVersion: '7.52.0' },
    { vendor: 'New Relic Inc.', name: 'New Relic Infrastructure Agent', baseVersion: '1.52.0' },
    { vendor: 'Dynatrace LLC', name: 'Dynatrace OneAgent', baseVersion: '1.285.0' },
    { vendor: 'baramundi software GmbH', name: 'baramundi Management Agent', baseVersion: '26.1.0' },
  ],
};

// Flatten to a single indexed list for deterministic index-based access
const SOFTWARE_POOL: Array<{ vendor: string; name: string; baseVersion: string; category: string }> = [];
for (const [category, items] of Object.entries(SOFTWARE_BY_CATEGORY)) {
  for (const item of items) {
    SOFTWARE_POOL.push({ ...item, category });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indexToGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  // Prefix 0xc3 to distinguish software GUIDs from endpoint GUIDs
  const seg1 = toHex(0xc3000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 13 + 19) & 0xffff, 4);
  const lo = (index * 53 + 6007) & 0xffffff;
  const hi = (index * 107 + 1409) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

/** Derive a deterministic version patch number from index */
function patchVersion(baseVersion: string, index: number): string {
  const parts = baseVersion.split('.');
  // Vary the last segment deterministically
  const lastIdx = parts.length - 1;
  const base = parseInt(parts[lastIdx] ?? '0', 10);
  const patch = (base + (index % 200)) % 9999;
  parts[lastIdx] = String(patch);
  return parts.join('.');
}

// ---------------------------------------------------------------------------
// Record type
// ---------------------------------------------------------------------------

export interface SoftwareRecord {
  id: string;
  name: string;
  version: string;
  vendor: string;
  installCount: number;
  category: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class SoftwareGenerator extends BaseGenerator<SoftwareRecord> {
  readonly totalItems = 500;
  readonly entityType = 'software';

  generateItem(index: number): SoftwareRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    // Cycle through the pool; if pool has < 500 entries, wrap around with slight variation
    const poolIndex = index % SOFTWARE_POOL.length;
    const cycle = Math.floor(index / SOFTWARE_POOL.length); // 0, 1, 2, ...
    // poolIndex is bounded by modulo — guaranteed to be a valid index
    const entry = SOFTWARE_POOL[poolIndex] as typeof SOFTWARE_POOL[number];

    // Vary name slightly on wrap-around (e.g. "Microsoft Office 2.x")
    const name = cycle > 0 ? `${entry.name} ${cycle + 1}.x` : entry.name;

    return {
      id: indexToGuid(index),
      name,
      version: patchVersion(entry.baseVersion, index),
      vendor: entry.vendor,
      installCount: 50 + ((index * 37 + 13) % 950), // deterministic 50–999
      category: entry.category,
    };
  }
}
