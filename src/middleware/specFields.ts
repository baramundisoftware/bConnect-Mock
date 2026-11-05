/**
 * specFields — the spec's fields from the mock's data (#86)
 *
 * The fixtures and generators keep many values under other names than the spec's (an AD user's
 * `displayName` is the spec's `name`, a security group's `name` its `groupName`), and some spec
 * fields are names of related items (`endpointName`, `orgUnit`, `logicalGroup`). The strict
 * projection keeps only spec fields, so it dropped these values, while a live bMS answers with
 * them.
 *
 * Before an object is projected, the filler of its schema (the shape's `n`) derives the spec's
 * fields from the item: renamed fields, values of the same item (`domain` from the LDAP path)
 * and names of related items. A spec field the item already has (created with the spec's name,
 * for example) wins. The data itself stays as it is, so relations and search keep working.
 */

import type { Express } from 'express';
import { BmsVersion, isAtLeast, type IProfile } from '../profiles/ProfileManager';
import { currentRecords } from '../routes/factories/currentRecords';
import { clientAgentVersion } from '../profiles/releases';
import { seedOf } from '../profiles/seeded';

type Item = Record<string, unknown>;

/** Find a related item by its ID (or guid) in the first entity type that has it */
export type Lookup = (entityTypes: readonly string[], id: unknown) => Item | undefined;

const ENDPOINT_TYPES = ['windowsEndpoints', 'macEndpoints', 'linuxEndpoints', 'androidEndpoints', 'iosEndpoints', 'networkEndpoints', 'industrialEndpoints'] as const;

/** Generator-backed data never changes, so its index is kept for the life of the generator */
const generatorIndexes = new WeakMap<object, Map<string, Item>>();

function indexOf(records: Iterable<unknown>): Map<string, Item> {
  const index = new Map<string, Item>();
  for (const r of records) {
    const item = r as Item;
    for (const key of [item['id'], item['guid']]) {
      if (typeof key === 'string' && !index.has(key.toLowerCase())) { index.set(key.toLowerCase(), item); }
    }
  }
  return index;
}

/** A lookup over the current records (store, fixture or generator); array indexes live for one answer */
export function createLookup(app: Express, profile: IProfile | undefined): Lookup {
  const indexes = new Map<string, Map<string, Item>>();
  const index = (entityType: string): Map<string, Item> | undefined => {
    if (!profile) { return undefined; }
    if (indexes.has(entityType)) { return indexes.get(entityType); }
    let found: Map<string, Item> | undefined;
    const records = currentRecords(app, profile, entityType);
    if (records) {
      found = indexOf(records);
    } else {
      const generator = profile.getGenerator?.(entityType);
      if (generator) {
        found = generatorIndexes.get(generator) ?? indexOf(generator);
        generatorIndexes.set(generator, found);
      }
    }
    indexes.set(entityType, found ?? new Map());
    return found;
  };
  return (entityTypes, id) => {
    if (typeof id !== 'string') { return undefined; }
    for (const type of entityTypes) {
      const hit = index(type)?.get(id.toLowerCase());
      if (hit) { return hit; }
    }
    return undefined;
  };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** "CN=x,OU=y,DC=corp,DC=test" → "corp.test" */
function dnDomain(dn: unknown): string | undefined {
  const parts = str(dn)?.split(',').map((p) => p.trim()).filter((p) => /^DC=/i.test(p)).map((p) => p.slice(3));
  return parts && parts.length > 0 ? parts.join('.') : undefined;
}

/** A live bMS answers the distinguished name itself, without an LDAP:// prefix (26R2 probe) */
const ldapPath = (dn: unknown): string | undefined => str(dn)?.replace(/^LDAP:\/\//i, '');

/** "2026-01-15" → "2026-01-15T00:00:00Z"; a date-time stays as it is */
function dateTime(v: unknown): string | undefined {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s;
}

const nameOf = (item: Item | undefined): string | undefined => str(item?.['name']) ?? str(item?.['displayName']);

/** The spec's ADObjectType knows only User and Group */
const adObjectType = (v: unknown): 'User' | 'Group' | undefined => (v === 'User' || v === 'Group' ? v : undefined);

/** Fields every AD object derives the same way */
function adObject(item: Item, lookup: Lookup): Item {
  const dn = item['distinguishedName'];
  return {
    ldapPath: ldapPath(dn),
    domain: dnDomain(dn),
    objectGuid: str(item['guid']) ?? str(item['id']),
    orgUnit: nameOf(lookup(['orgUnits'], item['orgUnitId'])),
  };
}

/** Fields every endpoint type derives the same way */
function endpoint(item: Item, lookup: Lookup): Item {
  return {
    modelName: item['machineModel'],
    clientAgentVersion: item['version'],
    registeredUser: item['primaryUser'],
    macList: item['primaryMAC'],
    logicalGroup: nameOf(lookup(['logicalGroups'], item['logicalGroupId'])),
    supervised: item['isSupervised'],
    uniqueDeviceId: item['udid'],
    // The AD user the device is registered to; none for Linux endpoints on the live 26R2
    registeredUserId: item['type'] === 'LinuxEndpoint' ? undefined : item['adUserId'],
  };
}

type Filler = (item: Item, lookup: Lookup) => Item;

/** The mock's threat states as the spec's ThreatStatus */
const THREAT_STATUS: Record<string, string> = { Active: 'Detected', Quarantined: 'Quarantined', Remediated: 'Cleaned' };

const ENDPOINT_SCHEMAS = ['Endpoint', 'WindowsEndpoint', 'MacEndpoint', 'LinuxEndpoint', 'AndroidEndpoint', 'IosEndpoint', 'NetworkEndpoint', 'IndustrialEndpoint'];

const OWNER_SCOPES: Array<[string, string, readonly string[]]> = [
  ['endpointId', 'Endpoint', ENDPOINT_TYPES],
  ['logicalGroupId', 'LogicalGroup', ['logicalGroups']],
  ['adObjectId', 'ADObject', ['adObjects']],
  ['windowsApplicationId', 'WindowsApplication', ['windowsApplications']],
  ['windowsJobDefinitionId', 'WindowsJobDefinition', ['windowsJobDefinitions', 'jobs']],
];

export const FILLERS: Record<string, Filler> = {
  ...Object.fromEntries(ENDPOINT_SCHEMAS.map((name) => [name, endpoint])),
  ADGroup: (item, lookup) => ({ ...adObject(item, lookup), type: 'Group' }),
  ADObject: (item, lookup) => ({ ...adObject(item, lookup), type: adObjectType(item['objectType']) }),
  ADUser: (item, lookup) => {
    const name = str(item['displayName']);
    const [firstName, ...rest] = name?.split(' ') ?? [];
    const upn = str(item['userPrincipalName']);
    return {
      ...adObject(item, lookup),
      name,
      firstName: rest.length > 0 ? firstName : undefined,
      lastName: rest.length > 0 ? rest.join(' ') : undefined,
      principalName: upn,
      mail: item['email'],
      domain: dnDomain(item['distinguishedName']) ?? upn?.split('@')[1],
      type: adObjectType(item['type']) ?? 'User',
    };
  },
  Asset: (item, lookup) => {
    const owner = lookup(ENDPOINT_TYPES, item['endpointId']);
    return {
      name: item['assetTag'],
      inventoryNumber: item['assetTag'],
      assetTypeName: nameOf(lookup(['assetTypes'], item['assetTypeId'])),
      ownerId: owner ? item['endpointId'] : undefined,
      ownerName: nameOf(owner),
      ownerType: owner ? 'Machine' : undefined,
    };
  },
  AssetType: (item) => ({ comments: item['description'] }),
  Threat: (item, lookup) => ({
    detectionTime: item['detectedAt'],
    endpointId: item['windowsEndpointId'],
    endpointName: nameOf(lookup(ENDPOINT_TYPES, item['windowsEndpointId'])),
    threatStatus: THREAT_STATUS[item['status'] as string],
    isActive: typeof item['status'] === 'string' ? item['status'] === 'Active' : undefined,
  }),
  // The spec requires `state` (free text); the mock keeps a flag. "Active" as in bMCWeb's client
  RuleViolation: (item) => ({
    state: typeof item['ignored'] === 'boolean' ? (item['ignored'] ? 'Ignored' : 'Active') : 'Active',
  }),
  MicrosoftDefenderWindowsEndpoint: (item) => ({
    isMicrosoftDefenderActive: typeof item['defenderStatus'] === 'string' ? item['defenderStatus'] === 'Enabled' : undefined,
  }),
  // Created with the write model { name, profiles: [guid] }; read as { groupName, assignedSecurityProfiles: [{ id, name }] }
  SecurityGroup: (item, lookup) => ({
    groupName: item['name'],
    assignedSecurityProfiles: (Array.isArray(item['profiles']) ? item['profiles'] : [])
      .map((id: unknown) => ({ id, name: nameOf(lookup(['securityProfiles'], id)) ?? null })),
  }),
  SecurityProfile: (item) => ({ comment: item['description'] }),
  InstalledWindowsSoftware: (item, lookup) => ({
    name: item['displayName'],
    vendor: item['publisher'],
    installed: dateTime(item['installDate']),
    endpointName: nameOf(lookup(ENDPOINT_TYPES, item['endpointId'])),
  }),
  JobDefinition: (item, lookup) => ({
    displayName: item['name'],
    folder: nameOf(lookup(['jobFolders'], item['folderId'])),
  }),
  LogicalGroup: (item) => ({ comment: item['description'] }),
  VariableDefinition: (item) => ({ comment: item['description'] }),
  VariableInstance: (item, lookup) => {
    const definition = lookup(['variables', 'variableDefinitions'], item['variableDefinitionId']);
    const owner = OWNER_SCOPES.find(([field]) => str(item[field]));
    const ownerItem = owner ? lookup(owner[2], item[owner[0]]) : undefined;
    return {
      name: definition?.['name'],
      type: definition?.['type'],
      category: definition?.['category'],
      scope: owner?.[1],
      ownerId: owner ? item[owner[0]] : undefined,
      ownerName: nameOf(ownerItem),
      isDefault: false,
    };
  },
  UnmanagedEndpoint: (item) => ({
    osVersionText: item['detectedOS'],
    networkHostname: item['displayName'],
    macAddresses: str(item['primaryMAC']) ? [{ address: item['primaryMAC'] }] : undefined,
  }),
};

/** 26R2's ADObjectType tells AD from Entra ID objects; the mock's directory objects are all AD */
const AD_OBJECT_TYPES: Readonly<Record<string, string>> = { User: 'ADUser', Group: 'ADGroup' };

/**
 * Enum values a later release names differently from the mock's data: from release `since` on,
 * `field` of the schemas' objects gets the release's name for its value.
 */
const RELEASE_VALUES: ReadonlyArray<{ since: BmsVersion; schemas: readonly string[]; field: string; values: Readonly<Record<string, string>> }> = [
  { since: BmsVersion.BMS_26R2, schemas: ['ADUser', 'ADGroup', 'ADObject'], field: 'type', values: AD_OBJECT_TYPES },
];

/** A date-time as a live bMS writes it: without a fraction of a second, or with seven digits of ticks */
function asMoment(v: unknown, fraction: 'none' | 'ticks'): unknown {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) { return v; }
  const seconds = v.slice(0, 19);
  return fraction === 'none' ? `${seconds}Z` : `${seconds}.${String(seedOf(v) % 10_000_000).padStart(7, '0')}Z`;
}

const moments = (item: Item, formats: Record<string, 'none' | 'ticks'>): Item =>
  Object.fromEntries(Object.entries(formats).filter(([f]) => f in item).map(([f, fraction]) => [f, asMoment(item[f], fraction)]));

/** The client agent platform of an endpoint schema, or of an item of the endpoint list by its type */
const AGENT_PLATFORMS: Readonly<Record<string, 'windows' | 'apple' | 'android' | 'linux'>> = {
  WindowsEndpoint: 'windows', MacEndpoint: 'apple', IosEndpoint: 'apple', IOSEndpoint: 'apple', AndroidEndpoint: 'android', LinuxEndpoint: 'linux',
};

function agentVersion(schema: string, item: Item, release: BmsVersion | undefined): Item {
  const platform = AGENT_PLATFORMS[schema === 'Endpoint' ? String(item['type']) : schema];
  // Endpoints without an agent (no inventory on the 26R1 probe) keep none
  if (!platform || !release || item['clientAgentVersion'] === undefined || item['clientAgentVersion'] === null) { return {}; }
  return { clientAgentVersion: clientAgentVersion(platform, release, seedOf(item['id'] ?? item['guid'])) };
}

/**
 * Values the mock keeps in another format than a live bMS answers them (probes of a live 26R1 and
 * a live 26R2): replaced, not only filled. Job and download job times without a fraction of a
 * second, the last inventory of update management with ticks, repetition times as HH:mm, and
 * client agent versions of the release.
 */
type Reformat = (item: Item, schema: string, release?: BmsVersion) => Item;
const endpointFormat: Reformat = (item, schema, release) => agentVersion(schema, item, release);

const REFORMAT: Readonly<Record<string, Reformat>> = {
  ...Object.fromEntries(ENDPOINT_SCHEMAS.map((name) => [name, endpointFormat])),
  // Update management's Windows endpoints share the endpoints' schema name
  WindowsEndpoint: (item, schema, release) => ({ ...endpointFormat(item, schema, release), ...moments(item, { lastInventory: 'ticks', lastSuccessfulUpdate: 'none' }) }),
  JobInstance: (item) => moments(item, { start: 'none', lastAction: 'none' }),
  JobInstanceStep: (item) => moments(item, { lastAction: 'none' }),
  DownloadJob: (item) => moments(item, { lastExecution: 'none', lastUpdate: 'none' }),
  RepetitionDefinition: (item) => (typeof item['time'] === 'string' ? { time: item['time'].slice(0, 5) } : {}),
};

/**
 * The item with the spec fields its schema's filler derives, where the item has none, with the
 * names the release (if given) uses for its enum values, and in the formats of a live bMS
 */
export function fillSpecFields(schema: string, item: Item, lookup: Lookup, release?: BmsVersion): Item {
  const filler = FILLERS[schema];
  const renames = release ? RELEASE_VALUES.filter((r) => r.schemas.includes(schema) && isAtLeast(release, r.since)) : [];
  const reformat = REFORMAT[schema];
  if (!filler && renames.length === 0 && !reformat) { return item; }
  const out: Item = { ...item };
  for (const [name, value] of Object.entries(filler ? filler(item, lookup) : {})) {
    if ((out[name] === undefined || out[name] === null) && value !== undefined && value !== null) { out[name] = value; }
  }
  for (const { field, values } of renames) {
    const renamed = typeof out[field] === 'string' ? values[out[field] as string] : undefined;
    if (renamed) { out[field] = renamed; }
  }
  return reformat ? Object.assign(out, reformat(out, schema, release)) : out;
}
