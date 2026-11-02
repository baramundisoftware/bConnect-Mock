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
import type { IProfile } from '../profiles/ProfileManager';
import { currentRecords } from '../routes/factories/currentRecords';

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

const ldapPath = (dn: unknown): string | undefined => (str(dn) ? `LDAP://${dn as string}` : undefined);

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

/** The item with the spec fields its schema's filler derives, where the item has none */
export function fillSpecFields(schema: string, item: Item, lookup: Lookup): Item {
  const filler = FILLERS[schema];
  if (!filler) { return item; }
  const derived = filler(item, lookup);
  const out: Item = { ...item };
  for (const [name, value] of Object.entries(derived)) {
    if ((out[name] === undefined || out[name] === null) && value !== undefined && value !== null) { out[name] = value; }
  }
  return out;
}
