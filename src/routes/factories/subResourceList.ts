/**
 * P13.0.4 — Sub-resource list factory.
 *
 * Registers a GET /:parentId/ChildCollection route that:
 * 1. Validates the parent ID (GUID format)
 * 2. Checks the parent exists in its fixture/store
 * 3. Filters the child collection by a foreign key matching the parent ID
 * 4. Applies SearchQuery, OrderBy, and pagination
 *
 * Signature:
 *   registerSubResourceList(app, profile, {
 *     parentPath,      e.g. '/v2.0/LogicalGroups'
 *     childPath,       e.g. 'WindowsEndpoints'
 *     parentFixture,   e.g. 'logicalGroups'
 *     childFixture,    e.g. 'windowsEndpoints'
 *     foreignKey,      e.g. 'groupId'   (field on child pointing to parent)
 *     searchFields,    e.g. ['displayName', 'operatingSystem']
 *   })
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import { GUID_REGEX, applyMultiKeywordSearch, applyMultiFieldSort, parsePage } from '../utils';

export interface SubResourceListConfig {
  /** Parent collection base path, e.g. '/v2.0/LogicalGroups' */
  parentPath: string;
  /** Child sub-resource path segment, e.g. 'WindowsEndpoints' */
  childPath: string;
  /** Fixture key for parent collection, e.g. 'logicalGroups' */
  parentFixture: string;
  /** Fixture key for child collection, e.g. 'windowsEndpoints' */
  childFixture: string;
  /**
   * Foreign key field on child items that references the parent ID.
   * Can be a single string or array (checked in order).
   * e.g. 'groupId' or ['groupId', 'logicalGroupId']
   */
  foreignKey: string | string[];
  /** Fields to search on the child items */
  searchFields: string[];
  /** Human-readable child entity name for error messages */
  childEntityName?: string;
  /** Human-readable parent entity name for error messages */
  parentEntityName?: string;
}

/**
 * Register a `GET /parentPath/:parentId/childPath` sub-resource list route.
 */
export function registerSubResourceList(
  app: Express,
  profile: IProfile,
  config: SubResourceListConfig
): void {
  const {
    parentPath,
    childPath,
    parentFixture,
    childFixture,
    foreignKey,
    searchFields,
    parentEntityName = 'Parent',
  } = config;

  const foreignKeys = Array.isArray(foreignKey) ? foreignKey : [foreignKey];

  app.get(`${parentPath}/:parentId/${childPath}`, (req: Request, res: Response) => {
    try {
      const parentId = req.params['parentId'] as string;

      if (!parentId || !GUID_REGEX.test(parentId)) {
        res.status(400).json({ error: 'Invalid parent ID format' });
        return;
      }

      // Verify parent exists
      const parentData = profile.getFixture(parentFixture);
      if (!Array.isArray(parentData)) {
        res.status(404).json({ error: `${parentEntityName} not found` });
        return;
      }
      const parentExists = (parentData as Record<string, unknown>[]).some(
        (p) => p['id'] === parentId || p['guid'] === parentId
      );
      if (!parentExists) {
        res.status(404).json({ error: `${parentEntityName} not found` });
        return;
      }

      // Load child collection and filter by foreign key
      const childData = profile.getFixture(childFixture);
      let children: Record<string, unknown>[] = Array.isArray(childData)
        ? (childData as Record<string, unknown>[])
        : [];

      children = children.filter((child) =>
        foreignKeys.some((fk) => {
          const val = child[fk];
          if (Array.isArray(val)) {
            return (val as string[]).includes(parentId as string);
          }
          return val === parentId as string;
        })
      );

      // Apply search, sort, pagination
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);

      if (searchQuery?.trim()) {
        children = applyMultiKeywordSearch(children, searchQuery, searchFields);
      }
      if (orderBy?.trim()) {
        children = applyMultiFieldSort(children, orderBy);
      }

      const totalItems = children.length;
      const eff = pageSize > 0 ? pageSize : totalItems;
      const startIndex = page * eff;

      res.status(200).json({
        data: children.slice(startIndex, startIndex + eff),
        pageSize: eff,
        page,
        totalItems,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
