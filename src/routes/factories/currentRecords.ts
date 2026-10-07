/**
 * The current records of an entity type, as every read handler should see them.
 *
 * In read-write profiles, POST/PUT/PATCH/DELETE change the entity's store in the StateManager;
 * the profile's fixture keeps the startup data. Once a store exists for an entity type, it is
 * the only truth: a deleted item must not come back from the fixture, a created one must be
 * found. Without a store (read-only profiles, or nothing written yet), the fixture is current.
 */

import type { Express } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import type { StateManager } from '../../state/StateManager';

export function currentRecords(app: Express, profile: IProfile, entityType: string): Record<string, unknown>[] | undefined {
  const store = (app.locals.stateManager as StateManager | undefined)?.getStore(entityType);
  if (store) { return store.getAll() as Record<string, unknown>[]; }
  const data = profile.getFixture(entityType);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : undefined;
}
