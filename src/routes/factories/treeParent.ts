/**
 * Created and moved tree items get parentId and parent as a live bMS shows them: no parentId
 * means the module's hidden root (src/profiles/treeRoots.ts), and parent is the parent's name.
 */

import type { Express } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import { treeParentFields } from '../../profiles/treeRoots';
import { currentRecords } from './currentRecords';

export function withTreeParent(
  app: Express,
  profile: IProfile,
  entityType: string,
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): Record<string, unknown> {
  if (mode === 'update' && !('parentId' in body)) { return body; }
  const fields = treeParentFields(entityType, body['parentId'], currentRecords(app, profile, entityType) ?? []);
  return fields ? { ...body, ...fields } : body;
}
