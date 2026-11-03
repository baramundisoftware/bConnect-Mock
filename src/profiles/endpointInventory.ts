/**
 * Endpoint inventory — the fields a live bMS fills for its endpoints
 *
 * The mock's endpoint data has names, OS, model and MAC, but none of the inventory a live bMS
 * answers (IP, OS build, CPU, RAM, disks, time zone, agent link, SSH configuration, ...), so the
 * spec conformance test reported up to 38 fields per endpoint type that no item ever sets.
 *
 * The formats come from a read-only probe of a live 26R1 bMS (26.1.161.0, probe version 7,
 * 2026-11-02), which reported each field's shape, never its values:
 * - Windows: only about a third of the endpoints are inventoried; the others have no hardware,
 *   network or OS details (null) and an empty `storageMedia`. Fields such as `clientAgentLink`,
 *   `coManagement`, `modernManagementState`, `lastChange` and an empty `entraIdDeviceId` are on
 *   every endpoint. Date-times have no fraction of a second (`2026-10-30T08:15:00Z`).
 * - `activity` is a sentence, not a state; `timeZone` reads `UTC+01:00 Europe/Berlin`.
 * - Linux endpoints are managed over SSH (`sshConfiguration`), network endpoints have
 *   `snmpPort` 0, `totalRAM` 0 and `operatingSystem` "Unknown".
 * Values the probe could not show (mobile devices were not enrolled there) follow the spec and
 * are marked "spec" below. So do the fields 26R2 added (network endpoints' `deviceInfo`, the
 * Kerberos identity and domain membership of unmanaged endpoints): the probed bMS is a 26R1. Enum values chosen by string length alone are marked "length".
 *
 * withEndpointInventory() fills these fields where an item has none, for every source
 * (fixtures, generators, the read-write store seeded from fixtures). All values are synthetic
 * and derived from the item's ID, so the same endpoint always gets the same inventory. Created
 * endpoints get none, like a newly added endpoint on a live bMS before its first inventory.
 */

import { type Item, seedOf, roll, pick, str, moment, shortDate, guidOf, fillMissing } from './seeded';

type Kind = 'windows' | 'linux' | 'mac' | 'android' | 'ios' | 'network' | 'unmanaged';

/** Fixture and store names of the endpoint types this module fills */
export const INVENTORY_KINDS: Readonly<Record<string, Kind>> = {
  windowsEndpoints: 'windows', linuxEndpoints: 'linux', macEndpoints: 'mac',
  androidEndpoints: 'android', iosEndpoints: 'ios', networkEndpoints: 'network',
  unmanagedEndpoints: 'unmanaged',
};

const ip = (h: number): string => `172.${16 + (h % 16)}.${(h >>> 4) & 0xff}.${((h >>> 12) % 253) + 1}`;
const mac = (h: number): string =>
  [0x00, 0x15, 0x5d, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
const GIB = 1024 ** 3;

const TIME_ZONES = ['UTC+01:00 Europe/Berlin', 'UTC+01:00 Europe/Berlin', 'UTC+01:00 Europe/Berlin', 'UTC+00:00 Europe/London', 'UTC-05:00 America/New_York', 'UTC-08:00 America/Los_Angeles', 'UTC+08:00 Asia/Singapore'];
const COMMENTS = ['Reception desk, ground floor', 'Shared workstation in training room 2', 'Mainboard replaced 2026-04, keep inventory up to date', 'Kiosk use, no reboot during business hours', 'Loaner device, return to IT service desk'];
const PC_ACTIVITIES = [
  (d: string) => `Job "Inventory Scan" finished on ${d}. Hardware and software inventory updated.`,
  (d: string) => `Job "Deploy Windows Updates" started on ${d}. Waiting for the next maintenance window before restarting.`,
  (d: string) => `Client agent connected on ${d}. No jobs pending.`,
];
const MOBILE_ACTIVITIES = ['MDM enrollment pending', 'Device check-in completed', 'Profile installation queued'];

/** Windows 10/11 builds per OS name in the mock's data ("spec": a plausible build for the release) */
function windowsBuild(os: string): string {
  if (/Server 2019/.test(os)) { return '10.0.17763.6414'; }
  if (/Server 2022/.test(os)) { return '10.0.20348.2762'; }
  if (/Windows 10.*(21H2|LTSC)/.test(os)) { return '10.0.19044.5011'; }
  if (/Windows 10/.test(os)) { return '10.0.19045.5011'; }
  if (/Windows 11.*22H2/.test(os)) { return '10.0.22621.4317'; }
  if (/Windows 11.*21H2/.test(os)) { return '10.0.22000.3260'; }
  return '10.0.22631.4317';
}

const VENDORS: Readonly<Record<string, string>> = {
  dell: 'Dell Inc.', hp: 'HP', lenovo: 'LENOVO', microsoft: 'Microsoft Corporation', surface: 'Microsoft Corporation',
  samsung: 'samsung', google: 'Google', pixel: 'Google', xiaomi: 'Xiaomi', motorola: 'motorola', zebra: 'Zebra Technologies',
  supermicro: 'Supermicro', hpe: 'HPE', ibm: 'IBM', fujitsu: 'FUJITSU',
};
/** The vendor as the hardware reports it, from the mock's model name */
function vendorOf(model: string | undefined, fallback: string): string {
  const space = model?.indexOf(' ') ?? -1;
  const first = model?.slice(0, space < 0 ? undefined : space).toLowerCase();
  return (first && VENDORS[first]) || fallback;
}

const CPUS = [
  { name: 'Intel(R) Core(TM) i5-1145G7 @ 2.60GHz', type: 'Intel64 Family 6 Model 140 Stepping 1', frequency: 2_600_000_000, logicalCores: 8, totalCores: 4 },
  { name: 'Intel(R) Core(TM) i7-1265U', type: 'Intel64 Family 6 Model 154 Stepping 4', frequency: 2_700_000_000, logicalCores: 12, totalCores: 10 },
  { name: '13th Gen Intel(R) Core(TM) i5-13500', type: 'Intel64 Family 6 Model 191 Stepping 2', frequency: 2_500_000_000, logicalCores: 20, totalCores: 14 },
  { name: 'AMD Ryzen 7 PRO 5850U with Radeon Graphics', type: 'AMD64 Family 25 Model 80 Stepping 0', frequency: 1_900_000_000, logicalCores: 16, totalCores: 8 },
];

/** One system disk: EFI, Windows and recovery partitions */
function windowsDisk(h: number, volumeGuid: (salt: number) => string): Item[] {
  const size = pick([256, 512, 1024], h >>> 3) * 1_000_204_886;
  const efi = 104_857_600;
  const recovery = 681_574_400;
  const windows = size - efi - recovery - 16_777_216;
  const volume = (salt: number, v: Item): Item => ({ volumeId: volumeGuid(salt), ...v });
  return [{
    index: 0, name: pick(['NVMe SAMSUNG MZVL2512', 'NVMe KXG80ZNV512G NV', 'NVMe WD PC SN740 SDDPNQD'], h >>> 5),
    byteSize: size, busType: 'NVMe', partitionStyle: 'GPT',
    storageVolumes: [
      volume(1, { driveLetter: '', name: '', fileSystem: 'FAT32', fileSystemType: 'FAT32', capacity: efi, freeSpace: 70_254_592, isSystemVolume: false, partitionType: 'EFI_System' }),
      volume(2, { driveLetter: 'C', name: 'Windows', fileSystem: 'NTFS', fileSystemType: 'NTFS', capacity: windows, freeSpace: Math.round(windows * (0.2 + (h % 50) / 100)), isSystemVolume: true, partitionType: 'Data' }),
      volume(3, { driveLetter: '', name: '', fileSystem: 'NTFS', fileSystemType: 'NTFS', capacity: recovery, freeSpace: 98_304_000, isSystemVolume: false, partitionType: 'Recovery' }),
    ],
  }];
}

function windows(item: Item, h: number): Item {
  const inventoried = roll(h, 1) < 35; // 6 of 20 on the live bMS
  const os = str(item['operatingSystem']) ?? 'Microsoft Windows 11 Enterprise 23H2';
  const build = windowsBuild(os);
  const address = str(item['primaryIP']) ?? ip(h);
  const user = str(item['primaryUser'])?.split('@')[0];
  // Co-managed with Intune (spec): the probed bMS had none; some inventoried endpoints here are,
  // so the Intune remote actions (26R2) have endpoints to act on
  const intune = inventoried && roll(h, 17) < 40;
  const always: Item = {
    activity: roll(h, 2) < 35 ? pick(PC_ACTIVITIES, h >>> 2)(shortDate(moment(h, 30, 'none'))) : undefined,
    comment: roll(h, 3) < 40 ? pick(COMMENTS, h >>> 3) : undefined,
    clientAgentLink: { extendedInternetMode: false, networkMode: roll(h, 4) < 15 ? 'Internet' : 'LAN', lastNetworkMode: roll(h, 4) < 15 ? 'Internet' : 'LAN' },
    clientAgentState: inventoried ? 'Running' : 'Unknown', // length
    coManagement: intune ? 'Intune' : 'None',
    entraIdDeviceId: intune ? guidOf(h, 17) : '',
    isAutopilotDevice: intune && roll(h, 18) < 50,
    isDeactivated: false,
    isEnergyManagementActive: roll(h, 5) < 55,
    lastChange: moment(h, 0, 'none'),
    modernManagementState: intune ? 'ManagedAndBaramundiAgentInstalled' : 'NotManaged',
    registeredUserUpdateMode: roll(h, 6) < 30 ? 'EnterManually' : 'UseNextLogonUser', // length
    userRelatedJobExecution: 'ForRegisteredUser', // length
    storageMedia: inventoried ? windowsDisk(h, (salt) => guidOf(h, salt)) : [],
  };
  if (!inventoried) { return always; }
  const cpu = pick(CPUS, h >>> 7);
  return Object.assign(always, {
    bootMode: 'UEFI (Secure)',
    cpu: { name: cpu.name, type: cpu.type, architecture: 'x64', frequency: cpu.frequency, physicalCPUs: 1, logicalCores: cpu.logicalCores, totalCores: cpu.totalCores },
    energyScheme: 'Balanced',
    energySchemeId: '381b4222-f694-41f0-9685-ff5bb260df2e', // Windows' own GUID of the Balanced plan
    primaryIP: address,
    ipList: address,
    primarySubnetMask: '255.255.255.0',
    lastBoot: moment(h, 600, 'none'),
    lastUser: user ? `${str(item['domain']) ?? 'CORP'}\\${user}` : undefined,
    manufacturer: vendorOf(str(item['machineModel']) ?? str(item['modelName']), 'Dell Inc.'),
    osVersionString: build,
    osVersionText: `${os} 64-Bit (Build ${build.split('.').slice(2).join('.')})`,
    timeZone: pick(TIME_ZONES, h >>> 9),
    totalRAM: pick([8, 16, 16, 32], h >>> 11) * GIB - 4_194_304,
    uuid: guidOf(h, 7).toUpperCase(),
  });
}

function linux(item: Item, h: number): Item {
  const os = str(item['operatingSystem']);
  const sshVersion = /ubuntu/i.test(os ?? '') ? 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10'
    : /red hat|centos|oracle|rocky|alma/i.test(os ?? '') ? 'SSH-2.0-OpenSSH_8.7' : 'SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u3';
  const key = Buffer.from(guidOf(h, 11) + guidOf(h, 12)).toString('base64').slice(0, 68);
  return {
    hostName: str(item['displayName'])?.toLowerCase(),
    managementMode: 'SSH',
    manufacturer: vendorOf(str(item['machineModel']), 'Dell Inc.'),
    osVersionText: os,
    primaryIP: ip(h),
    timeZone: pick(TIME_ZONES, h >>> 9),
    sshConfiguration: {
      sshVersion, port: 22, discoveryDate: null,
      authenticationMethod: roll(h, 7) < 60 ? 'Key' : 'Password',
      username: roll(h, 8) < 50 ? 'bmsadmin' : 'root',
      hostKeys: [{ hostKeyType: 'ssh-ed25519', hostKey: `AAAAC3NzaC1lZDI1NTE5AAAAI${key}` }],
    },
  };
}

/** Fields of a mobile device or Mac; enrolled ones also carry their network and OS details (spec) */
function apple(item: Item, h: number, kind: 'mac' | 'ios'): Item {
  const enrolled = kind === 'ios' ? item['managementState'] !== 'Unmanaged' : roll(h, 9) < 70;
  const common: Item = {
    activity: roll(h, 10) < 75 ? `(${shortDate(moment(h, 45, 'none'))}:00) ${pick(MOBILE_ACTIVITIES, h >>> 2)}` : undefined,
    comment: roll(h, 11) < 75 ? pick(COMMENTS, h >>> 3) : undefined,
    appleDEP: item['isSupervised'] === true,
    dedicatedDeviceModeEnabled: false,
    owner: 'Company', // length
    manufacturer: 'Apple',
    ...(kind === 'mac'
      ? { enrollmentType: enrolled ? 'Native' : 'Unenrolled', managementState: enrolled ? 'Managed' : 'Enrollable', supervised: item['isSupervised'] === true }
      : { appleManagementMode: 'DeviceEnrollment', hasAppleAppUpdates: roll(h, 12) < 25 }),
  };
  if (!enrolled) { return common; }
  return {
    ...common,
    hostName: str(item['displayName']),
    osVersionText: str(item['operatingSystem']),
    primaryIP: ip(h),
    primarySubnetMask: '255.255.255.0',
    ...(kind === 'ios' ? { primaryMAC: mac(h), macList: mac(h) } : {}),
    timeZone: pick(TIME_ZONES, h >>> 9),
  };
}

function android(item: Item, h: number): Item {
  const enrolled = roll(h, 9) < 70;
  const address = mac(h);
  const common: Item = {
    activity: roll(h, 10) < 75 ? `(${shortDate(moment(h, 45, 'none'))}:00) ${pick(MOBILE_ACTIVITIES, h >>> 2)}` : undefined,
    comment: roll(h, 11) < 75 ? pick(COMMENTS, h >>> 3) : undefined,
    managementState: enrolled ? 'Managed' : 'Enrollable',
    androidEnterpriseProfileType: enrolled ? 'WorkProfile' : 'None',
    dedicatedDeviceModeEnabled: false,
    owner: 'Company', // length
    zeroTouch: false,
  };
  if (!enrolled) { return common; }
  return {
    ...common,
    manufacturer: vendorOf(str(item['machineModel']) ?? str(item['modelName']), 'samsung'),
    osVersionText: str(item['operatingSystem']),
    primaryIP: ip(h),
    primarySubnetMask: '255.255.255.0',
    primaryMAC: address,
    macList: address,
    timeZone: pick(TIME_ZONES, h >>> 9),
    totalRAM: pick([6, 8, 12], h >>> 11) * GIB,
    availableRAM: pick([2, 3, 4], h >>> 13) * GIB,
    cpu: { name: 'Snapdragon 8 Gen 2', manufacturer: 'Qualcomm', frequency: 3_360_000_000, totalCores: 8 }, // spec
  };
}

function network(item: Item, h: number): Item {
  const ssh = roll(h, 13) < 75; // 3 of 4 on the live bMS
  const model = str(item['modelName']);
  return {
    comment: roll(h, 14) < 75 ? `Discovered by network scan on ${shortDate(moment(h, 2000, 'none'))}` : undefined,
    hostName: str(item['displayName']),
    operatingSystem: 'Unknown',
    macList: str(item['primaryMAC']),
    snmpPort: 0,
    totalRAM: 0,
    sshAuthenticationMethod: 'None',
    sshConfiguration: ssh ? { sshVersion: 'SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u3', port: 22, discoveryDate: moment(h, 2000, 'ticks'), authenticationMethod: 'None', username: null, hostKeys: [] } : undefined,
    // 26R2 (spec): the device's own data, from the mock's model, firmware and serial number
    deviceInfo: {
      manufacturer: vendorOf(model, model?.split(' ')[0] ?? 'Unknown'),
      moduleType: model ?? null,
      cpu: null,
      hardwareVersion: null,
      firmwareVersion: str(item['firmwareVersion']) ?? null,
      serialNumber: str(item['serialNumber']) ?? null,
      orderNumber: null,
    },
  };
}

/** The mock's AD domain (its users are user@corp.test, DC=corp,DC=test) */
const AD_DOMAIN = 'corp.test';
const hex = (h: number, salt: number): string => (Math.imul(h ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b) >>> 0).toString(16).padStart(8, '0');

/**
 * Unmanaged endpoints (spec): the network group 26R1 called networkGroupName and 26R2
 * computerGroupName, and in 26R2 the identity an endpoint proved with a Kerberos token (empty
 * without one), its domain membership, the expiry of the token it enrolled with and the
 * fingerprint of its key
 */
function unmanaged(item: Item, h: number): Item {
  const inDomain = roll(h, 15) < 60;
  const kerberos = inDomain && roll(h, 16) < 70;
  const host = (str(item['displayName']) ?? `PC-${hex(h, 1).slice(0, 6)}`).toUpperCase();
  const group = inDomain ? AD_DOMAIN : 'WORKGROUP';
  return {
    networkGroupName: group,
    computerGroupName: group,
    isPartOfDomain: inDomain,
    isKerberosAuthenticated: kerberos,
    kerberosPrincipal: kerberos ? `${host}$@${AD_DOMAIN.toUpperCase()}` : '',
    endpointSid: kerberos ? `S-1-5-21-3623811015-3361044348-30300820-${1100 + (h % 900)}` : '',
    adDnsName: kerberos ? `${host.toLowerCase()}.${AD_DOMAIN}` : '',
    tokenExpirationDate: `${new Date(Date.UTC(2027, 0, 1) + (h % 180) * 86_400_000).toISOString().slice(0, 19)}Z`,
    publicKeySha1Fingerprint: [1, 2, 3, 4, 5].map((salt) => hex(h, salt)).join('').toUpperCase(),
  };
}

const FILL: Record<Kind, (item: Item, h: number) => Item> = {
  windows, linux, network, android, unmanaged,
  mac: (item, h) => apple(item, h, 'mac'),
  ios: (item, h) => apple(item, h, 'ios'),
};

/** The item with the inventory fields it has none of (missing or null) */
export function withInventory(entityType: string, item: Item): Item {
  const kind = INVENTORY_KINDS[entityType];
  if (!kind || !item) { return item; }
  return fillMissing(item, FILL[kind](item, seedOf(item['id'] ?? item['guid'])));
}
