/**
 * hiddenRootAnswers — how a live bMS answers a request for a hidden tree root
 *
 * The top items of the trees point to a hidden root node of their module (src/profiles/
 * treeRoots.ts). Asked for that node, by ID or for its children, a live 26R1 bMS (probe
 * version 6, 2026-10-07) answers 404 in a typed form, with the ID in upper case:
 *   logical groups:             problem+json, title "Object [ID] not found or not visible …"
 *   org units, UDG folders:     application/json, detail "OrgUnit [ID] not found …" (sic, also UDG)
 *   job / OS / asset / bundle folders: application/json, detail "<type> folder [ID] not found …"
 * An unknown ID that isn't a hidden root gets the generic answer of bmsErrorBodies.
 */

import type { Request, Response, NextFunction } from 'express';
import { HIDDEN_TREE_ROOTS } from '../profiles/treeRoots';
import { sendProblem, sendNotFoundDetail } from './bmsErrors';

const MISSING = 'not found or not visible due to missing rights.';

/** Tree path (before /{id}) → the hidden root it may hold, and how the bMS names it in a 404 */
const TREES: Array<{ path: RegExp; root: string; children: string; detail?: string }> = [
  { path: /\/LogicalGroups$/, root: 'logicalGroups', children: 'LogicalGroups' },
  { path: /\/OrgUnits$/, root: 'orgUnits', children: 'OrgUnits', detail: 'OrgUnit' },
  { path: /\/UniversalDynamicGroupsFolder$/, root: 'folders', children: 'Folders', detail: 'OrgUnit' },
  { path: /\/AssetStock\/Folders$/, root: 'assetStockFolders', children: 'Folders', detail: 'asset stock folder' },
  { path: /\/AssetTypes\/Folders$/, root: 'assetTypeFolders', children: 'Folders', detail: 'asset type folder' },
  { path: /\/Bundle\/Folders$/, root: 'bundleFolders', children: 'Folders', detail: 'software bundle folder' },
  { path: /\/Folders$/, root: 'jobFolders', children: 'Folders', detail: 'job folder' },
  { path: /\/Folders$/, root: 'osFolders', children: 'Folders', detail: 'operating system folder' },
];

const BY_ID = /^(.*)\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/(\w+))?\/?$/;

export function hiddenRootAnswers(req: Request, res: Response, next: NextFunction): void {
  const match = req.method === 'GET' ? BY_ID.exec(req.path) : null;
  if (!match) { next(); return; }
  const [, base = '', id = '', child] = match;
  const tree = TREES.find((t) => t.path.test(base) && HIDDEN_TREE_ROOTS[t.root]?.id === id.toLowerCase()
    && (child === undefined || child === t.children));
  if (!tree) { next(); return; }
  const reason = `Hidden root of the ${tree.root} tree`;
  const upper = id.toUpperCase();
  if (tree.detail) {
    sendNotFoundDetail(res, reason, `${tree.detail} [${upper}] ${MISSING}`);
  } else {
    sendProblem(res, 404, reason, `Object [${upper}] ${MISSING}`);
  }
}
