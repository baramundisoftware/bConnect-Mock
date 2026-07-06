/**
 * WindowsUpdatesGenerator — Lazy deterministic generator for Windows Update records
 *
 * Produces 200 Windows Update entries on demand. Deterministic: same index → same entry.
 * Works identically for both BmsVersion.BMS_25R2 and BmsVersion.BMS_26R1.
 *
 * Fields match the correct Windows Update schema (REQ-22.1.1):
 *   id, title, kbArticle, classification, severity, installed, installDate,
 *   endpointId, releaseDate, downloadSize, description
 */

import { BaseGenerator } from './BaseGenerator';

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const SEVERITIES = ['Critical', 'Important', 'Moderate', 'Low'] as const;

// Weighted distribution: Security Updates + Critical Updates = majority (REQ-22.2.3)
// indices 0–6 → Security Updates, 7–10 → Critical Updates, 11–12 → Definition Updates,
// 13 → Update Rollups, 14 → Updates, 15 → Drivers
const CLASSIFICATION_MAP: string[] = [
  'Security Updates', 'Security Updates', 'Security Updates', 'Security Updates',
  'Security Updates', 'Security Updates', 'Security Updates',
  'Critical Updates', 'Critical Updates', 'Critical Updates', 'Critical Updates',
  'Definition Updates', 'Definition Updates',
  'Update Rollups',
  'Updates',
  'Drivers',
];

const OS_TARGETS = [
  'Windows 11 Version 23H2',
  'Windows 11 Version 24H2',
  'Windows 10 Version 22H2',
  'Windows Server 2022',
  'Windows Server 2019',
  'Microsoft Office 2021',
  '.NET Framework 4.8',
  '.NET 8.0',
  'Microsoft Edge',
  'Windows Defender Antivirus',
] as const;

const TITLE_PATTERNS = [
  (y: number, m: string, os: string) => `${y}-${m} Cumulative Update for ${os}`,
  (y: number, m: string, os: string) => `${y}-${m} Security Update for ${os}`,
  (y: number, m: string, os: string) => `${y}-${m} .NET Cumulative Update for ${os}`,
  (y: number, m: string, os: string) => `${y}-${m} Servicing Stack Update for ${os}`,
  (y: number, m: string, os: string) => `${y}-${m} Update for ${os}`,
  (y: number, m: string, os: string) => `${y}-${m} Quality Rollup for ${os}`,
] as const;

// KB article number pool — realistic KB IDs (REQ-22.1.5)
const KB_BASES = [
  5034763, 5034441, 5002476, 5035853, 5034122, 5033372,
  5032189, 5031442, 5030219, 5028185, 5027231, 5026361,
  5025221, 5023706, 5022845, 5021233, 5020030, 5019959,
];

// Cross-page endpoint pool for endpointId linking (REQ-22.2.4)
const ENDPOINT_POOL = Array.from({ length: 20 }, (_, i) => {
  const idx = (i + 1).toString().padStart(12, '0');
  return `d0000001-0001-0001-0001-${idx}`;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function indexToGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex(0xd1000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 17 + 23) & 0xffff, 4);
  const lo = (index * 59 + 7001) & 0xffffff;
  const hi = (index * 127 + 2003) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

// ---------------------------------------------------------------------------
// Record type
// ---------------------------------------------------------------------------

export interface WindowsUpdateRecord {
  id: string;
  title: string;
  kbArticle: string;
  classification: string;
  severity: string;
  installed: boolean;
  installDate: string | null;
  endpointId: string;
  releaseDate: string;
  downloadSize: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class WindowsUpdatesGenerator extends BaseGenerator<WindowsUpdateRecord> {
  readonly totalItems = 200;
  readonly entityType = 'windowsUpdates';

  generateItem(index: number): WindowsUpdateRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const severity = pick(SEVERITIES, index);
    const classification = pick(CLASSIFICATION_MAP, index);
    const os = pick(OS_TARGETS, index);
    const titleFn = pick(TITLE_PATTERNS, index);
    const year = 2024 + Math.floor(index / 120);
    const month = zeroPad((index % 12) + 1, 2);
    const title = titleFn(year, month, os);

    const kbBase = pick(KB_BASES, index);
    const kbArticle = `KB${kbBase + (index % 100)}`;

    const endpointId = pick(ENDPOINT_POOL, index);

    // ~70% installed (REQ-22.2.5): installed when (index * 7 + 3) % 10 < 7
    const installed = ((index * 7 + 3) % 10) < 7;

    // Release date: deterministic ISO 8601
    const rYear = 2024 + Math.floor(index / 120);
    const rMonth = zeroPad((index % 12) + 1, 2);
    const rDay = zeroPad((index % 28) + 1, 2);
    const releaseDate = `${rYear}-${rMonth}-${rDay}T00:00:00Z`;

    // Install date: 1–14 days after release date when installed
    let installDate: string | null = null;
    if (installed) {
      const daysAfter = (index % 14) + 1;
      const installDay = Math.min(((index % 28) + 1) + daysAfter, 28);
      installDate = `${rYear}-${rMonth}-${zeroPad(installDay, 2)}T${zeroPad((index % 12) + 8, 2)}:${zeroPad(index % 60, 2)}:00Z`;
    }

    // Download size: 1MB–500MB deterministic
    const downloadSize = ((index * 31 + 17) % 500 + 1) * 1024 * 1024;

    const description = `${classification.replace(/s$/, '')} ${title} (${kbArticle})`;

    return {
      id: indexToGuid(index),
      title,
      kbArticle,
      classification,
      severity,
      installed,
      installDate,
      endpointId,
      releaseDate,
      downloadSize,
      description,
    };
  }
}
