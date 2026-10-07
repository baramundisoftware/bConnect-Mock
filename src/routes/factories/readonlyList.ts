/**
 * P13.0.2 — Generic GET list route factory with pagination, SearchQuery, OrderBy.
 *
 * Registers a GET handler for a collection endpoint that supports:
 * - SearchQuery filtering (multi-keyword)
 * - OrderBy sorting (multi-field)
 * - Page/PageSize pagination (zero-indexed Page parameter)
 * - Generator-aware data resolution (ADR-007)
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import { resolveEntityData, parsePage } from '../utils';

export interface ReadonlyListConfig {
  /** Express route path, e.g. '/v2.0/LinuxEndpoints' */
  path: string;
  /** Profile fixture/generator key, e.g. 'linuxEndpoints' */
  entityType: string;
  /** Fields to search against when SearchQuery is provided */
  searchFields: string[];
  /** Human-readable entity name for 404 message */
  entityName: string;
}

/**
 * Register a read-only GET list route using profile fixture/generator data.
 *
 * @param app - Express application
 * @param profile - Active IProfile (read at registration time; captured in closure)
 * @param config - Route configuration
 */
export function registerReadonlyList(
  app: Express,
  profile: IProfile,
  config: ReadonlyListConfig
): void {
  const { path, entityType, searchFields, entityName } = config;

  app.get(path, (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);

      const resolved = resolveEntityData(profile, entityType, {
        searchQuery,
        orderBy,
        page,
        pageSize,
        searchFields,
      });

      if (!resolved) {
        res.status(404).json({ error: `${entityName} not available` });
        return;
      }

      const eff = pageSize > 0 ? pageSize : resolved.data.length;
      res.status(200).json({
        data: resolved.data,
        pageSize: eff,
        page,
        totalItems: resolved.totalItems,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
