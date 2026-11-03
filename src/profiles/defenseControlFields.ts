/**
 * DefenseControl fields — what a live bMS answers for the BitLocker and Microsoft Defender state
 * of a Windows endpoint
 *
 * The mock's BitLocker and Defender states had their own flat fields (`conversionStatus`,
 * `defenderStatus`, `signatureVersion`, ...), none of the spec's, so the spec conformance test
 * listed every spec field as never set. The formats come from a read-only probe of a live 26R1
 * bMS (26.1.161.0, probe version 7, 2026-11-02, 20 Windows endpoints), which reported each
 * field's shape, never its values:
 * - BitLocker: every endpoint has `isSecureBootEnabled`, a `networkUnlockStatus` (Unknown without
 *   inventory, else mostly NotSupported) and `storageMedia` (empty without inventory). The
 *   inventoried ones have `tpmData` (half a 2.0 TPM, half NotAvailable with an empty version),
 *   the startup PIN and USB key flags, and BitLocker data on their Windows volume only.
 * - Defender: `microsoftDefenderState` on the inventoried endpoints only; definitions created
 *   without a fraction of a second, scans with milliseconds, a full scan on few endpoints,
 *   `highestSeverity` None without active threats.
 *
 * The state follows the endpoint's inventory (src/profiles/endpointInventory.ts): an endpoint
 * the mock inventories has a disk, TPM and Defender state here too, with the same volumes. The
 * values of the mock's own fields (encryption, signature and engine versions) go into the spec's
 * fields where they fit; threat counts and the highest severity come from the profile's threats.
 */

import { type Item, seedOf, roll, str, moment } from './seeded';
import { withInventory } from './endpointInventory';

/** The inventory of the endpoint a state belongs to (it depends on the endpoint's ID only) */
const endpointOf = (item: Item): Item => withInventory('windowsEndpoints', { id: item['endpointId'] });
const inventoried = (endpoint: Item): boolean => Boolean(endpoint['cpu']);

/** The BitLocker data of the Windows volume: the mock's own values, else not encrypted */
function volumeData(item: Item): Item {
  const encrypted = str(item['conversionStatus']) !== undefined && item['conversionStatus'] !== 'FullyDecrypted';
  return {
    conversionStatus: str(item['conversionStatus']) ?? 'FullyDecrypted',
    encryptionPercentage: encrypted && typeof item['encryptionPercentage'] === 'number' ? item['encryptionPercentage'] : null,
    suspendCount: typeof item['suspendCount'] === 'number' ? item['suspendCount'] : 0,
    bitLockerVersion: str(item['bitLockerVersion']) ?? 'Unknown',
    protectionStatus: str(item['protectionStatus']) ?? 'Unprotected',
    lockStatus: str(item['lockStatus']) ?? 'Unlocked',
  };
}

export function bitLockerFields(item: Item): Item {
  const endpoint = endpointOf(item);
  const h = seedOf(item['endpointId']);
  if (!inventoried(endpoint)) {
    return { isSecureBootEnabled: false, isStartupPinEnabled: null, isStartupUsbKeyEnabled: null, networkUnlockStatus: 'Unknown', tpmData: null, storageMedia: [] };
  }
  const tpm = roll(h, 30) < 50;
  const disks = (endpoint['storageMedia'] as Item[] | undefined) ?? [];
  return {
    isSecureBootEnabled: true, // inventoried endpoints boot 'UEFI (Secure)'
    isStartupPinEnabled: false,
    isStartupUsbKeyEnabled: false,
    networkUnlockStatus: roll(h, 31) < 85 ? 'NotSupported' : 'Deactivated',
    tpmData: tpm ? { version: '2.0', tpmStatus: 'Enabled', isOwned: true } : { version: '', tpmStatus: 'NotAvailable', isOwned: false },
    storageMedia: disks.map((disk) => ({
      ...disk,
      storageVolumes: ((disk['storageVolumes'] as Item[] | undefined) ?? []).map((v) => ({ ...v, bitLockerVolumeData: v['isSystemVolume'] ? volumeData(item) : null })),
    })),
  };
}

/** Engine and product versions of the Defender platform ("spec": plausible for 2026) */
const ENGINE = '1.1.25090.3';
const PRODUCT = '4.18.25090.3';

const SEVERITIES = ['None', 'Low', 'Moderate', 'High', 'Severe'];

/** The endpoint's Defender state; its threat counts and highest severity from the profile's threats */
export function defenderFields(item: Item, allThreats: Item[]): Item {
  const endpoint = endpointOf(item);
  const h = seedOf(item['endpointId']);
  const active = item['defenderStatus'] !== undefined ? item['defenderStatus'] === 'Enabled' : inventoried(endpoint);
  if (!inventoried(endpoint)) { return { isMicrosoftDefenderActive: active, microsoftDefenderState: null }; }
  const definitions = { definitionCreation: moment(h, 600, 'none'), definitionVersion: str(item['signatureVersion']) ?? `1.439.${100 + (h % 400)}.0` };
  const scan = (minutesBack: number): string => moment(h, minutesBack, 'none').replace('Z', `.${String(h % 1000).padStart(3, '0')}Z`);
  const own = allThreats.filter((t) => t['windowsEndpointId'] === item['endpointId']);
  const activeThreats = own.filter((t) => t['status'] === 'Active');
  const highest = Math.max(0, ...activeThreats.map((t) => SEVERITIES.indexOf(str(t['severity']) ?? '')));
  return {
    isMicrosoftDefenderActive: active,
    microsoftDefenderState: {
      antimalware: { engineVersion: str(item['engineVersion']) ?? ENGINE, productVersion: str(item['platformVersion']) ?? PRODUCT, runningMode: 'Normal', isActive: active, serviceVersion: str(item['platformVersion']) ?? PRODUCT },
      antispyware: { isActive: active, ...definitions },
      antivirus: { isActive: active, ...definitions },
      networkInspectionSystem: { isActive: active, engineVersion: str(item['engineVersion']) ?? ENGINE, ...definitions },
      isBehaviorMonitoringActive: active,
      isIoavProtectionActive: active,
      isTamperProtectionActive: active,
      isOnAccessProtectionActive: active,
      isRealTimeProtectionActive: typeof item['realTimeProtection'] === 'boolean' ? item['realTimeProtection'] : active,
      realTimeScanDirection: 'IncomingAndOutgoingFiles',
      lastFullScan: roll(h, 32) < 20 ? scan(4000) : null, // 1 of 6 on the live bMS
      lastQuickScan: scan(900),
      highestSeverity: SEVERITIES[highest],
      activeThreats: activeThreats.length,
      resolvedThreats: own.length - activeThreats.length,
    },
  };
}
