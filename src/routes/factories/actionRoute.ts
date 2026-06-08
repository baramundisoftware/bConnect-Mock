/**
 * P13.0.6 — Action route factory (fire-and-forget POST).
 *
 * Registers a POST /:parentId/ActionName handler that:
 * - Validates parent exists (optional)
 * - Returns a canned 200 or 204 response
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import { GUID_REGEX } from '../utils';

export interface ActionRouteConfig {
  /** Full action path, e.g. '/v2.0/WindowsEndpoints/:id/StartEnrollment' */
  path: string;
  /** HTTP status code to return (200 or 204) */
  status?: 200 | 204;
  /** Response body for 200 responses */
  responseBody?: Record<string, unknown>;
  /**
   * If set, validates that `:id` exists in this fixture before proceeding.
   * Uses `req.params.id` for the lookup.
   */
  parentFixture?: string;
  /** Human-readable parent entity name for 404 messages */
  parentEntityName?: string;
}

/**
 * Register a fire-and-forget POST action route.
 *
 * @param app - Express application
 * @param profile - Active IProfile (used for parent existence checks)
 * @param config - Route configuration
 */
export function registerActionRoute(
  app: Express,
  profile: IProfile,
  config: ActionRouteConfig
): void {
  const {
    path,
    status = 200,
    responseBody = { message: 'Action triggered successfully' },
    parentFixture,
    parentEntityName = 'Parent',
  } = config;

  app.post(path, (req: Request, res: Response) => {
    try {
      // If parentFixture specified, validate parent exists
      if (parentFixture) {
        const id = req.params['id'] as string;
        if (!id || !GUID_REGEX.test(id)) {
          res.status(400).json({ error: 'Invalid parent ID format' });
          return;
        }
        const data = profile.getFixture(parentFixture);
        if (!Array.isArray(data)) {
          res.status(404).json({ error: `${parentEntityName} not found` });
          return;
        }
        const exists = (data as Record<string, unknown>[]).some(
          (p) => p['id'] === id || p['guid'] === id
        );
        if (!exists) {
          res.status(404).json({ error: `${parentEntityName} not found` });
          return;
        }
      }

      if (status === 204) {
        res.status(204).send();
      } else {
        res.status(200).json(responseBody);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
