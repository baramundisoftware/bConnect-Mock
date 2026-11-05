/**
 * Record fields — what a live bMS fills for assets, asset types, job definitions, job instances
 * and installed Windows software
 *
 * The mock's data for these lacked fields a live bMS answers, so the spec conformance test
 * listed them as never set. The formats come from a read-only probe of a live 26R1 bMS
 * (26.1.161.0, probe version 7, 2026-11-02), which reported each field's shape, never its values:
 * - Assets: three `additionalProperties` of type String, an empty `assetReferenceList`,
 *   `energyOn`/`energyOff` -1, `operatingCost` and `purchasePrice` 0, `url` "http://" (the
 *   empty default), `lastChanged` without a fraction of a second.
 * - Asset types: a parent folder (`guidParent`, `parentName`), `energyOptions` "0",
 *   `iconChanged`, `purchaseDate`, the same zero costs and default `url`.
 * - Job instances: `delays` 0 and `steps`, each with a type, description, state and last action.
 * - Installed Windows software: half of it managed software (`source` and `category`
 *   ManagedSoftware, with an `applicationId`), half `Inventoried`; every entry has a
 *   `detectionRuleId`, `lastFound` and `autUsage` AutDeactivated (usage tracking off).
 * - Job definitions: a `comment` on about a third of them, all in a folder, a `category` and a
 *   `description` on few.
 * - DIPs: empty `details` and a `lastUpdate`; security profiles: the two display flags.
 * - Variable definitions (not probed): the `scopes` of their instances.
 *
 * A probe of a live pre-release 26R2 bMS (26.2.110.0, probe version 8, 2026-11-05) with more
 * data added the formats of:
 * - AD users, groups and objects: a domain `sid` (S-1-5-21-…-RID) and the same import `comment`
 *   on every object; users with their distinguished name, groups in an org unit.
 * - The gateway (`availability` Up, `configurationStatus` Enrolled, `lastContact` with ticks)
 *   and the VPN appliance (`status`); security groups with one assigned security profile.
 * - Variable definitions: a `category` on all, a `defaultValue` on about a fifth; instances take
 *   their definition's category.
 * - BitLocker and Microsoft Defender states: src/profiles/defenseControlFields.ts.
 *
 * withRecordFields() fills these where an item has none; values are synthetic and fixed per item
 * (src/profiles/seeded.ts). Links (an asset's type, an asset type's folder) point to items the
 * profile has.
 */

import { type Item, seedOf, roll, pick, str, moment, guidOf, fillMissing } from './seeded';
import { bitLockerFields, defenderFields } from './defenseControlFields';

/** Another entity type's items of the same profile */
export type Related = (entityType: string) => Item[];
type Fill = (item: Item, h: number, related: Related) => Item;

const STEP_DESCRIPTIONS: Readonly<Record<string, string>> = {
  WindowsInventory: 'Hardware and software inventory',
  WindowsApplicationInstallation: 'Install application',
  WindowsMicrosoftUpdateInventory: 'Scan for Microsoft updates',
  WindowsMicrosoftUpdateInstallation: 'Install Microsoft updates',
  NetworkAndOTDeviceSSHMiniInventory: 'SSH mini inventory',
  LinuxAndOTScriptExecution: 'Execute script',
  MacOsAndMobileSoftwareInventory: 'Software inventory',
};

/** The step types a job definition of each type runs */
function stepTypes(jobType: string, h: number): string[] {
  if (/^Network/.test(jobType)) { return ['NetworkAndOTDeviceSSHMiniInventory']; }
  if (/^MacOS|Mobile/.test(jobType)) { return ['MacOsAndMobileSoftwareInventory']; }
  return pick([['WindowsInventory'], ['WindowsApplicationInstallation', 'WindowsInventory'], ['WindowsMicrosoftUpdateInventory', 'WindowsMicrosoftUpdateInstallation']], h >>> 3);
}

/** Steps that match the instance's state: done, failed at the last step, still queued or running */
function steps(item: Item, h: number): Item[] {
  const state = str(item['state']) ?? 'FinishedSuccessfully';
  const types = stepTypes(str(item['jobDefinitionType']) ?? 'WindowsJobDefinition', h);
  return types.map((type, i) => {
    const last = i === types.length - 1;
    const stepState = state === 'FinishedWithError' && last ? 'FinishedWithError'
      : state === 'Queued' || (state === 'Running' && last) ? 'Queued'
        : state === 'Cancelled' && last ? 'RequirementsNotMet' : 'FinishedSuccessfully';
    return {
      type,
      description: STEP_DESCRIPTIONS[type] ?? type,
      state: stepState,
      stateDescription: stepState === 'FinishedWithError' ? 'The step failed with exit code 1603.' : stepState === 'FinishedSuccessfully' ? 'Step finished successfully' : null,
      lastAction: stepState === 'Queued' ? null : moment(h, 90 - i * 5, 'ticks'),
    };
  });
}

const ASSET_COMMENTS = ['Leased device, return to the vendor at the end of the term', 'Inventoried during the annual stocktaking', 'Moved to a new desk, update the location'];
const JOB_COMMENTS = ['Rolls out the current package to all Windows endpoints, created 15.03.2026', 'Runs nightly between 22:00 and 04:00, see change request CR-2041', 'Pilot group first, then all endpoints after one week'];

/** An instance's owner field and the scope it gives (the order of specFields' OWNER_SCOPES) */
const INSTANCE_SCOPES: ReadonlyArray<[string, string]> = [
  ['endpointId', 'Endpoint'], ['logicalGroupId', 'LogicalGroup'], ['adObjectId', 'ADObject'],
  ['windowsApplicationId', 'WindowsApplication'], ['windowsJobDefinitionId', 'WindowsJobDefinition'],
];

/** The domain part of the SIDs of the mock's AD (the example domain of Microsoft's docs) */
const DOMAIN_SID = 'S-1-5-21-3623811015-3361044348-30300820';
const AD_COMMENT = 'Synchronized from Active Directory on 01.10.2026 06:00';
const sid = (h: number): string => `${DOMAIN_SID}-${1100 + (h % 8900)}`;

/** The org unit an AD object is in: its own, else one of the profile's */
function orgUnitOf(item: Item, h: number, related: Related): Item | undefined {
  const units = related('orgUnits');
  return units.find((u) => u['id'] === item['orgUnitId']) ?? (units.length ? pick(units, h) : undefined);
}

const VARIABLE_CATEGORIES = ['General', 'Location', 'Software', 'Network', 'Security'];

const FILL: Readonly<Record<string, Fill>> = {
  adUsers: (item, h, related) => {
    const unit = orgUnitOf(item, h, related);
    const dn = str(unit?.['distinguishedName']);
    return { sid: sid(h), comment: AD_COMMENT, distinguishedName: dn && str(item['displayName']) ? `CN=${item['displayName'] as string},${dn}` : undefined };
  },
  adGroups: (item, h, related) => ({ sid: sid(h), comment: AD_COMMENT, orgUnitId: orgUnitOf(item, h, related)?.['id'] }),
  adObjects: (_item, h) => ({ sid: sid(h), comment: AD_COMMENT }),
  gateway: (item, h) => ({
    availability: item['isConnected'] === false ? 'Down' : 'Up',
    configurationStatus: 'Enrolled',
    lastContact: item['isConnected'] === false ? undefined : moment(h, 2, 'ticks'),
  }),
  vpnAppliance: (item) => ({ status: item['isEnabled'] === false ? 'NotConfigured' : 'Ok' }),
  // Read as assignedSecurityProfiles (src/middleware/specFields.ts); one each on the live bMS
  securityGroups: (_item, h, related) => {
    const profiles = related('securityProfiles');
    return { profiles: profiles.length ? [pick(profiles, h)['id']] : undefined };
  },
  assets: (item, h, related) => {
    const types = related('assetTypes');
    const byName = types.find((t) => str(t['name'])?.toLowerCase() === str(item['type'])?.toLowerCase());
    const assetType = byName ?? (types.length ? pick(types, h) : undefined);
    const properties = [['Location', item['location']], ['Department', item['department']], ['Warranty until', item['warrantyExpires']]]
      .filter(([, value]) => str(value)).map(([name, value]) => ({ name, type: 'String', value }));
    return {
      assetTypeId: assetType?.['id'] ?? assetType?.['guid'],
      additionalProperties: properties,
      assetReferenceList: [],
      comments: roll(h, 20) < 35 ? pick(ASSET_COMMENTS, h >>> 2) : undefined,
      energyOn: -1,
      energyOff: -1,
      operatingCost: 0,
      purchasePrice: 0,
      url: 'http://',
      lastChanged: moment(h, 300, 'none'),
    };
  },
  assetTypes: (_item, h, related) => {
    const folders = related('assetTypeFolders');
    const folder = folders.length ? pick(folders, h) : undefined;
    return {
      guidParent: folder?.['id'],
      parentName: folder?.['name'],
      energyOptions: '0',
      iconChanged: moment(h, 20_000, 'none'),
      purchaseDate: moment(h, 30_000, 'none'),
      operatingCost: 0,
      purchasePrice: 0,
      url: 'http://',
    };
  },
  jobInstances: (item, h) => ({ delays: 0, steps: steps(item, h) }),
  jobs: (_item, h, related) => {
    const folders = related('jobFolders');
    const folder = folders.length ? pick(folders, h) : undefined;
    return {
      comment: roll(h, 21) < 38 ? pick(JOB_COMMENTS, h >>> 2) : undefined, // 25 of 66 on the live bMS
      folderId: folder?.['id'], // every job definition is in a folder (66 of 66)
      category: roll(h, 23) < 3 ? 'software' : undefined, // 1 of 66
      description: roll(h, 24) < 3 ? 'Deploys the standard client software' : undefined, // 1 of 66
    };
  },
  dips: (_item, h) => ({ details: '', lastUpdate: moment(h, 60, 'none') }),
  securityProfiles: (_item, h) => ({ displayAdministratorIdentities: roll(h, 25) < 67, displayEndpointUserIdentities: true }), // 2 and 3 of 3
  // A definition's scopes: those of its instances (an instance's scope is its owner's kind)
  variables: (item, h, related) => {
    const own = related('variableInstances').filter((i) => i['variableDefinitionId'] === item['id']);
    const scopes = [...new Set(own.map((i) => INSTANCE_SCOPES.find(([field]) => str(i[field]))?.[1]).filter((s): s is string => Boolean(s)))];
    const values = Array.isArray(item['values']) ? item['values'] : [];
    return {
      scopes: scopes.length ? scopes : ['Endpoint'],
      category: pick(VARIABLE_CATEGORIES, h),
      defaultValue: roll(h, 26) < 18 ? str(values[0]) : undefined, // 7 of 40 on the live bMS
    };
  },
  bitLockerStates: (item) => bitLockerFields(item),
  microsoftDefenderStates: (item, _h, related) => defenderFields(item, related('microsoftDefenderThreats')),
  installedWindowsSoftware: (_item, h) => {
    const managed = roll(h, 22) < 50; // 50 of 100 on the live bMS
    return {
      source: managed ? 'ManagedSoftware' : 'Inventoried',
      category: managed ? 'ManagedSoftware' : undefined,
      applicationId: managed ? guidOf(h, 21) : undefined,
      detectionRuleId: guidOf(h, 22),
      autUsage: 'AutDeactivated',
      lastFound: moment(h, 120, 'none'),
    };
  },
};

/** Fixture and store names of the entity types this module fills */
export const RECORD_TYPES: ReadonlySet<string> = new Set(Object.keys(FILL));

/** The item with the record fields it has none of (missing or null) */
export function withRecordFields(entityType: string, item: Item, related: Related): Item {
  const fill = FILL[entityType];
  if (!fill || !item) { return item; }
  return fillMissing(item, fill(item, seedOf(item['id'] ?? item['guid'] ?? item['assetId']), related));
}
